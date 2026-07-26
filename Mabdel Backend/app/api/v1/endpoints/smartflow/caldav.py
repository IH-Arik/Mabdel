from __future__ import annotations

from fastapi import Depends, status

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database, require_permission
from app.schemas.smartflow import CalDAVConnectRequest
from app.services.smartflow.caldav_service import CalDAVService
from app.utils.responses import success_response

from ._router import router


def get_caldav_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> CalDAVService:
    return CalDAVService(db)


@router.get("/integrations/caldav/status")
async def get_caldav_status(
    current_user: dict = Depends(require_permission("integrations", "view")),
    service: CalDAVService = Depends(get_caldav_service),
) -> dict:
    data = await service.get_status(str(current_user["_id"]))
    return success_response(data=data, message="Apple Calendar status fetched successfully.")


@router.post("/integrations/caldav/connect", status_code=status.HTTP_201_CREATED)
async def connect_caldav(
    payload: CalDAVConnectRequest,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: CalDAVService = Depends(get_caldav_service),
) -> dict:
    data = await service.connect(
        str(current_user["_id"]), payload.username, payload.app_password, payload.server_url
    )
    return success_response(data=data, message="Apple Calendar connected successfully.")


@router.post("/integrations/caldav/sync")
async def sync_caldav(
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: CalDAVService = Depends(get_caldav_service),
) -> dict:
    data = await service.pull_changes(str(current_user["_id"]))
    return success_response(data=data, message="Apple Calendar sync completed.")


@router.delete("/integrations/caldav")
async def disconnect_caldav(
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: CalDAVService = Depends(get_caldav_service),
) -> dict:
    await service.disconnect(str(current_user["_id"]))
    return success_response(data={"disconnected": True}, message="Apple Calendar disconnected successfully.")
