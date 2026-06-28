from __future__ import annotations

from fastapi import Depends, Query, status

from app.dependencies import get_current_user, require_permission, require_subscription
from app.schemas.smartflow import (
    BulkMessageCreateRequest,
    BulkMessageUpdateRequest,
    BulkRecipientValidationRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.post("/bulk-messages/recipients/validate")
async def validate_bulk_recipients(
    payload: BulkRecipientValidationRequest,
    current_user: dict = Depends(require_permission("bulk_messaging", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.validate_bulk_recipients(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Bulk recipients validated successfully.")


@router.get("/bulk-messages")
async def list_bulk_messages(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    channel: str | None = None,
    current_user: dict = Depends(require_permission("bulk_messaging", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_bulk_messages(str(current_user["_id"]), page, page_size, search, status_filter, channel)
    return success_response(data=data, message="Bulk messages fetched successfully.")


@router.get("/bulk-messages/{bulk_message_id}")
async def get_bulk_message(
    bulk_message_id: str,
    current_user: dict = Depends(require_permission("bulk_messaging", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_bulk_message(str(current_user["_id"]), bulk_message_id)
    return success_response(data=data, message="Bulk message fetched successfully.")


@router.post("/bulk-messages", status_code=status.HTTP_201_CREATED)
async def create_bulk_message(
    payload: BulkMessageCreateRequest,
    current_user: dict = Depends(require_permission("bulk_messaging", "create")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_bulk_message(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Bulk message created successfully.")


@router.patch("/bulk-messages/{bulk_message_id}")
async def update_bulk_message(
    bulk_message_id: str,
    payload: BulkMessageUpdateRequest,
    current_user: dict = Depends(require_permission("bulk_messaging", "create")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_bulk_message(str(current_user["_id"]), bulk_message_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Bulk message updated successfully.")


@router.post("/bulk-messages/{bulk_message_id}/send")
async def send_bulk_message(
    bulk_message_id: str,
    current_user: dict = Depends(require_permission("bulk_messaging", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.send_bulk_message(str(current_user["_id"]), bulk_message_id)
    return success_response(data=data, message="Bulk message dispatched successfully.")


@router.post("/bulk-messages/{bulk_message_id}/cancel")
async def cancel_bulk_message(
    bulk_message_id: str,
    current_user: dict = Depends(require_permission("bulk_messaging", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.cancel_bulk_message(str(current_user["_id"]), bulk_message_id)
    return success_response(data=data, message="Bulk message cancelled successfully.")
