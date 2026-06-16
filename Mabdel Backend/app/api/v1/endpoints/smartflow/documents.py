from __future__ import annotations

from fastapi import Depends, Query, status

from app.dependencies import get_current_user
from app.schemas.smartflow import (
    DocumentCreateRequest,
    DocumentUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/documents")
async def list_documents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    doc_type: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_documents(str(current_user["_id"]), page, page_size, search, doc_type)
    return success_response(data=data, message="Documents fetched successfully.")


@router.post("/documents", status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_document(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Document created successfully.")


@router.patch("/documents/{document_id}")
async def update_document(
    document_id: str,
    payload: DocumentUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_document(str(current_user["_id"]), document_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Document updated successfully.")


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_document(str(current_user["_id"]), document_id)
    return success_response(data={"deleted": True}, message="Document deleted successfully.")
