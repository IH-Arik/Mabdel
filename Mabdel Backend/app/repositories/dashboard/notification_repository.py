from __future__ import annotations

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class NotificationRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.notifications

    async def get_user_notifications(
        self, user_id: str, limit: int = 10, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int]:
        query = {"user_id": user_id}
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    async def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        if not ObjectId.is_valid(notification_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(notification_id), "user_id": user_id},
            {"$set": {"is_read": True}},
        )
        return result.modified_count > 0
