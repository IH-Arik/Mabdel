from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_current_user, get_mongo_database
from app.schemas.calendar import CalendarEventRequest, CalendarEventResponse
from app.services.calendar_service import CalendarService
from app.utils.responses import success_response

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.post("/schedule")
async def schedule_meeting(
    payload: CalendarEventRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    service = CalendarService(db)
    result: CalendarEventResponse = await service.schedule(payload, str(current_user["_id"]))
    return success_response(data=result.model_dump(), message="Meeting scheduled successfully.")
