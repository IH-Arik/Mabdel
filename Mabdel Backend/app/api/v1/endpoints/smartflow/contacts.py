from __future__ import annotations

from fastapi import Depends, File, Query, UploadFile, status

from app.dependencies import get_current_user, require_permission, require_subscription
from app.schemas.smartflow import (
    ContactCreateRequest,
    ContactImportRequest,
    ContactUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/contacts")
async def list_contacts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    current_user: dict = Depends(require_permission("contacts", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_contacts(str(current_user["_id"]), page, page_size, search)
    return success_response(data=data, message="Contacts fetched successfully.")


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreateRequest,
    current_user: dict = Depends(require_permission("contacts", "create")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_contact(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Contact created successfully.")


@router.post("/contacts/import", status_code=status.HTTP_201_CREATED)
async def import_contacts(
    payload: ContactImportRequest,
    current_user: dict = Depends(require_permission("contacts", "create")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.import_contacts(str(current_user["_id"]), [item.model_dump() for item in payload.contacts])
    return success_response(data=data, message="Contacts import finished successfully.")


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: str,
    current_user: dict = Depends(require_permission("contacts", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_contact(str(current_user["_id"]), contact_id)
    return success_response(data=data, message="Contact fetched successfully.")


@router.patch("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    payload: ContactUpdateRequest,
    current_user: dict = Depends(require_permission("contacts", "edit")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_contact(str(current_user["_id"]), contact_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Contact updated successfully.")


@router.post("/contacts/{contact_id}/avatar")
async def upload_contact_avatar(
    contact_id: str,
    avatar_file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("contacts", "edit")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    file_bytes = await avatar_file.read()
    data = await service.store_contact_avatar(
        str(current_user["_id"]),
        contact_id,
        file_bytes=file_bytes,
        content_type=avatar_file.content_type,
        filename=avatar_file.filename,
    )
    return success_response(data=data, message="Contact image uploaded successfully.")


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(require_permission("contacts", "delete")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_contact(str(current_user["_id"]), contact_id)
    return success_response(data={"deleted": True}, message="Contact deleted successfully.")
