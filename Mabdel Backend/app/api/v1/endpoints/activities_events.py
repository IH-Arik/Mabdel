from __future__ import annotations

from typing import Any
from bson import ObjectId
from fastapi import APIRouter, Depends, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

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
    location: str = "Online"
    date: str = "TBD"
    time: str = "TBD"
    price: float = 0.0
    participantLimit: int = 100

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
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    query: dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
        ]
        
    items = await db.events.find(query).sort("created_at", -1).to_list(length=100)
    return success_response(
        data=[_serialize_doc(item) for item in items],
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
        "location": payload.location,
        "date": payload.date,
        "time": payload.time,
        "price": payload.price,
        "participantLimit": payload.participantLimit,
        "joinedCount": 1,
        "participants": [user_id],
        "creatorId": user_id,
        "hostName": user_name,
        "imageUrl": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    result = await db.events.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = str(result.inserted_id)
    return success_response(data=_serialize_doc(doc), message="Event created successfully.")
