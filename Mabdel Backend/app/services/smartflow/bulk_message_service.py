from __future__ import annotations

from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class BulkMessageService(SmartFlowBase):
    async def validate_bulk_recipients(self, user_id: str, payload: dict) -> dict:
        resolution = await self._resolve_bulk_recipients(user_id, payload)
        return {
            "channel": payload.get("channel", "email"),
            "valid_count": len(resolution["recipients"]),
            "invalid_count": len(resolution["invalid_entries"]),
            "duplicate_count": len(resolution["duplicate_entries"]),
            "recipients": resolution["recipients"],
            "invalid_entries": resolution["invalid_entries"],
            "duplicate_entries": resolution["duplicate_entries"],
            "unavailable_contact_ids": resolution["unavailable_contact_ids"],
            "unavailable_group_ids": resolution["unavailable_group_ids"],
        }

    async def list_bulk_messages(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        status_filter: str | None,
        channel: str | None,
    ) -> dict:
        filters: dict = {"user_id": user_id}
        if search:
            filters["$or"] = [
                {"content": {"$regex": search, "$options": "i"}},
                {"subject": {"$regex": search, "$options": "i"}},
            ]
        if status_filter:
            filters["status"] = status_filter
        if channel:
            filters["channel"] = channel
        page_result = await self._paginate(self.db.bulk_messages, filters, page, page_size, "updated_at")
        page_result["items"] = [self._serialize_bulk_message(item) for item in page_result["items"]]
        return page_result

    async def get_bulk_message(self, user_id: str, bulk_message_id: str) -> dict:
        document = await self._get_owned_document(self.db.bulk_messages, user_id, bulk_message_id, "BULK_MESSAGE_NOT_FOUND")
        return self._serialize_bulk_message(document)

    async def create_bulk_message(self, user_id: str, payload: dict) -> dict:
        resolution = await self._resolve_bulk_recipients(user_id, payload)
        self._validate_bulk_message_payload(payload, resolution)
        now = utc_now()
        scheduled_at = payload.get("scheduled_at")
        status = "draft"
        if scheduled_at:
            status = "scheduled"
        elif payload.get("send_now", True):
            status = "processing"

        document = {
            "user_id": user_id,
            "channel": payload["channel"],
            "status": status,
            "subject": payload.get("subject"),
            "content": payload["content"].strip(),
            "attachments": payload.get("attachments", []),
            "recipient_emails": [email.strip().lower() for email in payload.get("recipient_emails", []) if email.strip()],
            "contact_ids": payload.get("contact_ids", []),
            "group_ids": payload.get("group_ids", []),
            "recipients": resolution["recipients"],
            "deliveries": [],
            "scheduled_at": scheduled_at,
            "timezone": payload.get("timezone", "UTC"),
            "ai_transcript": payload.get("ai_transcript"),
            "character_count": len(payload["content"]),
            "segment_count": self._bulk_segment_count(payload["channel"], payload["content"]),
            "sent_count": 0,
            "failed_count": 0,
            "created_at": now,
            "updated_at": now,
            "sent_at": None,
        }
        result = await self.db.bulk_messages.insert_one(document)
        document["_id"] = result.inserted_id

        if status == "processing":
            document = await self._dispatch_bulk_message(document)
        elif status == "scheduled":
            await self.log_ai_command(
                user_id=user_id,
                command_text=f"Schedule bulk {payload['channel']} to {len(document['recipients'])} recipients",
                command_type="bulk_message",
                status="scheduled",
                is_replayable=True,
                related_resource={"type": "bulk_message", "id": str(document["_id"]), "status": "scheduled"},
                preview_payload={"channel": payload["channel"], "recipient_count": len(document["recipients"])},
            )
            await self.create_notification(
                user_id=user_id,
                notification_type="message",
                title="Bulk message scheduled",
                body=f"{len(document['recipients'])} recipients scheduled for delivery.",
            )
        else:
            await self.log_ai_command(
                user_id=user_id,
                command_text=f"Save draft bulk {payload['channel']}",
                command_type="bulk_message",
                status="archived",
                is_replayable=True,
                related_resource={"type": "bulk_message", "id": str(document["_id"]), "status": "draft"},
                preview_payload={"channel": payload["channel"], "recipient_count": len(document["recipients"])},
            )
        return self._serialize_bulk_message(document)

    async def update_bulk_message(self, user_id: str, bulk_message_id: str, updates: dict) -> dict:
        document = await self._get_owned_document(self.db.bulk_messages, user_id, bulk_message_id, "BULK_MESSAGE_NOT_FOUND")
        if document.get("status") not in {"draft", "scheduled"}:
            raise AppException(status_code=409, code="BULK_MESSAGE_LOCKED", message="Only draft or scheduled bulk messages can be updated.")

        clean_updates = {key: value for key, value in updates.items() if value is not None}
        merged = {**document, **clean_updates}
        resolution = await self._resolve_bulk_recipients(user_id, merged)
        self._validate_bulk_message_payload(merged, resolution)

        clean_updates["recipients"] = resolution["recipients"]
        clean_updates["character_count"] = len(merged["content"])
        clean_updates["segment_count"] = self._bulk_segment_count(merged["channel"], merged["content"])
        clean_updates["updated_at"] = utc_now()
        clean_updates["recipient_emails"] = [
            email.strip().lower()
            for email in merged.get("recipient_emails", [])
            if isinstance(email, str) and email.strip()
        ]
        if clean_updates.get("scheduled_at"):
            clean_updates["status"] = "scheduled"
        elif clean_updates.get("send_now") is False:
            clean_updates["status"] = "draft"

        updated = await self.db.bulk_messages.find_one_and_update(
            {"_id": document["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Update bulk {updated['channel']} message",
            command_type="bulk_message",
            status="completed",
            is_replayable=True,
            related_resource={"type": "bulk_message", "id": str(updated["_id"]), "status": updated["status"]},
            preview_payload={"recipient_count": len(updated.get("recipients", []))},
        )
        return self._serialize_bulk_message(updated)

    async def send_bulk_message(self, user_id: str, bulk_message_id: str) -> dict:
        document = await self._get_owned_document(self.db.bulk_messages, user_id, bulk_message_id, "BULK_MESSAGE_NOT_FOUND")
        if document.get("status") == "cancelled":
            raise AppException(status_code=409, code="BULK_MESSAGE_CANCELLED", message="Cancelled bulk messages cannot be sent.")
        if document.get("status") in {"sent", "partial_failed", "failed"}:
            return self._serialize_bulk_message(document)
        updated = await self.db.bulk_messages.find_one_and_update(
            {"_id": document["_id"]},
            {"$set": {"status": "processing", "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        dispatched = await self._dispatch_bulk_message(updated)
        return self._serialize_bulk_message(dispatched)

    async def cancel_bulk_message(self, user_id: str, bulk_message_id: str) -> dict:
        document = await self._get_owned_document(self.db.bulk_messages, user_id, bulk_message_id, "BULK_MESSAGE_NOT_FOUND")
        if document.get("status") not in {"draft", "scheduled"}:
            raise AppException(status_code=409, code="BULK_MESSAGE_CANNOT_CANCEL", message="Only draft or scheduled bulk messages can be cancelled.")
        updated = await self.db.bulk_messages.find_one_and_update(
            {"_id": document["_id"]},
            {"$set": {"status": "cancelled", "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Cancel bulk {updated['channel']} message",
            command_type="bulk_message",
            status="archived",
            is_replayable=True,
            related_resource={"type": "bulk_message", "id": str(updated["_id"]), "status": "cancelled"},
        )
        return self._serialize_bulk_message(updated)
