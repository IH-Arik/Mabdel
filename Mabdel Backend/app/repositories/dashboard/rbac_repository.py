from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


def _to_str_id(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    for k in ("created_by", "assigned_by", "actor_id", "user_id", "role_id", "resource_id"):
        if k in out and isinstance(out[k], ObjectId):
            out[k] = str(out[k])
    return out


def _oid(value: str) -> ObjectId | str:
    return ObjectId(value) if ObjectId.is_valid(value) else value


class RBACRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.permissions = db.rbac_permissions
        self.roles = db.rbac_roles
        self.user_roles = db.rbac_user_roles
        self.audit_logs = db.rbac_audit_logs

    # ─── Permissions ──────────────────────────────────────────────────────────

    async def get_all_permissions(self) -> list[dict]:
        cursor = self.permissions.find({}).sort("module", 1)
        return [_to_str_id(d) async for d in cursor]

    async def get_permission_by_id(self, permission_id: str) -> dict | None:
        doc = await self.permissions.find_one({"_id": _oid(permission_id)})
        return _to_str_id(doc)

    async def get_permissions_by_ids(self, ids: list[str]) -> list[dict]:
        oids = [_oid(i) for i in ids]
        cursor = self.permissions.find({"_id": {"$in": oids}})
        return [_to_str_id(d) async for d in cursor]

    async def get_permission_by_module_action(self, module: str, action: str) -> dict | None:
        doc = await self.permissions.find_one({"module": module, "action": action})
        return _to_str_id(doc)

    async def upsert_permission(self, module: str, action: str, label: str, description: str = "", is_system: bool = True) -> str:
        now = datetime.utcnow()
        result = await self.permissions.find_one_and_update(
            {"module": module, "action": action},
            {"$setOnInsert": {"created_at": now, "is_system": is_system}, "$set": {"label": label, "description": description}},
            upsert=True,
            return_document=True,
        )
        return str(result["_id"])

    async def delete_permission(self, permission_id: str) -> bool:
        res = await self.permissions.delete_one({"_id": _oid(permission_id), "is_system": False})
        return res.deleted_count > 0

    # ─── Roles ────────────────────────────────────────────────────────────────

    async def get_all_roles(self, include_inactive: bool = False) -> list[dict]:
        query: dict = {} if include_inactive else {"is_active": True}
        cursor = self.roles.find(query).sort("hierarchy_level", -1)
        return [_to_str_id(d) async for d in cursor]

    async def get_role_by_id(self, role_id: str) -> dict | None:
        doc = await self.roles.find_one({"_id": _oid(role_id)})
        return _to_str_id(doc)

    async def get_role_by_slug(self, slug: str) -> dict | None:
        doc = await self.roles.find_one({"slug": slug})
        return _to_str_id(doc)

    async def create_role(self, data: dict) -> str:
        now = datetime.utcnow()
        data.setdefault("created_at", now)
        data.setdefault("updated_at", now)
        data.setdefault("is_active", True)
        data.setdefault("permission_ids", [])
        result = await self.roles.insert_one(data)
        return str(result.inserted_id)

    async def update_role(self, role_id: str, updates: dict) -> bool:
        updates["updated_at"] = datetime.utcnow()
        res = await self.roles.update_one({"_id": _oid(role_id)}, {"$set": updates})
        return res.modified_count > 0

    async def set_role_permissions(self, role_id: str, permission_ids: list[str]) -> bool:
        res = await self.roles.update_one(
            {"_id": _oid(role_id)},
            {"$set": {"permission_ids": permission_ids, "updated_at": datetime.utcnow()}},
        )
        return res.modified_count > 0

    async def add_role_permission(self, role_id: str, permission_id: str) -> bool:
        res = await self.roles.update_one(
            {"_id": _oid(role_id)},
            {"$addToSet": {"permission_ids": permission_id}, "$set": {"updated_at": datetime.utcnow()}},
        )
        return res.modified_count > 0

    async def remove_role_permission(self, role_id: str, permission_id: str) -> bool:
        res = await self.roles.update_one(
            {"_id": _oid(role_id)},
            {"$pull": {"permission_ids": permission_id}, "$set": {"updated_at": datetime.utcnow()}},
        )
        return res.modified_count > 0

    async def delete_role(self, role_id: str) -> bool:
        res = await self.roles.delete_one({"_id": _oid(role_id), "is_system": False})
        return res.deleted_count > 0

    async def slug_exists(self, slug: str, exclude_id: str | None = None) -> bool:
        query: dict = {"slug": slug}
        if exclude_id:
            query["_id"] = {"$ne": _oid(exclude_id)}
        return bool(await self.roles.find_one(query, projection={"_id": 1}))

    # ─── User Role Assignments ────────────────────────────────────────────────

    async def get_user_roles(self, user_id: str) -> list[dict]:
        now = datetime.utcnow()
        cursor = self.user_roles.find({
            "user_id": user_id,
            "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}],
        })
        return [_to_str_id(d) async for d in cursor]

    async def get_users_with_role(self, role_slug: str, organization_id: str | None = None) -> list[dict]:
        query: dict = {"role_slug": role_slug}
        if organization_id:
            query["organization_id"] = organization_id
        cursor = self.user_roles.find(query)
        return [_to_str_id(d) async for d in cursor]

    async def assign_role(
        self,
        user_id: str,
        role_id: str,
        role_slug: str,
        assigned_by: str,
        organization_id: str | None = None,
        expires_at: datetime | None = None,
    ) -> str:
        now = datetime.utcnow()
        doc = {
            "user_id": user_id,
            "role_id": role_id,
            "role_slug": role_slug,
            "organization_id": organization_id,
            "assigned_by": assigned_by,
            "assigned_at": now,
            "expires_at": expires_at,
        }
        result = await self.user_roles.insert_one(doc)
        return str(result.inserted_id)

    async def revoke_role(self, user_id: str, role_slug: str, organization_id: str | None = None) -> bool:
        query: dict = {"user_id": user_id, "role_slug": role_slug}
        if organization_id is not None:
            query["organization_id"] = organization_id
        res = await self.user_roles.delete_many(query)
        return res.deleted_count > 0

    async def revoke_all_roles(self, user_id: str) -> int:
        res = await self.user_roles.delete_many({"user_id": user_id})
        return res.deleted_count

    async def has_role(self, user_id: str, role_slug: str) -> bool:
        now = datetime.utcnow()
        doc = await self.user_roles.find_one({
            "user_id": user_id,
            "role_slug": role_slug,
            "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}],
        })
        return doc is not None

    # ─── Effective Permission Lookup ──────────────────────────────────────────

    async def get_user_effective_permissions(self, user_id: str) -> set[str]:
        """Return set of 'module:action' strings for a user based on all their roles."""
        user_role_docs = await self.get_user_roles(user_id)
        if not user_role_docs:
            return set()

        role_ids = list({r["role_id"] for r in user_role_docs})
        oids = [_oid(rid) for rid in role_ids]

        roles_cursor = self.roles.find({"_id": {"$in": oids}, "is_active": True})
        all_perm_ids: set[str] = set()
        async for role in roles_cursor:
            for pid in role.get("permission_ids", []):
                all_perm_ids.add(str(pid))

        if not all_perm_ids:
            return set()

        perm_oids = [_oid(pid) for pid in all_perm_ids]
        perms_cursor = self.permissions.find({"_id": {"$in": perm_oids}})
        result: set[str] = set()
        async for perm in perms_cursor:
            result.add(f"{perm['module']}:{perm['action']}")
        return result

    async def get_user_highest_role(self, user_id: str) -> dict | None:
        """Return the role document with highest hierarchy_level for a user."""
        from app.models.rbac_models import ROLE_HIERARCHY

        user_role_docs = await self.get_user_roles(user_id)
        if not user_role_docs:
            return None

        role_slugs = [r["role_slug"] for r in user_role_docs]
        best_slug = max(role_slugs, key=lambda s: ROLE_HIERARCHY.get(s, 0))
        return await self.get_role_by_slug(best_slug)

    # ─── Audit Logs ───────────────────────────────────────────────────────────

    async def write_audit_log(self, log: dict) -> str:
        log.setdefault("created_at", datetime.utcnow())
        result = await self.audit_logs.insert_one(log)
        return str(result.inserted_id)

    async def get_audit_logs(
        self,
        actor_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        query: dict = {}
        if actor_id:
            query["actor_id"] = actor_id
        if resource_type:
            query["resource_type"] = resource_type
        if resource_id:
            query["resource_id"] = resource_id

        total = await self.audit_logs.count_documents(query)
        cursor = self.audit_logs.find(query).sort("created_at", -1).skip(offset).limit(limit)
        docs = [_to_str_id(d) async for d in cursor]
        return docs, total


__all__ = ["RBACRepository"]
