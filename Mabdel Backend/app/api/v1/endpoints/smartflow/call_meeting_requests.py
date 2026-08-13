from __future__ import annotations

from fastapi import Depends, Query

from app.dependencies import require_permission
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/calls/meeting-requests")
async def list_call_meeting_requests(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """Meetings the AI phone agent proposed to a caller, awaiting a team member's
    approval — the AI never books these on its own."""
    data = await service.list_call_meeting_requests(str(current_user["_id"]), page, page_size, status_filter)
    return success_response(data=data, message="Call meeting requests fetched successfully.")


@router.post("/calls/meeting-requests/{request_id}/accept")
async def accept_call_meeting_request(
    request_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.accept_call_meeting_request(str(current_user["_id"]), request_id)
    return success_response(data=data, message="Meeting confirmed.")


@router.post("/calls/meeting-requests/{request_id}/decline")
async def decline_call_meeting_request(
    request_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.decline_call_meeting_request(str(current_user["_id"]), request_id)
    return success_response(data=data, message="Meeting request declined.")
