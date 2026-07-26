from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database, require_role
from app.schemas.availability_slot import AvailabilitySlotBulkCreate
from app.services.availability_slot_service import AvailabilitySlotService

router = APIRouter()

ADMIN_ROLES = ["super_admin", "admin"]


def get_availability_slot_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> AvailabilitySlotService:
    return AvailabilitySlotService(db)


@router.get("")
async def list_my_availability_slots(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: AvailabilitySlotService = Depends(get_availability_slot_service),
) -> dict:
    data = await service.list_my_slots(str(current_user["_id"]), from_date, to_date)
    return {"success": True, "data": data}


@router.post("")
async def create_availability_slots(
    body: AvailabilitySlotBulkCreate,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: AvailabilitySlotService = Depends(get_availability_slot_service),
) -> dict:
    admin_name = current_user.get("full_name") or current_user.get("name") or current_user.get("email", "Admin")
    data = await service.create_slots(
        str(current_user["_id"]), admin_name, [entry.model_dump() for entry in body.slots]
    )
    return {"success": True, "message": "Availability slots saved.", "data": data}


@router.delete("/{slot_id}")
async def delete_availability_slot(
    slot_id: str,
    current_user: dict = Depends(require_role(ADMIN_ROLES)),
    service: AvailabilitySlotService = Depends(get_availability_slot_service),
) -> dict:
    await service.delete_slot(str(current_user["_id"]), slot_id)
    return {"success": True, "message": "Availability slot removed."}
