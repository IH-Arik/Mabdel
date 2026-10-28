from __future__ import annotations

import asyncio
from pathlib import Path
from bson import ObjectId
from pymongo import ReturnDocument
from app.core.realtime import conversation_realtime_hub
from app.utils.helpers import utc_now


class ConversationMessagesMixin:
    async def list_messages(
        self,
        user_id: str,
        conversation_id: str,
        page: int,
        page_size: int,
        search: str | None,
        platform: str | None,
    ) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        filters: dict = {"conversation_id": conversation_id}
        is_owner = conversation.get("user_id") == user_id
        if not conversation.get("is_global_chat") and is_owner:
            filters["user_id"] = user_id
        # If member but not owner: no user_id filter — fetch all messages in the conversation
        if search:
            filters["content"] = {"$regex": search, "$options": "i"}
        if platform:
            filters["platform"] = platform
        page_result = await self._paginate(self.db.messages, filters, page, page_size, "timestamp")
        page_result["items"] = list(await asyncio.gather(*[
            self._serialize_message({**item, "is_global_chat": conversation.get("is_global_chat")}, viewer_user_id=user_id)
            for item in page_result["items"]
        ]))
        return page_result

    async def create_message(self, user_id: str, payload: dict) -> dict:
        conversation = await self._get_accessible_conversation(user_id, payload["conversation_id"], "CONVERSATION_NOT_FOUND")
        await self._validate_message_links(user_id, payload)
        attachments = self._normalize_message_attachments(payload)
        mentions = await self._normalize_message_mentions(user_id, payload.get("mentions", []))
        content = (payload.get("content") or "").strip()
        now = utc_now()
        # A history import backfills a real past message - it must keep its own real
        # time (for both sorting and what the conversation preview shows), not "now".
        message_time = payload.get("timestamp") or now
        is_history_import = bool(payload.get("is_history_import"))
        unread_count = 1 if (payload["direction"] == "inbound" and not is_history_import) else 0
        document = {
            "user_id": conversation.get("user_id", user_id),  # conversation owner id for scoping
            "sender_user_id": user_id,  # always the actual sender
            "organization_id": conversation.get("organization_id"),
            "is_global_chat": bool(conversation.get("is_global_chat")),
            "conversation_id": payload["conversation_id"],
            "contact_id": payload.get("contact_id"),
            "platform": payload["platform"],
            "direction": payload["direction"],
            "content": content,
            "media_url": payload.get("media_url") or self._primary_attachment_url(attachments),
            "attachments": attachments,
            "mentions": mentions,
            "status": "sent",
            "timestamp": message_time,
            "delivered_at": message_time if payload["direction"] == "inbound" else None,
            "unread_count": unread_count,
            "is_archived": False,
            "read_at": None,
            "reply_to_message_id": payload.get("reply_to_message_id"),
            "forward_from_message_id": payload.get("forward_from_message_id"),
            "provider_event_id": payload.get("provider_event_id"),
            "provider_message_id": payload.get("provider_message_id"),
            "external_account_id": payload.get("external_account_id"),
            # Shared threads track read state per viewer, so the sender starts as the
            # only reader; external-channel inboxes keep using unread_count instead.
            "read_by": [user_id] if self._is_shared_member_conversation(conversation) else [],
        }
        if payload.get("automated"):
            document["automated"] = True  # sent by the system (e.g. appointment texts), not typed by a person
        if payload.get("subject"):
            document["subject"] = str(payload["subject"])[:300]
        if payload.get("provider_metadata"):
            document["provider_metadata"] = payload["provider_metadata"]
        insert_result, _ = await asyncio.gather(
            self.db.messages.insert_one(document),
            # $max, not $set: an out-of-order history-imported message (or a live
            # message delivered late) must never drag "last activity" backward past
            # something more recent that already landed.
            self.db.conversations.update_one(
                {"_id": conversation["_id"]},
                {"$max": {"updated_at": message_time, "last_message_at": message_time}},
            ),
        )
        document["_id"] = insert_result.inserted_id

        serialized = await self._serialize_message(document, viewer_user_id=user_id)
        # Re-serialized per connected viewer (not broadcast as one shared payload) so
        # sender_is_self is correct for everyone, not just the sender whose own
        # viewpoint "serialized" above was built from.
        await conversation_realtime_hub.publish_per_viewer(
            payload["conversation_id"],
            "message.created",
            lambda viewer_id: self._serialize_message(document, viewer_user_id=viewer_id or user_id),
        )
        if conversation.get("is_global_chat"):
            await self._publish_global_chat_inbox_updates(conversation)
        elif not is_history_import:
            # A history import refreshes each touched thread once, after its batch.
            await self._publish_to_conversation_audience(conversation, extra_user_ids=[user_id])

        if payload["direction"] == "outbound":
            delivery = self._finalize_outbound_delivery(
                    user_id=user_id,
                    conversation_id=payload["conversation_id"],
                    message_id=str(document["_id"]),
                    platform=payload["platform"],
                    contact_id=payload.get("contact_id"),
                    content=content,
            )
            if payload.get("_await_delivery"):
                await delivery
                actual = await self.db.messages.find_one({"_id": document["_id"]})
                return await self._serialize_message(actual, viewer_user_id=user_id)
            asyncio.create_task(delivery)
        return serialized

    async def store_message_attachment(
        self,
        user_id: str,
        conversation_id: str,
        *,
        file_bytes: bytes,
        content_type: str | None,
        filename: str | None,
    ) -> dict:
        await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        stored = self.media_storage.store_file(
            owner_id=user_id,
            folder="message_attachments",
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
            label="Attachment",
        )
        return {
            "type": self._guess_attachment_type(stored.url, stored.content_type),
            "url": stored.url,
            "file_name": filename or Path(stored.filename).name,
            "mime_type": stored.content_type,
            "file_size_bytes": stored.size_bytes,
            "thumbnail_url": None,
        }

    async def update_message(self, user_id: str, message_id: str, updates: dict) -> dict:
        message = await self._get_accessible_message(user_id, message_id, "MESSAGE_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if not message.get("is_global_chat"):
            status_value = clean_updates.get("status")
            if status_value == "delivered" and not message.get("delivered_at"):
                clean_updates["delivered_at"] = utc_now()
            if clean_updates.get("status") == "read":
                if not message.get("delivered_at"):
                    clean_updates["delivered_at"] = utc_now()
                clean_updates["read_at"] = utc_now()
                clean_updates["unread_count"] = 0
        updated = await self.db.messages.find_one_and_update(
            {"_id": message["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        serialized, conversation = await asyncio.gather(
            self._serialize_message(updated, viewer_user_id=user_id),
            self.db.conversations.find_one({"_id": ObjectId(updated["conversation_id"])}),
        )
        await conversation_realtime_hub.publish_per_viewer(
            updated["conversation_id"],
            "message.updated",
            lambda viewer_id: self._serialize_message(updated, viewer_user_id=viewer_id or user_id),
        )
        if conversation and conversation.get("is_global_chat"):
            await self._publish_global_chat_inbox_updates(conversation)
        else:
            await self._publish_inbox_update(user_id, updated["conversation_id"], conversation=conversation)
        return serialized

    async def reply_to_message(self, user_id: str, message_id: str, payload: dict) -> dict:
        source_message = await self._get_accessible_message(user_id, message_id, "MESSAGE_NOT_FOUND")
        return await self.create_message(
            user_id,
            {
                "conversation_id": source_message["conversation_id"],
                "contact_id": payload.get("contact_id") or source_message.get("contact_id"),
                "platform": payload["platform"],
                "direction": "outbound",
                "content": payload.get("content"),
                "media_url": payload.get("media_url"),
                "attachments": payload.get("attachments", []),
                "mentions": payload.get("mentions", []),
                "reply_to_message_id": message_id,
                "forward_from_message_id": None,
            },
        )

    async def forward_message(self, user_id: str, message_id: str, payload: dict) -> dict:
        source_message = await self._get_accessible_message(user_id, message_id, "MESSAGE_NOT_FOUND")
        return await self.create_message(
            user_id,
            {
                "conversation_id": payload["conversation_id"],
                "contact_id": payload.get("contact_id"),
                "platform": payload["platform"],
                "direction": "outbound",
                "content": (payload.get("content") or source_message.get("content") or "").strip(),
                "media_url": payload.get("media_url") if "media_url" in payload else source_message.get("media_url"),
                "attachments": payload.get("attachments") if payload.get("attachments") is not None else source_message.get("attachments", []),
                "mentions": payload.get("mentions") if payload.get("mentions") is not None else source_message.get("mentions", []),
                "reply_to_message_id": None,
                "forward_from_message_id": message_id,
            },
        )
