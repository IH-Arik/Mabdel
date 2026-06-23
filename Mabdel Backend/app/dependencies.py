from __future__ import annotations

from typing import Callable

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.exceptions import AppException
from app.core.security import decode_token
from app.models.rbac_models import ROLE_HIERARCHY
from app.repositories.auth_repository import AuthRepository
from app.services.rbac_service import RBACService


async def get_mongo_database() -> AsyncIOMotorDatabase:
    return await get_database()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    claims = decode_token(token)
    if claims.get("type") != "access":
        raise AppException(status_code=401, code="INVALID_ACCESS_TOKEN", message="Invalid access token type.")

    user = await AuthRepository(db).get_user_by_id(claims.get("sub", ""))
    if not user:
        raise AppException(status_code=401, code="USER_NOT_FOUND", message="User for this token no longer exists.")
    return user


def get_rbac_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> RBACService:
    return RBACService(db)


# ─── Role-based guard (backward-compatible + hierarchy-aware) ─────────────────


def require_role(allowed_roles: list[str]) -> Callable:
    """Guard: user must have one of the listed role slugs (or higher hierarchy)."""
    min_level = min((ROLE_HIERARCHY.get(r, 0) for r in allowed_roles), default=0)

    async def role_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_mongo_database),
    ) -> dict:
        user_id = str(current_user.get("_id") or current_user.get("id") or "")
        legacy_role = current_user.get("role", "user")

        rbac = RBACService(db)
        role_slugs = await rbac.get_user_role_slugs(user_id, legacy_role)

        # Allow if any role slug is in allowed list OR has high-enough hierarchy
        if role_slugs & set(allowed_roles):
            return current_user

        user_level = rbac.highest_hierarchy(role_slugs)
        if user_level > min_level:
            return current_user

        raise AppException(
            status_code=403,
            code="FORBIDDEN",
            message="You do not have permission to access this resource.",
            details={"required_roles": allowed_roles, "current_roles": list(role_slugs)},
        )

    return role_checker


# ─── Permission-based guard (new, database-driven) ───────────────────────────


def require_permission(module: str, action: str) -> Callable:
    """Guard: user must have the specified module:action permission."""

    async def permission_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_mongo_database),
    ) -> dict:
        user_id = str(current_user.get("_id") or current_user.get("id") or "")
        legacy_role = current_user.get("role", "user")

        rbac = RBACService(db)
        perms = await rbac.get_user_permissions(user_id, legacy_role)

        if not rbac.has_permission(perms, module, action):
            raise AppException(
                status_code=403,
                code="PERMISSION_DENIED",
                message=f"You do not have '{module}:{action}' permission.",
                details={"required": f"{module}:{action}"},
            )
        return current_user

    return permission_checker


# ─── Scope guard: owner can only access their own organization ────────────────


def require_org_scope(allow_global_roles: list[str] | None = None) -> Callable:
    """
    Ensures org-scoped roles (owner/supervisor/staff) can only access their
    own organization's data. Roles in allow_global_roles bypass the restriction.
    """
    _global = set(allow_global_roles or ["super_admin", "admin"])

    async def checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_mongo_database),
    ) -> dict:
        user_id = str(current_user.get("_id") or current_user.get("id") or "")
        legacy_role = current_user.get("role", "user")

        rbac = RBACService(db)
        role_slugs = await rbac.get_user_role_slugs(user_id, legacy_role)

        if not (role_slugs & _global):
            if not current_user.get("organization_id"):
                raise AppException(
                    status_code=403,
                    code="NO_ORG_SCOPE",
                    message="Your account is not associated with an organization.",
                )
        return current_user

    return checker


# ─── Helper: attach RBAC context to request for downstream use ───────────────


async def rbac_context(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    """Attach resolved permissions and role slugs to request.state for reuse."""
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    legacy_role = current_user.get("role", "user")

    rbac = RBACService(db)
    perms = await rbac.get_user_permissions(user_id, legacy_role)
    role_slugs = await rbac.get_user_role_slugs(user_id, legacy_role)

    request.state.rbac_perms = perms
    request.state.rbac_roles = role_slugs
    request.state.current_user = current_user
    return current_user


__all__ = [
    "get_mongo_database",
    "get_current_user",
    "get_rbac_service",
    "require_role",
    "require_permission",
    "require_org_scope",
    "rbac_context",
    "oauth2_scheme",
]
