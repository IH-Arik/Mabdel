from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ─── Permission ───────────────────────────────────────────────────────────────

RBAC_MODULES = Literal[
    "users",
    "admins",
    "owners",
    "supervisors",
    "staff",
    "roles",
    "permissions",
    "reports",
    "earnings",
    "subscriptions",
    "content",
    "activities",
    "events",
    "categories",
    "ai_logs",
    "settings",
    "billing",
    "organizations",
    "audit_logs",
]

RBAC_ACTIONS = Literal["view", "create", "edit", "delete", "approve", "export", "manage"]

ROLE_HIERARCHY: dict[str, int] = {
    "super_admin": 100,
    "admin": 80,
    "owner": 60,
    "supervisor": 40,
    "staff": 20,
    "user": 10,
}


class PermissionModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    module: str
    action: str
    label: str
    description: str = ""
    is_system: bool = True  # system permissions cannot be deleted
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Role ─────────────────────────────────────────────────────────────────────


class RoleModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    slug: str  # e.g. "super_admin", "admin", "owner", "supervisor", "staff"
    description: str = ""
    hierarchy_level: int = 10  # higher = more authority
    is_system: bool = False  # system roles cannot be deleted
    is_active: bool = True
    permission_ids: list[str] = []  # list of PermissionModel IDs
    created_by: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── User Role Assignment ──────────────────────────────────────────────────────


class UserRoleModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    user_id: str
    role_id: str
    role_slug: str
    # Optional scope — if set, role applies only within this organization
    organization_id: str | None = None
    assigned_by: str | None = None
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None  # temporary role grants


# ─── Audit Log ────────────────────────────────────────────────────────────────


class AuditLogModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    actor_id: str  # user who performed the action
    actor_role: str
    action: str  # e.g. "user.block", "role.assign", "permission.update"
    resource_type: str  # e.g. "user", "role", "permission"
    resource_id: str | None = None
    changes: dict = Field(default_factory=dict)
    ip_address: str | None = None
    user_agent: str | None = None
    outcome: Literal["success", "denied", "error"] = "success"
    created_at: datetime = Field(default_factory=datetime.utcnow)


__all__ = [
    "PermissionModel",
    "RoleModel",
    "UserRoleModel",
    "AuditLogModel",
    "ROLE_HIERARCHY",
    "RBAC_MODULES",
    "RBAC_ACTIONS",
]
