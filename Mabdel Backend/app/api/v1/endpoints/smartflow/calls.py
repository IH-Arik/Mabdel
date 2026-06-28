from __future__ import annotations

from fastapi import Depends, Query, status

from app.dependencies import get_current_user, require_permission, require_subscription
from app.schemas.smartflow import (
    CallAISummaryUpdateRequest,
    CallLogCreateRequest,
    CallLogUpdateRequest,
    CallRecordingUpdateRequest,
    CallTranscriptUpdateRequest,
    OutboundCallRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/calls")
async def list_calls(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
    contact_id: str | None = None,
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_call_logs(str(current_user["_id"]), page, page_size, status_filter, search, contact_id)
    return success_response(data=data, message="Call logs fetched successfully.")


@router.post("/calls", status_code=status.HTTP_201_CREATED)
async def create_call_log(
    payload: CallLogCreateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_call_log(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Call log created successfully.")


@router.post("/calls/outbound", status_code=status.HTTP_201_CREATED)
async def create_outbound_call(
    payload: OutboundCallRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_outbound_call(str(current_user["_id"]), payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Outbound call initiated successfully.")


@router.get("/calls/summary")
async def get_call_summary(
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_summary(str(current_user["_id"]))
    return success_response(data=data, message="Call analytics fetched successfully.")


@router.get("/calls/{call_id}")
async def get_call_log(
    call_id: str,
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_log(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call log fetched successfully.")


@router.patch("/calls/{call_id}")
async def update_call_log(
    call_id: str,
    payload: CallLogUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_log(str(current_user["_id"]), call_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Call log updated successfully.")


@router.get("/calls/{call_id}/transcript")
async def get_call_transcript(
    call_id: str,
    current_user: dict = Depends(require_permission("calls", "listen")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_transcript(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call transcript fetched successfully.")


@router.put("/calls/{call_id}/transcript")
async def update_call_transcript(
    call_id: str,
    payload: CallTranscriptUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_transcript(str(current_user["_id"]), call_id, payload.model_dump())
    return success_response(data=data, message="Call transcript updated successfully.")


@router.get("/calls/{call_id}/ai-summary")
async def get_call_ai_summary(
    call_id: str,
    current_user: dict = Depends(require_permission("calls", "listen")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_ai_summary(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call AI summary fetched successfully.")


@router.put("/calls/{call_id}/ai-summary")
async def update_call_ai_summary(
    call_id: str,
    payload: CallAISummaryUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_ai_summary(str(current_user["_id"]), call_id, payload.model_dump())
    return success_response(data=data, message="Call AI summary updated successfully.")


@router.post("/calls/{call_id}/callback")
async def request_call_callback(
    call_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.request_call_callback(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Callback requested successfully.")


@router.get("/calls/{call_id}/recording")
async def get_call_recording(
    call_id: str,
    current_user: dict = Depends(require_permission("calls", "listen")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_recording(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call recording fetched successfully.")


@router.put("/calls/{call_id}/recording")
async def update_call_recording(
    call_id: str,
    payload: CallRecordingUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_recording(str(current_user["_id"]), call_id, payload.model_dump())
    return success_response(data=data, message="Call recording updated successfully.")
