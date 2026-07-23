from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException
from app.models.rbac_models import ROLE_HIERARCHY
from app.repositories.dashboard.rbac_repository import RBACRepository

try:
    import redis.asyncio as aioredis  # type: ignore
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

_PERMISSION_CACHE_TTL = 120  # 2 minutes


class RBACService:
    def __init__(self, db: AsyncIOMotorDatabase, redis_client: Any | None = None) -> None:
        self.repo = RBACRepository(db)
        self._redis = redis_client

    # ─── Cache Helpers ────────────────────────────────────────────────────────

    def _perm_cache_key(self, user_id: str) -> str:
        return f"rbac:perms:{user_id}"

    def _role_cache_key(self, user_id: str) -> str:
        return f"rbac:roles:{user_id}"

    async def _cache_set(self, key: str, value: Any) -> None:
        if self._redis:
            try:
                await self._redis.set(key, json.dumps(list(value) if isinstance(value, set) else value), ex=_PERMISSION_CACHE_TTL)
            except Exception:
                pass

    async def _cache_get(self, key: str) -> Any | None:
        if self._redis:
            try:
                raw = await self._redis.get(key)
                if raw:
                    return json.loads(raw)
            except Exception:
                pass
        return None

    async def invalidate_user_cache(self, user_id: str) -> None:
        if self._redis:
            try:
                await self._redis.delete(self._perm_cache_key(user_id), self._role_cache_key(user_id))
            except Exception:
                pass

    # ─── User Permissions (the hot path) ──────────────────────────────────────

    async def get_user_permissions(self, user_id: str, user_role_field: str = "user") -> set[str]:
        """Return effective permission set for a user. Checks cache first."""
        cached = await self._cache_get(self._perm_cache_key(user_id))
        if cached is not None:
            return set(cached)

        perms = await self.repo.get_user_effective_permissions(user_id)

        # Super admin shortcut: full access regardless of DB permissions
        user_roles = await self.repo.get_user_roles(user_id)
        role_slugs = {r["role_slug"] for r in user_roles}
        if not role_slugs:
            # Fall back to legacy role field
            role_slugs = {user_role_field}

        if "super_admin" in role_slugs:
            perms = {"*"}  # wildcard — all access

        await self._cache_set(self._perm_cache_key(user_id), perms)
        return perms

    async def get_user_role_slugs(self, user_id: str, legacy_role: str = "user") -> set[str]:
        """Return set of role slugs for a user."""
        cached = await self._cache_get(self._role_cache_key(user_id))
        if cached is not None:
            return set(cached)

        user_roles = await self.repo.get_user_roles(user_id)
        slugs = {r["role_slug"] for r in user_roles} or {legacy_role}
        await self._cache_set(self._role_cache_key(user_id), slugs)
        return slugs

    def has_permission(self, perms: set[str], module: str, action: str) -> bool:
        if "*" in perms:
            return True
        return f"{module}:{action}" in perms

    def has_any_role(self, role_slugs: set[str], allowed: list[str]) -> bool:
        return bool(role_slugs & set(allowed))

    def highest_hierarchy(self, role_slugs: set[str]) -> int:
        return max((ROLE_HIERARCHY.get(s, 0) for s in role_slugs), default=0)

    # ─── Role Management ──────────────────────────────────────────────────────

    async def list_roles(self, include_inactive: bool = False) -> list[dict]:
        roles = await self.repo.get_all_roles(include_inactive)
        for role in roles:
            perm_ids = role.get("permission_ids", [])
            if perm_ids:
                perms = await self.repo.get_permissions_by_ids(perm_ids)
                role["permissions"] = perms
            else:
                role["permissions"] = []
        return roles

    async def get_role(self, role_id: str) -> dict:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message="Role not found.")
        perm_ids = role.get("permission_ids", [])
        role["permissions"] = await self.repo.get_permissions_by_ids(perm_ids) if perm_ids else []
        return role

    async def create_role(self, name: str, slug: str, description: str, hierarchy_level: int, created_by: str) -> dict:
        slug = slug.lower().replace(" ", "_")
        if await self.repo.slug_exists(slug):
            raise AppException(status_code=409, code="ROLE_SLUG_EXISTS", message=f"Role slug '{slug}' already exists.")
        if slug in ("super_admin", "admin", "owner", "supervisor", "staff", "user"):
            raise AppException(status_code=400, code="RESERVED_SLUG", message="This role slug is reserved.")

        role_id = await self.repo.create_role({
            "name": name,
            "slug": slug,
            "description": description,
            "hierarchy_level": hierarchy_level,
            "is_system": False,
            "created_by": created_by,
        })
        return await self.get_role(role_id)

    async def update_role(self, role_id: str, updates: dict, actor_id: str) -> dict:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message="Role not found.")
        if role.get("is_system") and "slug" in updates:
            raise AppException(status_code=400, code="CANNOT_RENAME_SYSTEM_ROLE", message="System role slugs cannot be changed.")

        allowed_fields = {"name", "description", "hierarchy_level", "is_active"}
        safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        await self.repo.update_role(role_id, safe_updates)
        return await self.get_role(role_id)

    async def delete_role(self, role_id: str) -> None:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message="Role not found.")
        if role.get("is_system"):
            raise AppException(status_code=400, code="CANNOT_DELETE_SYSTEM_ROLE", message="System roles cannot be deleted.")
        deleted = await self.repo.delete_role(role_id)
        if not deleted:
            raise AppException(status_code=400, code="DELETE_FAILED", message="Could not delete role.")

    async def set_role_permissions(self, role_id: str, permission_ids: list[str], actor_id: str) -> dict:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message="Role not found.")

        # Validate all permission IDs exist
        valid_perms = await self.repo.get_permissions_by_ids(permission_ids)
        valid_ids = [p["_id"] for p in valid_perms]
        await self.repo.set_role_permissions(role_id, valid_ids)
        return await self.get_role(role_id)

    # ─── Permission Management ─────────────────────────────────────────────────

    async def list_permissions(self) -> list[dict]:
        return await self.repo.get_all_permissions()

    async def list_permissions_by_module(self) -> dict[str, list[dict]]:
        perms = await self.repo.get_all_permissions()
        grouped: dict[str, list[dict]] = {}
        for p in perms:
            mod = p.get("module", "unknown")
            grouped.setdefault(mod, []).append(p)
        return grouped

    # ─── User Role Assignment ──────────────────────────────────────────────────

    async def assign_role_to_user(
        self,
        user_id: str,
        role_slug: str,
        assigned_by: str,
        assigned_by_role: str,
        organization_id: str | None = None,
        expires_at: datetime | None = None,
    ) -> dict:
        role = await self.repo.get_role_by_slug(role_slug)
        if not role:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message=f"Role '{role_slug}' not found.")

        # Enforce hierarchy: cannot assign a role >= your own
        assigner_hierarchy = ROLE_HIERARCHY.get(assigned_by_role, 0)
        target_hierarchy = role.get("hierarchy_level", 0)

        if assigner_hierarchy <= target_hierarchy and assigned_by_role != "super_admin":
            raise AppException(
                status_code=403,
                code="INSUFFICIENT_HIERARCHY",
                message="You cannot assign a role equal to or higher than your own.",
            )

        # Revoke existing same-role in same org scope before re-assigning
        await self.repo.revoke_role(user_id, role_slug, organization_id)

        assignment_id = await self.repo.assign_role(
            user_id=user_id,
            role_id=str(role["_id"]),
            role_slug=role_slug,
            assigned_by=assigned_by,
            organization_id=organization_id,
            expires_at=expires_at,
        )
        await self.invalidate_user_cache(user_id)
        return {"assignment_id": assignment_id, "user_id": user_id, "role_slug": role_slug}

    async def revoke_role_from_user(
        self, user_id: str, role_slug: str, revoked_by_role: str, organization_id: str | None = None
    ) -> None:
        role = await self.repo.get_role_by_slug(role_slug)
        if not role:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message=f"Role '{role_slug}' not found.")

        revoker_hierarchy = ROLE_HIERARCHY.get(revoked_by_role, 0)
        target_hierarchy = role.get("hierarchy_level", 0)
        if revoker_hierarchy <= target_hierarchy and revoked_by_role != "super_admin":
            raise AppException(status_code=403, code="INSUFFICIENT_HIERARCHY", message="Cannot revoke a role equal to or higher than your own.")

        await self.repo.revoke_role(user_id, role_slug, organization_id)
        await self.invalidate_user_cache(user_id)

    async def get_user_role_details(self, user_id: str) -> list[dict]:
        user_roles = await self.repo.get_user_roles(user_id)
        result = []
        for ur in user_roles:
            role = await self.repo.get_role_by_id(ur["role_id"])
            if role:
                result.append({
                    "assignment_id": ur.get("_id"),
                    "role_id": ur["role_id"],
                    "role_slug": ur["role_slug"],
                    "role_name": role.get("name"),
                    "hierarchy_level": role.get("hierarchy_level"),
                    "organization_id": ur.get("organization_id"),
                    "assigned_by": ur.get("assigned_by"),
                    "assigned_at": ur.get("assigned_at"),
                    "expires_at": ur.get("expires_at"),
                })
        return result

    # ─── Audit ────────────────────────────────────────────────────────────────

    async def log_action(
        self,
        actor_id: str,
        actor_role: str,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        changes: dict | None = None,
        ip_address: str | None = None,
        outcome: str = "success",
    ) -> None:
        await self.repo.write_audit_log({
            "actor_id": actor_id,
            "actor_role": actor_role,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "changes": changes or {},
            "ip_address": ip_address,
            "outcome": outcome,
        })

    async def get_audit_logs(
        self,
        actor_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        return await self.repo.get_audit_logs(actor_id, resource_type, resource_id, limit, offset)


    # ─── Account Creation Restrictions ─────────────────────────────────────────

    async def create_subordinate_account(self, current_user: dict, payload: Any) -> dict:
        creator_id = str(current_user.get("_id") or current_user.get("id"))
        creator_role = current_user.get("primary_role") or current_user.get("role") or "user"

        from app.models.rbac_models import ROLE_CREATION_MATRIX
        
        allowed_targets = ROLE_CREATION_MATRIX.get(creator_role, set())
        if payload.target_role not in allowed_targets:
            raise AppException(
                status_code=403,
                code="FORBIDDEN_ROLE_CREATION",
                message=f"Role '{creator_role}' cannot create role '{payload.target_role}'."
            )

        target_hierarchy = ROLE_HIERARCHY.get(payload.target_role, 0)
        creator_hierarchy = ROLE_HIERARCHY.get(creator_role, 0)
        
        if target_hierarchy >= creator_hierarchy and creator_role != "super_admin":
            raise AppException(
                status_code=403, 
                code="INSUFFICIENT_HIERARCHY", 
                message="Cannot create an account with a role equal to or higher than your own."
            )

        if creator_role in ("owner", "manager"):
            org_id = current_user.get("organization_id")
            if not org_id:
                raise AppException(status_code=400, code="MISSING_ORGANIZATION", message=f"{creator_role.capitalize()} must belong to an organization.")
        else:
            org_id = payload.organization_id

        # Generate login credentials
        from app.services.dashboard.credential_generator import generate_login_email, generate_secure_password
        
        while True:
            generated_login_email = generate_login_email(payload.full_name, payload.target_role)
            existing = await self.repo.db.users.find_one({"email": generated_login_email})
            if not existing:
                break
                
        generated_password = generate_secure_password()

        from app.core.security import hash_password
        
        hashed_pw = hash_password(generated_password)
        user_doc = {
            "email": generated_login_email,
            "original_email": payload.original_email,
            "password_hash": hashed_pw,
            "full_name": payload.full_name,
            "created_by": creator_id,
            "is_subordinate_account": True,
            "organization_id": org_id,
            "role": payload.target_role,
            "roles": [payload.target_role],
            "is_verified": True,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await self.repo.db.users.insert_one(user_doc)
        new_user_id = str(result.inserted_id)

        role_doc = await self.repo.get_role_by_slug(payload.target_role)
        if not role_doc:
            raise AppException(status_code=404, code="ROLE_NOT_FOUND", message="Target role not found.")

        await self.repo.assign_role(
            user_id=new_user_id,
            role_id=str(role_doc["_id"]),
            role_slug=payload.target_role,
            assigned_by=creator_id,
            organization_id=org_id,
            expires_at=payload.expires_at,
        )
        
        # Send email with plaintext credentials to the original_email
        from app.services.email_service import EmailService
        email_svc = EmailService()
        await email_svc.send_subordinate_credentials_email(
            email=payload.original_email,
            login_email=generated_login_email,
            password=generated_password,
            role=payload.target_role
        )

        await self.log_action(
            actor_id=creator_id,
            actor_role=creator_role,
            action="user.create_subordinate",
            resource_type="user",
            resource_id=new_user_id,
            changes={"target_role": payload.target_role, "organization_id": org_id},
        )

        return {
            "user_id": new_user_id, 
            "login_email": generated_login_email, 
            "generated_password": generated_password,
            "role": payload.target_role, 
            "organization_id": org_id
        }

__all__ = ["RBACService"]
