from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database, require_role
from app.schemas.demo_request import DemoRequestReplyRequest, DemoRequestStatusUpdateRequest
from app.services.demo_request_service import DemoRequestService

router = APIRouter()

ADMIN_ROLES = ["super_admin", "admin"]


def get_demo_request_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> DemoRequestService:
    return DemoRequestService(db)


@router.get("")
async def list_demo_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: DemoRequestService = Depends(get_demo_request_service),
) -> dict:
    data = await service.list_demo_requests(page, page_size, status_filter)
    return {"success": True, "data": data}


@router.get("/{request_id}")
async def get_demo_request(
    request_id: str,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: DemoRequestService = Depends(get_demo_request_service),
) -> dict:
    data = await service.get_demo_request(request_id)
    return {"success": True, "data": data}


@router.post("/{request_id}/reply")
async def reply_to_demo_request(
    request_id: str,
    body: DemoRequestReplyRequest,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: DemoRequestService = Depends(get_demo_request_service),
) -> dict:
    admin_name = current_user.get("full_name") or current_user.get("name") or current_user.get("email", "Admin")
    data = await service.reply_to_demo_request(
        request_id, str(current_user["_id"]), admin_name, body.message
    )
    return {"success": True, "message": "Reply sent.", "data": data}


@router.patch("/{request_id}/status")
async def update_demo_request_status(
    request_id: str,
    body: DemoRequestStatusUpdateRequest,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: DemoRequestService = Depends(get_demo_request_service),
) -> dict:
    data = await service.update_status(request_id, body.status)
    return {"success": True, "message": "Status updated.", "data": data}
