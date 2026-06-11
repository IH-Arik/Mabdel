from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.helpers import utc_now


class PermissionsRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.permission_preferences

    async def get_preferences(self, user_id: str | None = None, device_id: str | None = None) -> dict | None:
        query: dict[str, str] = {}
        if user_id:
            query["user_id"] = user_id
        if device_id:
            query["device_id"] = device_id
        if not query:
            return None
        return await self.collection.find_one(query)

    async def upsert_preferences(
        self,
        *,
        user_id: str | None,
        device_id: str | None,
        microphone_enabled: bool,
        notifications_enabled: bool,
        contacts_enabled: bool,
    ) -> dict:
        query: dict[str, str] = {}
        if user_id:
            query["user_id"] = user_id
        if device_id:
            query["device_id"] = device_id
        if not query:
            raise ValueError("Either user_id or device_id must be provided.")

        now = utc_now()
        update = {
            "$set": {
                "user_id": user_id,
                "device_id": device_id,
                "microphone_enabled": microphone_enabled,
                "notifications_enabled": notifications_enabled,
                "contacts_enabled": contacts_enabled,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        }

        await self.collection.update_one(query, update, upsert=True)
        result = await self.collection.find_one(query)
        if result is None:
            raise RuntimeError("Failed to persist permission preferences.")
        return result
