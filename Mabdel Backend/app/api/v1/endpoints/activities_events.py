from __future__ import annotations

from datetime import datetime
from typing import Any
from bson import ObjectId
from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, model_validator

from app.dependencies import get_current_user, get_mongo_database
from app.utils.helpers import utc_now
from app.utils.responses import success_response
from app.core.exceptions import AppException

router = APIRouter(tags=["Activities & Events"])

def _serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for key, value in doc.items():
        if key == "_id":
            data["id"] = str(value)
            data["_id"] = str(value)
        elif isinstance(value, ObjectId):
            data[key] = str(value)
        else:
            data[key] = value
    return data

def _object_id_or_raw(value: str) -> ObjectId | str:
    return ObjectId(value) if ObjectId.is_valid(value) else value

# Pydantic Schemas
class ActivityCreate(BaseModel):
    name: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    description: str = ""
    location: str = "Online"
    date: str = "TBD"
    time: str = "TBD"
    price: float = 0.0
    maxParticipants: int = 10

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = ""
    category: str = "General"
    location: str = "Online"
    onlineLink: str | None = None
    date: str = "TBD"
    time: str = "TBD"
    endTime: str | None = None
    timezone: str = "UTC"
    price: float = 0.0
    participantLimit: int = Field(default=100, ge=1)

    @model_validator(mode="after")
    def validate_time_window(self) -> "EventCreate":
        if self.time and self.endTime and self.time != "TBD" and self.endTime != "TBD":
            start_time = _parse_clock_value(self.time)
            end_time = _parse_clock_value(self.endTime)
            if start_time and end_time and end_time <= start_time:
                raise ValueError("Event end time must be after start time.")
        self.category = (self.category or "General").strip() or "General"
        self.timezone = (self.timezone or "UTC").strip() or "UTC"
        return self


def _parse_clock_value(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%H:%M", "%I:%M %p"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def _serialize_event(doc: dict[str, Any], current_user_id: str | None = None) -> dict[str, Any]:
    safe = _serialize_doc(doc)
    participants = [str(item) for item in safe.get("participants", [])]
    attendee_count = int(safe.get("joinedCount") or len(participants))
    capacity = int(safe.get("participantLimit") or 0)
    safe["category"] = safe.get("category") or "General"
    safe["organizer"] = safe.get("hostName") or safe.get("organizer") or "Host"
    safe["attendee_count"] = attendee_count
    safe["capacity"] = capacity
    safe["joined"] = bool(current_user_id and current_user_id in participants)
    safe["timezone"] = safe.get("timezone") or "UTC"
    safe["onlineLink"] = safe.get("onlineLink")
    return safe

@router.get("/activities")
async def list_activities(
    type: str | None = None,
    search: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    query: dict[str, Any] = {}
    if type and type.lower() != "all":
        query["category"] = {"$regex": type, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
        ]
    
    items = await db.activities.find(query).sort("created_at", -1).to_list(length=100)
    return success_response(
        data=[_serialize_doc(item) for item in items],
        message="Activities listed successfully."
    )

@router.post("/activities", status_code=status.HTTP_201_CREATED)
async def create_activity(
    payload: ActivityCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_name = current_user.get("full_name") or current_user.get("email") or "Host"
    
    doc = {
        "name": payload.name,
        "category": payload.category,
        "description": payload.description,
        "location": payload.location,
        "date": payload.date,
        "time": payload.time,
        "price": payload.price,
        "maxParticipants": payload.maxParticipants,
        "joinedCount": 1,
        "participants": [user_id],
        "creatorId": user_id,
        "hostName": user_name,
        "imageUrl": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&h=400&fit=crop",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    result = await db.activities.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = str(result.inserted_id)
    return success_response(data=_serialize_doc(doc), message="Activity created successfully.")

@router.post("/activities/{activity_id}/join")
async def join_activity(
    activity_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    activity = await db.activities.find_one({"_id": _object_id_or_raw(activity_id)})
    if not activity:
        raise AppException(status_code=404, code="NOT_FOUND", message="Activity not found.")
        
    participants = activity.get("participants", [])
    if user_id in participants:
        return success_response(data=_serialize_doc(activity), message="You have already joined this activity.")
        
    if len(participants) >= activity.get("maxParticipants", 10):
        raise AppException(status_code=400, code="FULL", message="Activity participant limit reached.")
        
    await db.activities.update_one(
        {"_id": _object_id_or_raw(activity_id)},
        {
            "$push": {"participants": user_id},
            "$inc": {"joinedCount": 1},
            "$set": {"updated_at": utc_now()}
        }
    )
    updated_activity = await db.activities.find_one({"_id": _object_id_or_raw(activity_id)})
    return success_response(data=_serialize_doc(updated_activity), message="Activity joined successfully.")

@router.get("/events")
async def list_events(
    search: str | None = None,
    category: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    query: dict[str, Any] = {}
    if category and category.lower() != "all":
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"hostName": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
        ]
        
    items = await db.events.find(query).sort("created_at", -1).to_list(length=100)
    return success_response(
        data=[_serialize_event(item, user_id) for item in items],
        message="Events listed successfully."
    )

@router.post("/events", status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_name = current_user.get("full_name") or current_user.get("email") or "Host"
    
    doc = {
        "title": payload.title,
        "name": payload.title,
        "description": payload.description,
        "category": payload.category,
        "location": payload.location,
        "onlineLink": payload.onlineLink,
        "date": payload.date,
        "time": payload.time,
        "endTime": payload.endTime,
        "timezone": payload.timezone,
        "price": payload.price,
        "participantLimit": payload.participantLimit,
        "joinedCount": 1,
        "participants": [user_id],
        "creatorId": user_id,
        "hostName": user_name,
        "organization_id": current_user.get("organization_id") or user_id,
        "imageUrl": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    result = await db.events.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = str(result.inserted_id)
    return success_response(data=_serialize_event(doc, user_id), message="Event created successfully.")


@router.post("/events/{event_id}/join")
async def join_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    event = await db.events.find_one({"_id": _object_id_or_raw(event_id)})
    if not event:
        raise AppException(status_code=404, code="NOT_FOUND", message="Event not found.")

    participants = [str(item) for item in event.get("participants", [])]
    if user_id in participants:
        return success_response(data=_serialize_event(event, user_id), message="You have already joined this event.")

    if len(participants) >= event.get("participantLimit", 100):
        raise AppException(status_code=400, code="FULL", message="Event participant limit reached.")

    await db.events.update_one(
        {"_id": _object_id_or_raw(event_id)},
        {
            "$push": {"participants": user_id},
            "$inc": {"joinedCount": 1},
            "$set": {"updated_at": utc_now()},
        },
    )
    updated_event = await db.events.find_one({"_id": _object_id_or_raw(event_id)})
    return success_response(data=_serialize_event(updated_event, user_id), message="Event joined successfully.")


@router.post("/events/{event_id}/leave")
async def leave_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    event = await db.events.find_one({"_id": _object_id_or_raw(event_id)})
    if not event:
        raise AppException(status_code=404, code="NOT_FOUND", message="Event not found.")

    participants = [str(item) for item in event.get("participants", [])]
    if user_id not in participants:
        raise AppException(status_code=400, code="NOT_JOINED", message="You have not joined this event.")

    await db.events.update_one(
        {"_id": _object_id_or_raw(event_id)},
        {
            "$pull": {"participants": user_id},
            "$inc": {"joinedCount": -1},
            "$set": {"updated_at": utc_now()},
        },
    )
    updated_event = await db.events.find_one({"_id": _object_id_or_raw(event_id)})
    if updated_event and updated_event.get("joinedCount", 0) < 0:
        await db.events.update_one(
            {"_id": _object_id_or_raw(event_id)},
            {"$set": {"joinedCount": 0}},
        )
        updated_event["joinedCount"] = 0
    return success_response(data=_serialize_event(updated_event, user_id), message="Event left successfully.")
