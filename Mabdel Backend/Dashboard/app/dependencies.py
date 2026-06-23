from __future__ import annotations

from typing import Callable

from bson import ObjectId
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from Dashboard.app.core.database import get_database
from Dashboard.app.core.exceptions import AppException
from Dashboard.app.core.security import decode_token
from Dashboard.app.services.dashboard_service import DashboardService


async def get_mongo_database() -> AsyncIOMotorDatabase:
    return await get_database()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/admin/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    claims = decode_token(token)
    if claims.get("type") != "access":
        raise AppException(status_code=401, code="INVALID_ACCESS_TOKEN", message="Invalid access token type.")

    user_id = claims.get("sub")
    if not user_id:
        raise AppException(status_code=401, code="INVALID_TOKEN", message="Token subject is missing.")

    query_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    user = await db.users.find_one({"_id": query_id})
    if not user:
        raise AppException(status_code=401, code="USER_NOT_FOUND", message="User for this token no longer exists.")
    return user


def _get_rbac(db: AsyncIOMotorDatabase) -> "RBACService":  # noqa: F821
    from app.services.rbac_service import RBACService
    return RBACService(db)


def _user_id(user: dict) -> str:
    return str(user.get("_id") or user.get("id") or "")


# ─── Role guard ───────────────────────────────────────────────────────────────


def require_role(allowed_roles: list[str]) -> Callable:
    from app.models.rbac_models import ROLE_HIERARCHY
    min_level = min((ROLE_HIERARCHY.get(r, 0) for r in allowed_roles), default=0)

    async def role_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_mongo_database),
    ) -> dict:
        rbac = _get_rbac(db)
        role_slugs = await rbac.get_user_role_slugs(_user_id(current_user), current_user.get("role", "user"))

        if role_slugs & set(allowed_roles):
            return current_user
        if rbac.highest_hierarchy(role_slugs) > min_level:
            return current_user

        raise AppException(
            status_code=403,
            code="FORBIDDEN",
            message="You do not have permission to access this resource.",
            details={"required_roles": allowed_roles, "current_roles": list(role_slugs)},
        )

    return role_checker


# ─── Permission guard ─────────────────────────────────────────────────────────


def require_permission(module: str, action: str) -> Callable:
    async def permission_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncIOMotorDatabase = Depends(get_mongo_database),
    ) -> dict:
        rbac = _get_rbac(db)
        perms = await rbac.get_user_permissions(_user_id(current_user), current_user.get("role", "user"))

        if not rbac.has_permission(perms, module, action):
            raise AppException(
                status_code=403,
                code="PERMISSION_DENIED",
                message=f"You do not have '{module}:{action}' permission.",
                details={"required": f"{module}:{action}"},
            )
        return current_user

    return permission_checker


# ─── RBAC context helper ──────────────────────────────────────────────────────


async def rbac_context(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    rbac = _get_rbac(db)
    uid = _user_id(current_user)
    legacy = current_user.get("role", "user")
    request.state.rbac_perms = await rbac.get_user_permissions(uid, legacy)
    request.state.rbac_roles = await rbac.get_user_role_slugs(uid, legacy)
    request.state.current_user = current_user
    return current_user


def get_dashboard_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> DashboardService:
    return DashboardService(db)


def get_rbac_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)):
    from app.services.rbac_service import RBACService
    return RBACService(db)


__all__ = [
    "get_mongo_database",
    "get_current_user",
    "require_role",
    "require_permission",
    "rbac_context",
    "get_dashboard_service",
    "get_rbac_service",
    "oauth2_scheme",
]
