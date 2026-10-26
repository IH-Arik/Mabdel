from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import Depends, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.exceptions import AppException
from app.dependencies import require_permission
from app.services.receptionist_execution_service import ReceptionistExecutionService
from app.services.receptionist_workflow_service import ReceptionistWorkflowService
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router

_CALLS_VIEW = Depends(require_permission("calls", "view"))
_CALLS_MANAGE = Depends(require_permission("calls", "manage"))
_FLOW_SERVICE = Depends(get_smartflow_service)


class WorkItemUpdate(BaseModel):
    status: Literal["open", "in_progress", "completed", "cancelled"]
    assignee_id: str | None = Field(default=None, max_length=64)


class WorkItemExecution(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approved: Literal[True]
    title: str | None = Field(default=None, min_length=1, max_length=160)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    due_at: datetime | None = None
    quote_amount: Decimal | None = Field(
        default=None, ge=0, le=Decimal("999999999.99"), decimal_places=2
    )
    currency: Literal["USD", "CAD", "GBP", "EUR", "AUD", "BDT", "INR", "AED"] | None = (
        None
    )
    workflow_action: (
        Literal["create_task", "create_service_ticket", "create_crm_contact"] | None
    ) = None
    contact_email: EmailStr | None = None

    @field_validator("due_at")
    @classmethod
    def timezone_required(cls, value):
        if value and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Due time must include its timezone.")
        return value


class ArtifactUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal[
        "open", "in_progress", "completed", "cancelled", "draft", "accepted", "declined"
    ]


async def _organization(service, user):
    organization_id = await service._resolve_organization_id(str(user["_id"]))
    if not organization_id:
        raise AppException(
            403, "ORGANIZATION_REQUIRED", "A business account is required."
        )
    return organization_id


@router.get("/receptionist/work-items")
async def list_work_items(
    status: Literal["open", "in_progress", "completed", "cancelled"] | None = Query(
        default=None
    ),
    current_user: dict = _CALLS_VIEW,
    service: SmartFlowService = _FLOW_SERVICE,
):
    org = await _organization(service, current_user)
    items = await ReceptionistWorkflowService(service.db).list_requests(org, status)
    return success_response(
        data={"items": items}, message="Receptionist requests fetched."
    )


@router.patch("/receptionist/work-items/{item_id}")
async def update_work_item(
    item_id: str,
    payload: WorkItemUpdate,
    current_user: dict = _CALLS_MANAGE,
    service: SmartFlowService = _FLOW_SERVICE,
):
    org = await _organization(service, current_user)
    data = await ReceptionistWorkflowService(service.db).update_request(
        org, item_id, **payload.model_dump()
    )
    return success_response(data=data, message="Receptionist request updated.")


@router.post("/receptionist/work-items/{item_id}/execute")
async def execute_work_item(
    item_id: str,
    payload: WorkItemExecution,
    current_user: dict = _CALLS_MANAGE,
    service: SmartFlowService = _FLOW_SERVICE,
):
    data = await ReceptionistExecutionService(service.db).execute(
        str(current_user["_id"]), item_id, payload.model_dump(exclude_none=True)
    )
    return success_response(data=data, message="Reviewed business record created.")


@router.get("/receptionist/business-records")
async def list_business_records(
    current_user: dict = _CALLS_VIEW,
    service: SmartFlowService = _FLOW_SERVICE,
):
    data = await ReceptionistExecutionService(service.db).list_artifacts(
        str(current_user["_id"])
    )
    return success_response(data={"items": data}, message="Business records fetched.")


@router.patch("/receptionist/business-records/{kind}/{artifact_id}")
async def update_business_record(
    kind: Literal["task", "callback", "service_ticket", "quote"],
    artifact_id: str,
    payload: ArtifactUpdate,
    current_user: dict = _CALLS_MANAGE,
    service: SmartFlowService = _FLOW_SERVICE,
):
    data = await ReceptionistExecutionService(service.db).update_artifact(
        str(current_user["_id"]), kind, artifact_id, payload.model_dump()
    )
    return success_response(data=data, message="Business record updated.")
