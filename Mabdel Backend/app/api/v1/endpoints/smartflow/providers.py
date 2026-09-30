from __future__ import annotations

from fastapi import Depends, status

from app.dependencies import require_permission, require_subscription
from app.schemas.smartflow import (
    AppointmentTypeCreateRequest,
    AppointmentTypeUpdateRequest,
    ProviderCreateRequest,
    ProviderUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/providers")
async def list_providers(
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_providers(str(current_user["_id"]))
    return success_response(data=data, message="Providers fetched successfully.")


@router.post("/providers", status_code=status.HTTP_201_CREATED)
async def create_provider(
    payload: ProviderCreateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_provider(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Provider created successfully.")


@router.patch("/providers/{provider_id}")
async def update_provider(
    provider_id: str,
    payload: ProviderUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_provider(str(current_user["_id"]), provider_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Provider updated successfully.")


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_provider(str(current_user["_id"]), provider_id)
    return success_response(data={"deleted": True}, message="Provider deleted successfully.")


@router.get("/appointment-types")
async def list_appointment_types(
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_appointment_types(str(current_user["_id"]))
    return success_response(data=data, message="Appointment types fetched successfully.")


@router.post("/appointment-types", status_code=status.HTTP_201_CREATED)
async def create_appointment_type(
    payload: AppointmentTypeCreateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_appointment_type(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Appointment type created successfully.")


@router.patch("/appointment-types/{type_id}")
async def update_appointment_type(
    type_id: str,
    payload: AppointmentTypeUpdateRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_appointment_type(str(current_user["_id"]), type_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Appointment type updated successfully.")


@router.delete("/appointment-types/{type_id}")
async def delete_appointment_type(
    type_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_appointment_type(str(current_user["_id"]), type_id)
    return success_response(data={"deleted": True}, message="Appointment type deleted successfully.")
