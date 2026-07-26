from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.services.meeting_request_service import MeetingRequestService

SLOT_DURATION_MINUTES = 30


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _combine_utc(date_str: str, time_str: str) -> datetime:
    hour, minute = (int(part) for part in time_str.split(":"))
    year, month, day = (int(part) for part in date_str.split("-"))
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def _serialize_slot(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "date": doc.get("date"),
        "time": doc.get("time"),
        "start": doc.get("start"),
        "end": doc.get("end"),
        "status": doc.get("status", "open"),
        "meeting_request_id": doc.get("meeting_request_id"),
        "created_at": doc.get("created_at"),
    }


class AvailabilitySlotService:
    def __init__(self, db: AsyncIOMotorDatabase, meeting_request_service: MeetingRequestService | None = None) -> None:
        self.db = db
        self.meeting_request_service = meeting_request_service or MeetingRequestService(db)

    # ------------------------------------------------------------------
    # Admin — manage own availability
    # ------------------------------------------------------------------

    async def create_slots(self, admin_id: str, admin_name: str, slots: list[dict]) -> dict:
        now = _utc_now()
        created: list[dict] = []
        skipped = 0
        for entry in slots:
            date_str, time_str = entry["date"], entry["time"]
            existing = await self.db.admin_availability_slots.find_one(
                {"admin_id": admin_id, "date": date_str, "time": time_str}
            )
            if existing:
                skipped += 1
                continue
            start = _combine_utc(date_str, time_str)
            document = {
                "admin_id": admin_id,
                "admin_name": admin_name,
                "date": date_str,
                "time": time_str,
                "start": start,
                "end": start + timedelta(minutes=SLOT_DURATION_MINUTES),
                "status": "open",
                "meeting_request_id": None,
                "created_at": now,
                "updated_at": now,
            }
            result = await self.db.admin_availability_slots.insert_one(document)
            document["_id"] = result.inserted_id
            created.append(_serialize_slot(document))
        return {"created": created, "skipped_duplicates": skipped}

    async def list_my_slots(self, admin_id: str, from_date: str | None, to_date: str | None) -> list[dict]:
        query: dict = {"admin_id": admin_id}
        date_filter: dict = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        if date_filter:
            query["date"] = date_filter
        cursor = self.db.admin_availability_slots.find(query).sort([("date", 1), ("time", 1)])
        return [_serialize_slot(doc) for doc in await cursor.to_list(length=500)]

    async def delete_slot(self, admin_id: str, slot_id: str) -> None:
        if not ObjectId.is_valid(slot_id):
            raise AppException(status_code=404, code="SLOT_NOT_FOUND", message="Availability slot was not found.")
        slot = await self.db.admin_availability_slots.find_one({"_id": ObjectId(slot_id), "admin_id": admin_id})
        if not slot:
            raise AppException(status_code=404, code="SLOT_NOT_FOUND", message="Availability slot was not found.")
        if slot.get("status") == "booked":
            raise AppException(status_code=409, code="SLOT_ALREADY_BOOKED", message="This slot is already booked and can't be removed.")
        await self.db.admin_availability_slots.delete_one({"_id": slot["_id"]})

    # ------------------------------------------------------------------
    # Public — merged view + instant booking
    # ------------------------------------------------------------------

    async def get_public_available_times(self, from_date: str | None, to_date: str | None) -> list[dict]:
        query: dict = {"status": "open"}
        date_filter: dict = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        if date_filter:
            query["date"] = date_filter
        cursor = self.db.admin_availability_slots.find(query).sort([("date", 1), ("time", 1)])
        slots = await cursor.to_list(length=1000)

        merged: dict[tuple[str, str], dict] = {}
        for slot in slots:
            key = (slot["date"], slot["time"])
            if key not in merged:
                merged[key] = slot
        ordered = sorted(merged.values(), key=lambda s: (s["date"], s["time"]))
        return [
            {"date": s["date"], "time": s["time"], "start": s["start"], "end": s["end"]}
            for s in ordered
        ]

    async def book_slot(self, payload: dict) -> dict:
        date_str, time_str = payload["date"], payload["time"]
        candidates = await self.db.admin_availability_slots.find(
            {"date": date_str, "time": time_str, "status": "open"}
        ).to_list(length=50)
        if not candidates:
            raise AppException(
                status_code=409,
                code="SLOT_NOT_AVAILABLE",
                message="This time is no longer available. Please pick another slot.",
            )

        load_by_admin: dict[str, int] = {}
        for candidate in candidates:
            admin_id = candidate["admin_id"]
            if admin_id not in load_by_admin:
                load_by_admin[admin_id] = await self.db.meeting_requests.count_documents(
                    {"confirmed_by.admin_id": admin_id, "status": "confirmed"}
                )
        candidates.sort(key=lambda c: (load_by_admin[c["admin_id"]], c["created_at"]))

        claimed = None
        for candidate in candidates:
            updated = await self.db.admin_availability_slots.find_one_and_update(
                {"_id": candidate["_id"], "status": "open"},
                {"$set": {"status": "booked", "updated_at": _utc_now()}},
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                claimed = updated
                break

        if not claimed:
            raise AppException(
                status_code=409,
                code="SLOT_NOT_AVAILABLE",
                message="This time is no longer available. Please pick another slot.",
            )

        meeting = await self.meeting_request_service.create_confirmed_booking(
            admin_id=claimed["admin_id"],
            admin_name=claimed.get("admin_name", "Admin"),
            payload=payload,
            start=claimed["start"],
            end=claimed["end"],
        )
        await self.db.admin_availability_slots.update_one(
            {"_id": claimed["_id"]}, {"$set": {"meeting_request_id": meeting["id"]}}
        )
        return meeting
