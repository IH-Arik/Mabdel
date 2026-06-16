from __future__ import annotations

from pymongo import ReturnDocument

from app.services.push_notification_service import PushNotificationService
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class NotificationService(SmartFlowBase):
    async def list_notifications(self, user_id: str, page: int, page_size: int, unread_only: bool) -> dict:
        filters = {"user_id": user_id}
        if unread_only:
            filters["read"] = False
        page_result = await self._paginate(self.db.notifications, filters, page, page_size, "created_at")
        page_result["items"] = [self._serialize_notification(item) for item in page_result["items"]]
        page_result["summary"] = await self._notification_summary(user_id)
        page_result["sections"] = self._notification_sections(page_result["items"])
        return page_result

    async def mark_notification_read(self, user_id: str, notification_id: str) -> dict:
        notification = await self._get_owned_document(self.db.notifications, user_id, notification_id, "NOTIFICATION_NOT_FOUND")
        updated = await self.db.notifications.find_one_and_update(
            {"_id": notification["_id"]},
            {"$set": {"read": True, "read_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return self._serialize_notification(updated)

    async def mark_all_notifications_read(self, user_id: str) -> dict:
        now = utc_now()
        result = await self.db.notifications.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": now}},
        )
        return {
            "updated_count": result.modified_count,
            "summary": await self._notification_summary(user_id),
        }

    async def delete_notification(self, user_id: str, notification_id: str) -> dict:
        notification = await self._get_owned_document(self.db.notifications, user_id, notification_id, "NOTIFICATION_NOT_FOUND")
        await self.db.notifications.delete_one({"_id": notification["_id"]})
        return {"deleted": True, "id": notification_id, "summary": await self._notification_summary(user_id)}

    async def dispatch_pending_push_notifications(self, user_id: str, limit: int = 50) -> list[dict]:
        jobs = await self.db.push_dispatch_jobs.find({"user_id": user_id, "status": "queued"}).limit(limit).to_list(length=limit)
        return await PushNotificationService(self.db).dispatch_jobs([job["_id"] for job in jobs], limit=limit)
