from __future__ import annotations

from fastapi import Depends, Query

from app.dependencies import get_current_user
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/notifications")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_notifications(str(current_user["_id"]), page, page_size, unread_only)
    return success_response(data=data, message="Notifications fetched successfully.")


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.mark_all_notifications_read(str(current_user["_id"]))
    return success_response(data=data, message="All notifications marked as read.")


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.mark_notification_read(str(current_user["_id"]), notification_id)
    return success_response(data=data, message="Notification marked as read.")


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.delete_notification(str(current_user["_id"]), notification_id)
    return success_response(data=data, message="Notification deleted successfully.")


@router.post("/notifications/dispatch-pending")
async def dispatch_pending_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.dispatch_pending_push_notifications(str(current_user["_id"]), limit=limit)
    return success_response(data={"items": data}, message="Pending push notifications dispatched successfully.")
