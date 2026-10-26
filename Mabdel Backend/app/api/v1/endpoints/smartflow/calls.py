from __future__ import annotations

from fastapi import Depends, File, Query, UploadFile, status
from pydantic import BaseModel

from app.dependencies import require_permission, require_subscription
from app.schemas.smartflow import (
    AICallSettingsUpdateRequest,
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


@router.get("/ai-call-settings")
async def get_ai_call_settings(
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """The business's AI phone persona — assistant name, voice, custom greetings,
    extra instructions and the keypad language menu. Org-wide, like business hours."""
    data = await service.get_ai_call_settings(str(current_user["_id"]))
    return success_response(data=data, message="AI call settings fetched successfully.")


@router.patch("/ai-call-settings")
async def update_ai_call_settings(
    payload: AICallSettingsUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    # exclude_unset so a PATCH of one field leaves the rest alone, while still letting
    # an explicit null clear a custom greeting back to the built-in translated one.
    data = await service.update_ai_call_settings(
        str(current_user["_id"]), payload.model_dump(exclude_unset=True)
    )
    return success_response(data=data, message="AI call settings updated successfully.")


class KnowledgeApprovalRequest(BaseModel):
    approved: bool


@router.post("/ai-call-settings/documents", status_code=status.HTTP_201_CREATED)
async def upload_receptionist_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    from app.services.smartflow.receptionist_documents import MAX_DOCUMENT_BYTES
    content = await file.read(MAX_DOCUMENT_BYTES + 1)
    data = await service.ai_call_settings_service.upload_knowledge_document(str(current_user["_id"]), file.filename or "", content)
    return success_response(data=data, message="Review extracted text before approving for the receptionist.")


@router.get("/ai-call-settings/documents/{document_id}")
async def preview_receptionist_document(
    document_id: str,
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.ai_call_settings_service.get_knowledge_document(str(current_user["_id"]), document_id)
    return success_response(data=data)


@router.patch("/ai-call-settings/documents/{document_id}")
async def approve_receptionist_document(
    document_id: str, payload: KnowledgeApprovalRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.ai_call_settings_service.approve_knowledge_document(str(current_user["_id"]), document_id, payload.approved)
    return success_response(data=data)


@router.delete("/ai-call-settings/documents/{document_id}")
async def delete_receptionist_document(
    document_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.ai_call_settings_service.delete_knowledge_document(str(current_user["_id"]), document_id)
    return success_response(message="Document removed.")


@router.get("/calls")
async def list_calls(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
    contact_id: str | None = None,
    disposition: str | None = None,
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_call_logs(str(current_user["_id"]), page, page_size, status_filter, search, contact_id, disposition)
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
    return success_response(data=data, message="Awaiting approval; no call has been placed." if data.get("approval_required") else "Outbound call initiated successfully.")


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
