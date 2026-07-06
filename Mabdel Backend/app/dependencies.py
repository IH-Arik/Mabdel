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
from app.services.dashboard.rbac_service import RBACService as DashboardRBACService


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


from app.services.dashboard.dashboard_service import DashboardService

def get_rbac_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> RBACService:
    return RBACService(db)


def get_dashboard_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> DashboardService:
    return DashboardService(db)

def get_dashboard_rbac_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> DashboardRBACService:
    return DashboardRBACService(db)


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
            message="Access restricted. Please contact your administrator if you believe this is an error.",
            details={"required_roles": allowed_roles, "current_roles": list(role_slugs)},
        )

    return role_checker


# ─── Permission-based guard (new, database-driven) ───────────────────────────


_PERMISSION_MESSAGES: dict[str, str] = {
    # Contacts
    "contacts:view":    "You don't have access to view contacts. Please ask your administrator to grant you access.",
    "contacts:create":  "Creating contacts is not enabled for your account. Contact your administrator to request access.",
    "contacts:edit":    "You don't have permission to edit contacts. Please reach out to your administrator.",
    "contacts:delete":  "Deleting contacts requires elevated access. Please contact your administrator.",
    "contacts:export":  "Exporting contacts is restricted to authorized roles. Please contact your administrator.",
    # Messages
    "messages:view":    "You don't have access to the inbox. Please contact your administrator to enable messaging for your account.",
    "messages:send":    "Sending messages is not enabled for your account. Please contact your administrator.",
    # Calls
    "calls:view":       "Call logs are not accessible with your current permissions. Please contact your administrator.",
    "calls:listen":     "Listening to call recordings requires special access. Please contact your administrator.",
    "calls:manage":     "Managing calls is restricted. Please contact your administrator.",
    # Appointments
    "appointments:view":   "You don't have access to the calendar. Please contact your administrator.",
    "appointments:create": "Booking appointments is not enabled for your account. Please contact your administrator.",
    "appointments:edit":   "Editing appointments requires elevated access. Please contact your administrator.",
    "appointments:cancel": "Cancelling appointments requires elevated access. Please contact your administrator.",
    # Invoices
    "invoices:view":   "Invoice access is restricted. Please contact your administrator to request access.",
    "invoices:create": "Creating invoices is not enabled for your account. Please contact your administrator.",
    "invoices:edit":   "Editing invoices requires elevated access. Please contact your administrator.",
    # Bulk messaging
    "bulk_messaging:view":   "Bulk messaging campaigns are not accessible with your current permissions.",
    "bulk_messaging:create": "Creating bulk campaigns is not enabled for your account. Please contact your administrator.",
    "bulk_messaging:send":   "Sending bulk campaigns requires elevated access. Please contact your administrator.",
    # Social media
    "social_media:view": "Social media posts are not accessible with your current permissions.",
    "social_media:post": "Posting to social media is not enabled for your account. Please contact your administrator.",
    # AI tools
    "ai_tools:use": "AI tools are not enabled for your account. Please contact your administrator to request access.",
    # Chat groups
    "chat_groups:view":   "Chat group access is restricted. Please contact your administrator.",
    "chat_groups:manage": "Managing chat groups requires elevated access. Please contact your administrator.",
    # Integrations
    "integrations:view":   "Integrations are not accessible with your current permissions.",
    "integrations:manage": "Managing integrations requires elevated access. Please contact your administrator.",
}

_DEFAULT_PERMISSION_MESSAGE = (
    "You don't have permission to perform this action. "
    "Please contact your administrator if you need access."
)


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
            key = f"{module}:{action}"
            raise AppException(
                status_code=403,
                code="PERMISSION_DENIED",
                message=_PERMISSION_MESSAGES.get(key, _DEFAULT_PERMISSION_MESSAGE),
                details={"required": key},
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


# ─── Subscription guard ───────────────────────────────────────────────────────

import datetime as _dt
from bson import ObjectId as _OID


async def _check_subscription_active(user: dict, db: AsyncIOMotorDatabase) -> bool:
    """
    Returns True if the user has an active subscription or unexpired trial.
    Assigned members (manager/staff/assistant) inherit the owner's subscription.
    super_admin and admin are always allowed.
    """
    role = user.get("role", "user")

    # Platform admins always pass
    if role in ("super_admin", "admin"):
        return True

    # Assigned members check their owner's subscription
    if role in ("manager", "staff", "assistant"):
        uid = str(user.get("_id") or user.get("id") or "")
        assignment = await db.rbac_user_roles.find_one({"user_id": uid})
        if not assignment:
            return False
        owner_doc = await db.users.find_one(
            {"_id": _OID(assignment["assigned_by"]) if _OID.is_valid(assignment["assigned_by"]) else assignment["assigned_by"]}
        )
        if not owner_doc:
            return False
        return _is_status_active(owner_doc)

    return _is_status_active(user)


def _is_status_active(user_doc: dict) -> bool:
    status = user_doc.get("subscription_status", "none")
    if status == "active":
        return True
    if status == "trial":
        ends = user_doc.get("trial_ends_at")
        if ends and _dt.datetime.utcnow() < ends:
            return True
    return False


async def require_subscription(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    return current_user


__all__ = [
    "get_mongo_database",
    "get_current_user",
    "get_rbac_service",
    "get_dashboard_service",
    "require_role",
    "require_permission",
    "require_subscription",
    "require_org_scope",
    "rbac_context",
    "oauth2_scheme",
]
