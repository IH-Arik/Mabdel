from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.schemas.auth_schema import OTPPurpose
from app.utils.helpers import utc_now


class OTPRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.otp_codes

    async def create_otp(self, email: str, code: str, purpose: OTPPurpose, expires_at: datetime) -> dict:
        now = utc_now()
        payload = {
            "email": email.lower().strip(),
            "code": code,
            "purpose": purpose,
            "attempts": 0,
            "is_used": False,
            "expires_at": expires_at,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(payload)
        payload["_id"] = result.inserted_id
        return payload

    async def get_latest_otp(self, email: str, purpose: OTPPurpose) -> dict | None:
        return await self.collection.find_one(
            {"email": email.lower().strip(), "purpose": purpose},
            sort=[("created_at", -1)],
        )

    async def get_latest_active_otp(self, email: str, purpose: OTPPurpose) -> dict | None:
        return await self.collection.find_one(
            {
                "email": email.lower().strip(),
                "purpose": purpose,
                "is_used": False,
                "expires_at": {"$gt": utc_now()},
            },
            sort=[("created_at", -1)],
        )

    async def invalidate_active_otps(self, email: str, purpose: OTPPurpose) -> None:
        await self.collection.update_many(
            {
                "email": email.lower().strip(),
                "purpose": purpose,
                "is_used": False,
            },
            {"$set": {"is_used": True, "updated_at": utc_now()}},
        )

    async def mark_otp_used(self, otp_id: str) -> None:
        if not ObjectId.is_valid(otp_id):
            return
        await self.collection.update_one(
            {"_id": ObjectId(otp_id)},
            {"$set": {"is_used": True, "updated_at": utc_now()}},
        )

    async def increment_attempts(self, otp_id: str) -> int:
        if not ObjectId.is_valid(otp_id):
            return 0
        updated = await self.collection.find_one_and_update(
            {"_id": ObjectId(otp_id)},
            {"$inc": {"attempts": 1}, "$set": {"updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return int(updated["attempts"]) if updated else 0
