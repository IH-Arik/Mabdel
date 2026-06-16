from __future__ import annotations

from fastapi import Depends, Query, status

from app.dependencies import get_current_user
from app.schemas.smartflow import (
    GroupCreateRequest,
    GroupInviteRequest,
    GroupMemberAddRequest,
    GroupMemberRoleUpdateRequest,
    GroupUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/groups")
async def list_groups(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_groups(str(current_user["_id"]), page, page_size, search)
    return success_response(data=data, message="Groups fetched successfully.")


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_group(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Group created successfully.")


@router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_group(str(current_user["_id"]), group_id)
    return success_response(data=data, message="Group fetched successfully.")


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: str,
    payload: GroupUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_group(str(current_user["_id"]), group_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Group updated successfully.")


@router.post("/groups/{group_id}/members")
async def add_group_members(
    group_id: str,
    payload: GroupMemberAddRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.add_group_members(str(current_user["_id"]), group_id, payload.model_dump())
    return success_response(data=data, message="Group members added successfully.")


@router.patch("/groups/{group_id}/members/{member_id}")
async def update_group_member_role(
    group_id: str,
    member_id: str,
    payload: GroupMemberRoleUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_group_member_role(str(current_user["_id"]), group_id, member_id, payload.role)
    return success_response(data=data, message="Group member updated successfully.")


@router.delete("/groups/{group_id}/members/{member_id}")
async def remove_group_member(
    group_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.remove_group_member(str(current_user["_id"]), group_id, member_id)
    return success_response(data=data, message="Group member removed successfully.")


@router.post("/groups/{group_id}/invites")
async def invite_group_member(
    group_id: str,
    payload: GroupInviteRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.invite_group_member(str(current_user["_id"]), group_id, payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Group invite created successfully.")


@router.delete("/groups/{group_id}/invites/{invite_id}")
async def cancel_group_invite(
    group_id: str,
    invite_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.cancel_group_invite(str(current_user["_id"]), group_id, invite_id)
    return success_response(data=data, message="Group invite cancelled successfully.")


@router.post("/groups/{group_id}/leave")
async def leave_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.leave_group(str(current_user["_id"]), group_id)
    return success_response(data=data, message="Group left successfully.")


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_group(str(current_user["_id"]), group_id)
    return success_response(data={"deleted": True}, message="Group deleted successfully.")
