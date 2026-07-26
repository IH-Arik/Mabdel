from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database, require_role
from app.schemas.meeting_request import MeetingProposeRequest
from app.services.meeting_request_service import MeetingRequestService

router = APIRouter()

ADMIN_ROLES = ["super_admin", "admin"]


def get_meeting_request_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> MeetingRequestService:
    return MeetingRequestService(db)


def _admin_name(current_user: dict) -> str:
    return current_user.get("full_name") or current_user.get("name") or current_user.get("email", "Admin")


@router.get("")
async def list_meeting_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.list_meeting_requests(page, page_size, status_filter)
    return {"success": True, "data": data}


@router.get("/{request_id}")
async def get_meeting_request(
    request_id: str,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.get_meeting_request(request_id)
    return {"success": True, "data": data}


@router.post("/{request_id}/accept")
async def accept_meeting_request(
    request_id: str,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.accept_meeting_request(request_id, str(current_user["_id"]), _admin_name(current_user))
    return {"success": True, "message": "Meeting confirmed.", "data": data}


@router.post("/{request_id}/propose")
async def propose_meeting_time(
    request_id: str,
    body: MeetingProposeRequest,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.propose_new_time(
        request_id,
        str(current_user["_id"]),
        _admin_name(current_user),
        body.proposed_start,
        body.proposed_end,
        body.note,
    )
    return {"success": True, "message": "New time proposed.", "data": data}


@router.post("/{request_id}/decline")
async def decline_meeting_request(
    request_id: str,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.decline_meeting_request(request_id, str(current_user["_id"]))
    return {"success": True, "message": "Meeting request declined.", "data": data}
