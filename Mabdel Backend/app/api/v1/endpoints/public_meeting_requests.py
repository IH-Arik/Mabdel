from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database
from app.schemas.availability_slot import BookSlotRequest
from app.schemas.meeting_request import MeetingRequestCreate
from app.services.availability_slot_service import AvailabilitySlotService
from app.services.meeting_request_service import MeetingRequestService
from app.utils.responses import success_response

router = APIRouter(prefix="/public", tags=["Public"])


def get_meeting_request_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> MeetingRequestService:
    return MeetingRequestService(db)


def get_availability_slot_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> AvailabilitySlotService:
    return AvailabilitySlotService(db)


@router.get("/meeting-requests/available-times")
async def get_available_times(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    service: AvailabilitySlotService = Depends(get_availability_slot_service),
) -> dict:
    data = await service.get_public_available_times(from_date, to_date)
    return success_response(data=data, message="Available times fetched successfully.")


@router.post("/meeting-requests/book")
async def book_available_time(
    payload: BookSlotRequest,
    service: AvailabilitySlotService = Depends(get_availability_slot_service),
) -> dict:
    data = await service.book_slot(payload.model_dump())
    return success_response(data=data, message="Meeting booked successfully.")


@router.post("/meeting-requests")
async def submit_meeting_request(
    payload: MeetingRequestCreate,
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.create_meeting_request(payload.model_dump())
    return success_response(data=data, message="Meeting request submitted successfully.")


@router.get("/meeting-requests/confirm/{token}")
async def get_proposed_meeting_time(
    token: str,
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.get_proposal_by_token(token)
    return success_response(data=data, message="Proposed meeting time fetched successfully.")


@router.post("/meeting-requests/confirm/{token}")
async def confirm_proposed_meeting_time(
    token: str,
    service: MeetingRequestService = Depends(get_meeting_request_service),
) -> dict:
    data = await service.confirm_proposal(token)
    return success_response(data=data, message="Meeting confirmed successfully.")
