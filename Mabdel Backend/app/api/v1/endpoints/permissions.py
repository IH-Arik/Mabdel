from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.common import ApiErrorResponse, ApiResponse
from app.schemas.permissions import (
    AcceptAllPermissionsRequest,
    PermissionsResponseData,
    PermissionsUpdateRequest,
)
from app.services.permissions_service import PermissionsService
from app.utils.responses import success_response

router = APIRouter(prefix="/app/permissions", tags=["Permissions"])


def get_permissions_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> PermissionsService:
    return PermissionsService(db)


@router.get(
    "",
    response_model=ApiResponse[PermissionsResponseData],
    responses={400: {"model": ApiErrorResponse}},
    summary="Get saved permission preferences",
)
async def get_permissions(
    user_id: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
    service: PermissionsService = Depends(get_permissions_service),
) -> dict:
    data = await service.get_preferences(user_id=user_id, device_id=device_id)
    return success_response(data=data.model_dump(), message="Permission preferences fetched successfully.")


@router.put(
    "",
    response_model=ApiResponse[PermissionsResponseData],
    responses={400: {"model": ApiErrorResponse}},
    summary="Update permission preferences",
)
async def update_permissions(
    payload: PermissionsUpdateRequest,
    service: PermissionsService = Depends(get_permissions_service),
) -> dict:
    data = await service.update_preferences(
        user_id=payload.user_id,
        device_id=payload.device_id,
        microphone_enabled=payload.microphone_enabled,
        notifications_enabled=payload.notifications_enabled,
        contacts_enabled=payload.contacts_enabled,
    )
    return success_response(data=data.model_dump(), message="Permission preferences updated successfully.")


@router.post(
    "/accept-all",
    response_model=ApiResponse[PermissionsResponseData],
    responses={400: {"model": ApiErrorResponse}},
    summary="Accept all permission toggles",
)
async def accept_all_permissions(
    payload: AcceptAllPermissionsRequest,
    service: PermissionsService = Depends(get_permissions_service),
) -> dict:
    data = await service.accept_all(user_id=payload.user_id, device_id=payload.device_id)
    return success_response(data=data.model_dump(), message="All permissions enabled successfully.")
