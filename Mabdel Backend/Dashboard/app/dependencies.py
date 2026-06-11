from __future__ import annotations

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from Dashboard.app.core.database import get_database
from Dashboard.app.core.exceptions import AppException
from Dashboard.app.core.security import decode_token
from Dashboard.app.services.dashboard_service import DashboardService


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/admin/auth/login")


async def get_mongo_database() -> AsyncIOMotorDatabase:
    return await get_database()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    from bson import ObjectId

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


def require_role(allowed_roles: list[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise AppException(
                status_code=403,
                code="FORBIDDEN",
                message="You do not have permission to access this resource.",
                details={"required_roles": allowed_roles, "current_role": current_user.get("role")},
            )
        return current_user

    return role_checker


def get_dashboard_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> DashboardService:
    return DashboardService(db)


__all__ = ["get_mongo_database", "get_current_user", "require_role", "get_dashboard_service", "oauth2_scheme"]
