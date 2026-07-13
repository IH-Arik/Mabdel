from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, Path, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.dependencies import (
    get_mongo_database,
    get_rbac_service,
    get_dashboard_rbac_service,
    require_permission,
    require_role,
)
from app.models.rbac_models import SubordinateAccountCreate

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str = "OK"


class RoleCreateRequest(BaseModel):
    name: str
    slug: str
    description: str = ""
    hierarchy_level: int = 10


class RoleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    hierarchy_level: int | None = None
    is_active: bool | None = None


class SetPermissionsRequest(BaseModel):
    permission_ids: list[str]


class AssignRoleRequest(BaseModel):
    user_id: str
    role_slug: str
    organization_id: str | None = None
    expires_at: datetime | None = None


class RevokeRoleRequest(BaseModel):
    user_id: str
    role_slug: str
    organization_id: str | None = None


def _actor(current_user: dict) -> tuple[str, str]:
    uid = str(current_user.get("_id") or current_user.get("id") or "")
    role = current_user.get("primary_role") or current_user.get("role") or "user"
    return uid, role


def _ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    return (forwarded.split(",")[0].strip() if forwarded else None) or request.client.host or ""


# ─── Permissions (read-only for all authorized users) ─────────────────────────


@router.get("/permissions", response_model=ApiResponse, summary="List all permissions grouped by module")
async def list_permissions(
    current_user: dict = Depends(require_permission("permissions", "view")),
    rbac=Depends(get_rbac_service),
):
    data = await rbac.list_permissions_by_module()
    return ApiResponse(data=data)


@router.get("/permissions/flat", response_model=ApiResponse, summary="List all permissions as flat list")
async def list_permissions_flat(
    current_user: dict = Depends(require_permission("permissions", "view")),
    rbac=Depends(get_rbac_service),
):
    data = await rbac.list_permissions()
    return ApiResponse(data=data)


# ─── Roles ────────────────────────────────────────────────────────────────────


@router.get("/roles", response_model=ApiResponse, summary="List all roles with their permissions")
async def list_roles(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(require_permission("roles", "view")),
    rbac=Depends(get_rbac_service),
):
    data = await rbac.list_roles(include_inactive)
    return ApiResponse(data=data)


@router.get("/roles/{role_id}", response_model=ApiResponse, summary="Get a specific role")
async def get_role(
    role_id: str = Path(...),
    current_user: dict = Depends(require_permission("roles", "view")),
    rbac=Depends(get_rbac_service),
):
    data = await rbac.get_role(role_id)
    return ApiResponse(data=data)


@router.post("/roles", response_model=ApiResponse, summary="Create a new custom role")
async def create_role(
    body: RoleCreateRequest,
    request: Request,
    current_user: dict = Depends(require_permission("roles", "create")),
    rbac=Depends(get_rbac_service),
):
    actor_id, actor_role = _actor(current_user)
    data = await rbac.create_role(
        name=body.name,
        slug=body.slug,
        description=body.description,
        hierarchy_level=body.hierarchy_level,
        created_by=actor_id,
    )
    await rbac.log_action(actor_id, actor_role, "role.create", "role", data.get("_id"), {"name": body.name}, _ip(request))
    return ApiResponse(data=data, message="Role created successfully.")


@router.patch("/roles/{role_id}", response_model=ApiResponse, summary="Update a role")
async def update_role(
    role_id: str = Path(...),
    body: RoleUpdateRequest = Body(...),
    request: Request = None,
    current_user: dict = Depends(require_permission("roles", "edit")),
    rbac=Depends(get_rbac_service),
):
    actor_id, actor_role = _actor(current_user)
    updates = body.model_dump(exclude_none=True)
    data = await rbac.update_role(role_id, updates, actor_id)
    await rbac.log_action(actor_id, actor_role, "role.update", "role", role_id, updates, _ip(request))
    return ApiResponse(data=data, message="Role updated.")


@router.delete("/roles/{role_id}", response_model=ApiResponse, summary="Delete a custom role")
async def delete_role(
    role_id: str = Path(...),
    request: Request = None,
    current_user: dict = Depends(require_permission("roles", "delete")),
    rbac=Depends(get_rbac_service),
):
    actor_id, actor_role = _actor(current_user)
    await rbac.delete_role(role_id)
    await rbac.log_action(actor_id, actor_role, "role.delete", "role", role_id, {}, _ip(request))
    return ApiResponse(message="Role deleted.")


# ─── Role ↔ Permission assignment ─────────────────────────────────────────────


@router.put("/roles/{role_id}/permissions", response_model=ApiResponse, summary="Set permissions for a role (replaces existing)")
async def set_role_permissions(
    role_id: str = Path(...),
    body: SetPermissionsRequest = Body(...),
    request: Request = None,
    current_user: dict = Depends(require_permission("roles", "manage")),
    rbac=Depends(get_rbac_service),
):
    actor_id, actor_role = _actor(current_user)
    data = await rbac.set_role_permissions(role_id, body.permission_ids, actor_id)
    await rbac.log_action(actor_id, actor_role, "role.set_permissions", "role", role_id, {"count": len(body.permission_ids)}, _ip(request))
    return ApiResponse(data=data, message="Permissions updated.")


# ─── User Role assignment ──────────────────────────────────────────────────────


@router.post("/users/assign-role", response_model=ApiResponse, summary="Assign a role to a user")
async def assign_role_to_user(
    body: AssignRoleRequest,
    request: Request,
    current_user: dict = Depends(require_permission("roles", "manage")),
    rbac=Depends(get_rbac_service),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    actor_id, actor_role = _actor(current_user)
    data = await rbac.assign_role_to_user(
        user_id=body.user_id,
        role_slug=body.role_slug,
        assigned_by=actor_id,
        assigned_by_role=actor_role,
        organization_id=body.organization_id,
        expires_at=body.expires_at,
    )
    if body.organization_id:
        from app.services.smartflow.smartflow_orchestrator import SmartFlowService
        await SmartFlowService(db).sync_user_global_chat_membership(body.user_id, body.organization_id)
    await rbac.log_action(actor_id, actor_role, "user.assign_role", "user", body.user_id, {"role": body.role_slug}, _ip(request))
    return ApiResponse(data=data, message="Role assigned successfully.")


@router.post("/users/revoke-role", response_model=ApiResponse, summary="Revoke a role from a user")
async def revoke_role_from_user(
    body: RevokeRoleRequest,
    request: Request,
    current_user: dict = Depends(require_permission("roles", "manage")),
    rbac=Depends(get_rbac_service),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    actor_id, actor_role = _actor(current_user)
    await rbac.revoke_role_from_user(
        user_id=body.user_id,
        role_slug=body.role_slug,
        revoked_by_role=actor_role,
        organization_id=body.organization_id,
    )
    if body.organization_id:
        from app.services.smartflow.smartflow_orchestrator import SmartFlowService
        await SmartFlowService(db).sync_user_global_chat_membership(body.user_id, body.organization_id)
    await rbac.log_action(actor_id, actor_role, "user.revoke_role", "user", body.user_id, {"role": body.role_slug}, _ip(request))
    return ApiResponse(message="Role revoked successfully.")


@router.get("/users/{user_id}/roles", response_model=ApiResponse, summary="Get all roles assigned to a user")
async def get_user_roles(
    user_id: str = Path(...),
    current_user: dict = Depends(require_permission("roles", "view")),
    rbac=Depends(get_rbac_service),
):
    data = await rbac.get_user_role_details(user_id)
    return ApiResponse(data=data)


@router.post("/roles/create-subordinate", response_model=ApiResponse)
async def create_subordinate_account(
    body: SubordinateAccountCreate,
    current_user: dict = Depends(require_role(["owner"])),
    rbac: Any = Depends(get_dashboard_rbac_service),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    data = await rbac.create_subordinate_account(current_user, body)
    user_id = data.get("user_id") if isinstance(data, dict) else None
    if user_id and current_user.get("organization_id"):
        from app.services.smartflow.smartflow_orchestrator import SmartFlowService
        await SmartFlowService(db).sync_user_global_chat_membership(user_id, current_user.get("organization_id"))
    return ApiResponse(data=data, message="Subordinate account created successfully.")


# ─── Audit Logs ───────────────────────────────────────────────────────────────


@router.get("/audit-logs", response_model=ApiResponse, summary="Get RBAC audit logs")
async def get_audit_logs(
    actor_id: str | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission("audit_logs", "view")),
    rbac=Depends(get_rbac_service),
):
    logs, total = await rbac.get_audit_logs(actor_id, resource_type, resource_id, limit, offset)
    return ApiResponse(data={"items": logs, "total": total, "limit": limit, "offset": offset})

