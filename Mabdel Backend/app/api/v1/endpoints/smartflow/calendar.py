from __future__ import annotations

from fastapi import Depends, Query, status

from app.dependencies import get_current_user, require_permission, require_subscription
from app.schemas.smartflow import (
    CalendarEventCreateRequest,
    CalendarEventShareRequest,
    CalendarEventUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/calendar/events")
async def list_calendar_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    upcoming_only: bool = False,
    date_from: str | None = None,
    date_to: str | None = None,
    contact_id: str | None = None,
    current_user: dict = Depends(require_permission("appointments", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_calendar_events(
        str(current_user["_id"]),
        page,
        page_size,
        search,
        upcoming_only,
        date_from=date_from,
        date_to=date_to,
        contact_id=contact_id,
    )
    return success_response(data=data, message="Calendar events fetched successfully.")


@router.get("/calendar/events/{event_id}")
async def get_calendar_event(
    event_id: str,
    current_user: dict = Depends(require_permission("appointments", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_calendar_event(str(current_user["_id"]), event_id)
    return success_response(data=data, message="Calendar event fetched successfully.")


@router.post("/calendar/events", status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreateRequest,
    current_user: dict = Depends(require_permission("appointments", "create")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_calendar_event(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Calendar event created successfully.")


@router.patch("/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: str,
    payload: CalendarEventUpdateRequest,
    current_user: dict = Depends(require_permission("appointments", "edit")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_calendar_event(str(current_user["_id"]), event_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Calendar event updated successfully.")


@router.post("/calendar/events/{event_id}/share")
async def share_calendar_event(
    event_id: str,
    payload: CalendarEventShareRequest,
    current_user: dict = Depends(require_permission("appointments", "edit")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.share_calendar_event(str(current_user["_id"]), event_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Calendar event shared successfully.")


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    current_user: dict = Depends(require_permission("appointments", "cancel")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_calendar_event(str(current_user["_id"]), event_id)
    return success_response(data={"deleted": True}, message="Calendar event deleted successfully.")
