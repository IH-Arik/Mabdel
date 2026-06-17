from __future__ import annotations

from datetime import timedelta
from math import ceil
import logging

from bson import ObjectId
import httpx
from pymongo import ReturnDocument

import secrets

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.core.exceptions import AppException
from app.core.realtime import conversation_realtime_hub
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class ConversationService(SmartFlowBase):
    async def create_conversation(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        member_ids = list(dict.fromkeys([user_id, *payload.get("member_ids", [])]))
        document = {
            "user_id": user_id,
            "title": payload.get("title"),
            "contact_id": payload.get("contact_id"),
            "type": payload.get("type", "direct"),
            "platform": payload.get("platform", "whatsapp"),
            "member_ids": member_ids,
            "archived": False,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.conversations.insert_one(document)
        document["_id"] = result.inserted_id
        return await self._serialize_conversation(document)

    async def get_conversation(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_owned_document(self.db.conversations, user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        return await self._serialize_conversation(conversation)

    async def list_conversations(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        platform: str | None,
        platforms: list[str] | None,
        archived: bool | None,
        unread_only: bool = False,
        type_filter: str | None = None,
    ) -> dict:
        filters: dict = {"user_id": user_id}
        platform_values = [value for value in (platforms or []) if value]
        if platform:
            platform_values.insert(0, platform)
        platform_values = list(dict.fromkeys(platform_values))
        if len(platform_values) == 1:
            filters["platform"] = platform_values[0]
        elif platform_values:
            filters["platform"] = {"$in": platform_values}
        if platform and not platform_values:
            filters["platform"] = platform
        if archived is not None:
            filters["archived"] = archived
        if type_filter:
            filters["type"] = type_filter
        conversations = await self.db.conversations.find(filters).sort("updated_at", -1).to_list(length=500)
        items = [await self._serialize_conversation(item) for item in conversations]
        if unread_only:
            items = [item for item in items if item.get("unread_count", 0) > 0]
        if search:
            needle = search.strip().lower()
            items = [item for item in items if self._conversation_matches_search(item, needle)]
        total = len(items)
        slice_start = (page - 1) * page_size
        summary = self._conversation_list_summary(items)
        return {
            "items": items[slice_start : slice_start + page_size],
            "summary": summary,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def archive_conversation(self, user_id: str, conversation_id: str, archived: bool) -> dict:
        conversation = await self._get_owned_document(self.db.conversations, user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        updated = await self.db.conversations.find_one_and_update(
            {"_id": conversation["_id"]},
            {"$set": {"archived": archived, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_conversation(updated)

    async def mark_conversation_read(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_owned_document(self.db.conversations, user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        now = utc_now()
        await self.db.messages.update_many(
            {"user_id": user_id, "conversation_id": conversation_id, "unread_count": {"$gt": 0}},
            {"$set": {"status": "read", "unread_count": 0, "read_at": now, "delivered_at": now}},
        )
        refreshed = await self.db.conversations.find_one({"_id": conversation["_id"]})
        serialized = await self._serialize_conversation(refreshed)
        await conversation_realtime_hub.publish(conversation_id, "conversation.read", {"unread_count": 0, "read_at": now})
        await self._publish_inbox_update(user_id, conversation_id)
        return serialized

    async def list_messages(
        self,
        user_id: str,
        conversation_id: str,
        page: int,
        page_size: int,
        search: str | None,
        platform: str | None,
    ) -> dict:
        await self._get_owned_document(self.db.conversations, user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        filters: dict = {"user_id": user_id, "conversation_id": conversation_id}
        if search:
            filters["content"] = {"$regex": search, "$options": "i"}
        if platform:
            filters["platform"] = platform
        page_result = await self._paginate(self.db.messages, filters, page, page_size, "timestamp")
        page_result["items"] = [await self._serialize_message(item) for item in page_result["items"]]
        return page_result

    async def create_message(self, user_id: str, payload: dict) -> dict:
        conversation = await self._get_owned_document(
            self.db.conversations, user_id, payload["conversation_id"], "CONVERSATION_NOT_FOUND"
        )
        await self._validate_message_links(user_id, payload)
        attachments = self._normalize_message_attachments(payload)
        mentions = await self._normalize_message_mentions(user_id, payload.get("mentions", []))
        content = (payload.get("content") or "").strip()
        now = utc_now()
        unread_count = 1 if payload["direction"] == "inbound" else 0
        document = {
            "user_id": user_id,
            "conversation_id": payload["conversation_id"],
            "contact_id": payload.get("contact_id"),
            "platform": payload["platform"],
            "direction": payload["direction"],
            "content": content,
            "media_url": payload.get("media_url") or self._primary_attachment_url(attachments),
            "attachments": attachments,
            "mentions": mentions,
            "status": "sent",
            "timestamp": now,
            "delivered_at": now if payload["direction"] == "inbound" else None,
            "unread_count": unread_count,
            "is_archived": False,
            "read_at": None,
            "reply_to_message_id": payload.get("reply_to_message_id"),
            "forward_from_message_id": payload.get("forward_from_message_id"),
            "provider_event_id": payload.get("provider_event_id"),
            "provider_message_id": payload.get("provider_message_id"),
            "external_account_id": payload.get("external_account_id"),
        }
        result = await self.db.messages.insert_one(document)
        document["_id"] = result.inserted_id
        await self.db.conversations.update_one(
            {"_id": conversation["_id"]},
            {"$set": {"updated_at": now}},
        )

        # Deliver outbound messages to the actual platform
        if payload["direction"] == "outbound":
            delivered = await self._deliver_outbound(user_id, payload["platform"], payload.get("contact_id"), content)
            if not delivered:
                document["status"] = "failed"
                await self.db.messages.update_one({"_id": document["_id"]}, {"$set": {"status": "failed"}})

        serialized = await self._serialize_message(document)
        await conversation_realtime_hub.publish(payload["conversation_id"], "message.created", serialized)
        await self._publish_inbox_update(user_id, payload["conversation_id"])
        return serialized

    async def update_message(self, user_id: str, message_id: str, updates: dict) -> dict:
        message = await self._get_owned_document(self.db.messages, user_id, message_id, "MESSAGE_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
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
        serialized = await self._serialize_message(updated)
        await conversation_realtime_hub.publish(updated["conversation_id"], "message.updated", serialized)
        await self._publish_inbox_update(user_id, updated["conversation_id"])
        return serialized

    async def reply_to_message(self, user_id: str, message_id: str, payload: dict) -> dict:
        source_message = await self._get_owned_document(self.db.messages, user_id, message_id, "MESSAGE_NOT_FOUND")
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
        source_message = await self._get_owned_document(self.db.messages, user_id, message_id, "MESSAGE_NOT_FOUND")
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

    async def get_typing_state(self, user_id: str, conversation_id: str) -> dict:
        await self._get_owned_document(self.db.conversations, user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        typing_doc = await self.db.typing_states.find_one({"user_id": user_id, "conversation_id": conversation_id})
        if not typing_doc:
            return {
                "conversation_id": conversation_id,
                "is_typing": False,
                "actor_name": None,
                "actor_type": "ai",
                "preview_text": None,
                "state_label": None,
                "updated_at": None,
                "expires_at": None,
            }

        safe = self._to_public(typing_doc)
        expires_at = safe.get("expires_at")
        is_active = bool(safe.get("is_typing")) and self._is_future_timestamp(expires_at)
        return {
            "conversation_id": conversation_id,
            "is_typing": is_active,
            "actor_name": safe.get("actor_name"),
            "actor_type": safe.get("actor_type", "ai"),
            "preview_text": safe.get("preview_text"),
            "state_label": safe.get("state_label"),
            "updated_at": safe.get("updated_at"),
            "expires_at": safe.get("expires_at"),
        }

    async def set_typing_state(self, user_id: str, conversation_id: str, payload: dict) -> dict:
        await self._get_owned_document(self.db.conversations, user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        now = utc_now()
        is_typing = bool(payload.get("is_typing", True))
        expires_at = now + timedelta(seconds=20) if is_typing else now
        updated = await self.db.typing_states.find_one_and_update(
            {"user_id": user_id, "conversation_id": conversation_id},
            {
                "$set": {
                    "user_id": user_id,
                    "conversation_id": conversation_id,
                    "is_typing": is_typing,
                    "actor_name": payload.get("actor_name"),
                    "actor_type": payload.get("actor_type", "ai"),
                    "preview_text": payload.get("preview_text"),
                    "state_label": payload.get("state_label"),
                    "updated_at": now,
                    "expires_at": expires_at,
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        response = {
            "conversation_id": conversation_id,
            "is_typing": is_typing,
            "actor_name": updated.get("actor_name"),
            "actor_type": updated.get("actor_type", "ai"),
            "preview_text": updated.get("preview_text"),
            "state_label": updated.get("state_label"),
            "updated_at": updated.get("updated_at"),
            "expires_at": updated.get("expires_at"),
        }
        await conversation_realtime_hub.publish(conversation_id, "typing.updated", response)
        return response

    async def ensure_ai_conversation(self, user_id: str) -> dict:
        conversation = await self.db.conversations.find_one({"user_id": user_id, "type": "ai"})
        if conversation:
            return conversation
        now = utc_now()
        doc = {
            "user_id": user_id,
            "title": "Mabdel AI",
            "contact_id": None,
            "type": "ai",
            "platform": "ai",
            "member_ids": [user_id],
            "archived": False,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.conversations.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def chat_with_ai(
        self,
        user_id: str,
        content: str,
        response_mode: str = "text",
        voice_id: str | None = None,
    ) -> dict:
        conversation = await self.ensure_ai_conversation(user_id)
        history = await self.db.messages.find({"user_id": user_id, "conversation_id": str(conversation["_id"])}).sort(
            "timestamp", 1
        ).limit(20).to_list(length=20)
        user_message = await self.create_message(
            user_id,
            {
                "conversation_id": str(conversation["_id"]),
                "platform": "ai",
                "direction": "inbound",
                "content": content,
                "contact_id": None,
                "media_url": None,
                "reply_to_message_id": None,
                "forward_from_message_id": None,
            },
        )
        ai_result = self.ai_service.generate_response(content, history)
        ai_message = await self.create_message(
            user_id,
            {
                "conversation_id": str(conversation["_id"]),
                "platform": "ai",
                "direction": "outbound",
                "content": ai_result["content"],
                "contact_id": None,
                "media_url": None,
                "reply_to_message_id": user_message["id"],
                "forward_from_message_id": None,
            },
        )
        ai_message = await self.update_message(user_id, ai_message["id"], {"status": "read"})
        history_item = await self.log_ai_command(
            user_id=user_id,
            command_text=content,
            command_type=ai_result["command_type"],
            status="completed",
            is_replayable=True,
            preview_payload={
                "workflow": ai_result.get("workflow"),
                "navigation": ai_result.get("navigation"),
            },
        )
        audio = None
        if response_mode in {"audio", "both"}:
            audio = self.ai_service.synthesize_speech(ai_message["content"], voice_id=voice_id)
        return {
            "conversation_id": str(conversation["_id"]),
            "state": ai_result["state"],
            "user_message": user_message,
            "ai_message": {**ai_message, "command_history_id": history_item["id"]},
            "workflow": ai_result.get("workflow"),
            "navigation": ai_result.get("navigation"),
            "audio": audio,
        }

    async def generate_ai_image(self, user_id: str, prompt: str) -> dict:
        image_url = None
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                response = client.images.generate(
                    model="dall-e-2",
                    prompt=prompt,
                    n=1,
                    size="512x512"
                )
                image_url = response.data[0].url
            except Exception as e:
                logger.error("OpenAI image generation error: %s", e)

        if not image_url:
            fallback_url = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800"
            topic_urls = {
                "web": "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800",
                "design": "https://images.unsplash.com/photo-1561070791-26c113006238?q=80&w=800",
                "business": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800",
                "coding": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800",
                "marketing": "https://images.unsplash.com/photo-1533750349088-cd871a92f311?q=80&w=800",
                "workspace": "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800",
                "ai": "https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=800",
                "mobile": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800",
            }
            for key, val in topic_urls.items():
                if key in prompt.lower():
                    fallback_url = val
                    break
            image_url = fallback_url

        return {"image_url": image_url}

    # ------------------------------------------------------------------
    # Group chat
    # ------------------------------------------------------------------
    async def create_group(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        member_ids = await self._normalize_group_member_ids(user_id, payload.get("member_ids", []))
        admin_ids = self._normalize_group_admin_ids(member_ids, payload.get("admin_ids", []))
        conversation = await self.create_conversation(
            user_id,
            {
                "title": payload["name"],
                "member_ids": member_ids,
                "type": "group",
                "platform": "ai",
                "contact_id": None,
            },
        )
        group = {
            "user_id": user_id,
            "owner_user_id": user_id,
            "name": payload["name"],
            "avatar_url": payload.get("avatar_url"),
            "description": payload.get("description"),
            "member_ids": member_ids,
            "admin_ids": admin_ids,
            "pending_invites": [],
            "is_active": True,
            "conversation_id": conversation["id"],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.groups.insert_one(group)
        group["_id"] = result.inserted_id
        return await self._serialize_group(group)

    async def get_group(self, user_id: str, group_id: str) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        return await self._serialize_group(group)

    async def list_groups(self, user_id: str, page: int, page_size: int, search: str | None) -> dict:
        filters = {"user_id": user_id, "is_active": {"$ne": False}}
        if search:
            filters["name"] = {"$regex": search, "$options": "i"}
        total = await self.db.groups.count_documents(filters)
        cursor = self.db.groups.find(filters).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size)
        groups = await cursor.to_list(length=page_size)
        items = [await self._serialize_group(item, include_members=False) for item in groups]
        return {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def update_group(self, user_id: str, group_id: str, updates: dict) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "member_ids" in clean_updates:
            clean_updates["member_ids"] = await self._normalize_group_member_ids(user_id, clean_updates["member_ids"])
        else:
            clean_updates["member_ids"] = list(dict.fromkeys(group.get("member_ids", [])))
        if "admin_ids" in clean_updates:
            clean_updates["admin_ids"] = self._normalize_group_admin_ids(clean_updates["member_ids"], clean_updates["admin_ids"])
        elif "member_ids" in updates:
            clean_updates["admin_ids"] = self._normalize_group_admin_ids(clean_updates["member_ids"], group.get("admin_ids", []))
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated, rename_only=not any(key in updates for key in {"member_ids", "admin_ids"}))
        return await self._serialize_group(updated)

    async def add_group_members(self, user_id: str, group_id: str, payload: dict) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        member_ids = await self._normalize_group_member_ids(
            user_id,
            [*group.get("member_ids", []), *payload.get("member_ids", [])],
        )
        admin_ids = self._normalize_group_admin_ids(
            member_ids,
            [*group.get("admin_ids", []), *payload.get("admin_ids", [])],
        )
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        return await self._serialize_group(updated)

    async def update_group_member_role(self, user_id: str, group_id: str, member_id: str, role: str) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        if member_id not in group.get("member_ids", []):
            raise AppException(status_code=404, code="GROUP_MEMBER_NOT_FOUND", message="Group member was not found.")
        admin_ids = set(group.get("admin_ids", []))
        if role == "admin":
            admin_ids.add(member_id)
        else:
            admin_ids.discard(member_id)
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"admin_ids": sorted(admin_ids), "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_group(updated)

    async def remove_group_member(self, user_id: str, group_id: str, member_id: str) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        if member_id not in group.get("member_ids", []):
            raise AppException(status_code=404, code="GROUP_MEMBER_NOT_FOUND", message="Group member was not found.")
        member_ids = [item for item in group.get("member_ids", []) if item != member_id]
        admin_ids = [item for item in group.get("admin_ids", []) if item != member_id]
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        return await self._serialize_group(updated)

    async def invite_group_member(self, user_id: str, group_id: str, payload: dict) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        pending_invites = list(group.get("pending_invites", []))
        for invite in pending_invites:
            same_email = payload.get("email") and invite.get("email") == payload.get("email")
            same_phone = payload.get("phone") and invite.get("phone") == payload.get("phone")
            if same_email or same_phone:
                raise AppException(status_code=409, code="GROUP_INVITE_EXISTS", message="A pending invite already exists.")
        pending_invites.append(
            {
                "id": secrets.token_hex(8),
                "email": payload.get("email"),
                "phone": payload.get("phone"),
                "name": payload.get("name"),
                "role": payload.get("role", "member"),
                "status": "pending",
                "invited_at": utc_now(),
            }
        )
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"pending_invites": pending_invites, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_group(updated)

    async def cancel_group_invite(self, user_id: str, group_id: str, invite_id: str) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        pending_invites = [invite for invite in group.get("pending_invites", []) if invite.get("id") != invite_id]
        if len(pending_invites) == len(group.get("pending_invites", [])):
            raise AppException(status_code=404, code="GROUP_INVITE_NOT_FOUND", message="Group invite was not found.")
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"pending_invites": pending_invites, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_group(updated)

    async def leave_group(self, user_id: str, group_id: str) -> dict:
        group = await self._get_active_owned_group(user_id, group_id)
        now = utc_now()
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"is_active": False, "left_at": now, "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if group.get("conversation_id") and ObjectId.is_valid(group["conversation_id"]):
            await self.db.conversations.update_one(
                {"_id": ObjectId(group["conversation_id"]), "user_id": user_id},
                {"$set": {"archived": True, "updated_at": now}},
            )
        return {"id": str(updated["_id"]), "left": True, "left_at": now}

    # ------------------------------------------------------------------
    # Outbound message delivery
    # ------------------------------------------------------------------

    async def _deliver_outbound(self, user_id: str, platform: str, contact_id: str | None, content: str) -> bool:
        """Send message to the actual platform. Returns True if delivered, False if failed/skipped."""
        if platform in {"ai", "internal"}:
            return True  # no external delivery needed

        contact_external_id = await self._get_contact_external_id(user_id, platform, contact_id)
        if not contact_external_id:
            return False

        integration = await self.db.social_integrations.find_one(
            {"user_id": user_id, "platform": platform, "status": "connected"}
        )
        if not integration:
            return False

        from app.core.crypto import decrypt_value
        access_token = decrypt_value(integration["access_token_encrypted"]) if integration.get("access_token_encrypted") else None

        try:
            if platform == "facebook_messenger":
                return await self._deliver_meta_messenger(access_token, contact_external_id, content)
            elif platform == "instagram":
                return await self._deliver_instagram(access_token, contact_external_id, content)
            elif platform == "whatsapp":
                return await self._deliver_whatsapp(integration, access_token, contact_external_id, content)
            elif platform == "telegram":
                return await self._deliver_telegram(access_token, contact_external_id, content)
            else:
                # Platform doesn't support outbound (e.g. Snapchat)
                return False
        except Exception:
            return False

    async def _deliver_meta_messenger(self, access_token: str | None, recipient_id: str, content: str) -> bool:
        if not access_token:
            return False
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://graph.facebook.com/v20.0/me/messages",
                json={"recipient": {"id": recipient_id}, "message": {"text": content}},
                params={"access_token": access_token},
            )
        return resp.status_code < 400

    async def _deliver_instagram(self, access_token: str | None, recipient_id: str, content: str) -> bool:
        if not access_token:
            return False
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://graph.facebook.com/v20.0/me/messages",
                json={"recipient": {"id": recipient_id}, "message": {"text": content}},
                params={"access_token": access_token},
            )
        return resp.status_code < 400

    async def _deliver_whatsapp(self, integration: dict, access_token: str | None, recipient_id: str, content: str) -> bool:
        # Official Meta WhatsApp Cloud API
        phone_number_id = (integration.get("provider_metadata") or {}).get("phone_number_id") or integration.get("external_account_id")
        if access_token and phone_number_id and access_token != "openwa_manual_bypass":
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"https://graph.facebook.com/v20.0/{phone_number_id}/messages",
                    json={
                        "messaging_product": "whatsapp",
                        "to": recipient_id,
                        "type": "text",
                        "text": {"body": content},
                    },
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            return resp.status_code < 400

        # Fallback: OpenWA local gateway
        gateway_url = integration.get("whatsapp_gateway_url") or settings.WHATSAPP_GATEWAY_URL
        if not gateway_url:
            logger.warning("WhatsApp gateway URL not configured; cannot send message to %s", recipient_id)
            return False
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{gateway_url.rstrip('/')}/send-message",
                json={"to": recipient_id, "message": content},
            )
        return resp.status_code < 400

    async def _deliver_telegram(self, bot_token: str | None, chat_id: str, content: str) -> bool:
        if not bot_token:
            return False
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": content},
            )
        return resp.status_code < 400

    async def _get_contact_external_id(self, user_id: str, platform: str, contact_id: str | None) -> str | None:
        if not contact_id:
            return None
        contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
        if not contact:
            return None
        for identity in contact.get("identities", []):
            if identity.get("platform") == platform:
                return identity.get("external_id")
        return None

    async def delete_group(self, user_id: str, group_id: str) -> None:
        group = await self._get_active_owned_group(user_id, group_id)
        await self.db.groups.delete_one({"_id": group["_id"]})
        conversation_id = group.get("conversation_id")
        if conversation_id and ObjectId.is_valid(conversation_id):
            await self.db.conversations.delete_one({"_id": ObjectId(conversation_id), "user_id": user_id})
            await self.db.messages.delete_many({"conversation_id": conversation_id, "user_id": user_id})
            await self.db.typing_states.delete_many({"conversation_id": conversation_id, "user_id": user_id})
