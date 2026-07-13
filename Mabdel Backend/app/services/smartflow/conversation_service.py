from __future__ import annotations

import asyncio
from datetime import timedelta
from math import ceil
import logging
from pathlib import Path

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
    async def _publish_global_chat_inbox_updates(self, conversation: dict) -> None:
        for member_id in conversation.get("member_ids", []):
            try:
                await self._publish_inbox_update(member_id, str(conversation["_id"]))
            except Exception:
                continue

    async def _find_global_chat_group(self, organization_id: str, owner_id: str | None = None) -> dict | None:
        queries = [
            {"organization_id": organization_id, "is_global_chat": True},
            {"owner_user_id": organization_id, "is_global_chat": True},
        ]
        if owner_id:
            queries.extend(
                [
                    {"owner_user_id": owner_id, "is_global_chat": True},
                    {"user_id": owner_id, "is_global_chat": True, "organization_id": {"$exists": False}},
                ]
            )
        for query in queries:
            group = await self.db.groups.find_one(query)
            if group:
                return group
        return None

    async def _resolve_global_chat_owner(self, organization_id: str, fallback_owner_id: str | None = None) -> dict | None:
        owner = await self.db.users.find_one(
            {
                "organization_id": organization_id,
                "$or": [{"primary_role": "owner"}, {"role": "owner"}],
            }
        )
        if owner:
            return owner
        if fallback_owner_id and ObjectId.is_valid(fallback_owner_id):
            return await self.db.users.find_one({"_id": ObjectId(fallback_owner_id)})
        return None

    async def _sync_global_chat_member_lists(self, conversation_id: str, member_ids: list[str]) -> None:
        if not ObjectId.is_valid(conversation_id):
            return
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"member_ids": list(dict.fromkeys(member_ids)), "updated_at": utc_now()}},
        )

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
        return await self._serialize_conversation(document, viewer_user_id=user_id)

    async def get_conversation(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        return await self._serialize_conversation(conversation, viewer_user_id=user_id)

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

        user = await self._get_user_document(user_id)
        if self._user_has_global_chat_access(user) and user.get("organization_id"):
            global_chat_filters: dict = {
                "organization_id": user.get("organization_id"),
                "is_global_chat": True,
                "member_ids": user_id,
                "is_active": {"$ne": False},
            }
            if len(platform_values) == 1:
                global_chat_filters["platform"] = platform_values[0]
            elif platform_values:
                global_chat_filters["platform"] = {"$in": platform_values}
            if archived is not None:
                global_chat_filters["archived"] = archived
            if type_filter:
                global_chat_filters["type"] = type_filter
            global_chats = await self.db.conversations.find(global_chat_filters).sort("updated_at", -1).to_list(length=20)
            existing_ids = {item["_id"] for item in conversations}
            conversations.extend([item for item in global_chats if item["_id"] not in existing_ids])

        items = [await self._serialize_conversation(item, viewer_user_id=user_id) for item in conversations]
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
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        if conversation.get("is_global_chat"):
            raise AppException(status_code=400, code="GLOBAL_CHAT_ARCHIVE_UNSUPPORTED", message="Global chat cannot be archived individually.")
        updated = await self.db.conversations.find_one_and_update(
            {"_id": conversation["_id"]},
            {"$set": {"archived": archived, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_conversation(updated, viewer_user_id=user_id)

    async def mark_conversation_read(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        now = utc_now()
        if conversation.get("is_global_chat"):
            await self.db.messages.update_many(
                {"conversation_id": conversation_id, "sender_user_id": {"$ne": user_id}},
                {"$addToSet": {"read_by": user_id}, "$set": {"updated_at": now}},
            )
        else:
            await self.db.messages.update_many(
                {"user_id": user_id, "conversation_id": conversation_id, "unread_count": {"$gt": 0}},
                {"$set": {"status": "read", "unread_count": 0, "read_at": now, "delivered_at": now}},
            )
        refreshed = await self.db.conversations.find_one({"_id": conversation["_id"]})
        serialized = await self._serialize_conversation(refreshed, viewer_user_id=user_id)
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
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        filters: dict = {"conversation_id": conversation_id}
        if not conversation.get("is_global_chat"):
            filters["user_id"] = user_id
        if search:
            filters["content"] = {"$regex": search, "$options": "i"}
        if platform:
            filters["platform"] = platform
        page_result = await self._paginate(self.db.messages, filters, page, page_size, "timestamp")
        page_result["items"] = [
            await self._serialize_message({**item, "is_global_chat": conversation.get("is_global_chat")}, viewer_user_id=user_id)
            for item in page_result["items"]
        ]
        return page_result

    async def create_message(self, user_id: str, payload: dict) -> dict:
        conversation = await self._get_accessible_conversation(user_id, payload["conversation_id"], "CONVERSATION_NOT_FOUND")
        await self._validate_message_links(user_id, payload)
        attachments = self._normalize_message_attachments(payload)
        mentions = await self._normalize_message_mentions(user_id, payload.get("mentions", []))
        content = (payload.get("content") or "").strip()
        now = utc_now()
        unread_count = 1 if payload["direction"] == "inbound" else 0
        document = {
            "user_id": user_id,
            "sender_user_id": user_id if conversation.get("is_global_chat") else None,
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
            "read_by": [user_id] if conversation.get("is_global_chat") else [],
        }
        result = await self.db.messages.insert_one(document)
        document["_id"] = result.inserted_id
        await self.db.conversations.update_one(
            {"_id": conversation["_id"]},
            {"$set": {"updated_at": now}},
        )

        serialized = await self._serialize_message(document, viewer_user_id=user_id)
        await conversation_realtime_hub.publish(payload["conversation_id"], "message.created", serialized)
        if conversation.get("is_global_chat"):
            await self._publish_global_chat_inbox_updates(conversation)
        else:
            await self._publish_inbox_update(user_id, payload["conversation_id"])

        if payload["direction"] == "outbound":
            asyncio.create_task(
                self._finalize_outbound_delivery(
                    user_id=user_id,
                    conversation_id=payload["conversation_id"],
                    message_id=str(document["_id"]),
                    platform=payload["platform"],
                    contact_id=payload.get("contact_id"),
                    content=content,
                )
            )
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
        serialized = await self._serialize_message(updated, viewer_user_id=user_id)
        await conversation_realtime_hub.publish(updated["conversation_id"], "message.updated", serialized)
        conversation = await self.db.conversations.find_one({"_id": ObjectId(updated["conversation_id"])})
        if conversation and conversation.get("is_global_chat"):
            await self._publish_global_chat_inbox_updates(conversation)
        else:
            await self._publish_inbox_update(user_id, updated["conversation_id"])
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

    async def get_typing_state(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        if conversation.get("is_global_chat"):
            typing_doc = await self.db.typing_states.find_one(
                {"conversation_id": conversation_id, "is_typing": True, "user_id": {"$ne": user_id}},
                sort=[("updated_at", -1)],
            )
        else:
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
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
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
        if conversation.get("is_global_chat"):
            await self._publish_global_chat_inbox_updates(conversation)
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
        group = await self._get_active_group_for_member(user_id, group_id)
        return await self._serialize_group(group)

    async def list_groups(self, user_id: str, page: int, page_size: int, search: str | None) -> dict:
        filters = {"user_id": user_id, "is_active": {"$ne": False}}
        if search:
            filters["name"] = {"$regex": search, "$options": "i"}
        cursor = self.db.groups.find(filters).sort("updated_at", -1)
        groups = await cursor.to_list(length=page_size)

        user = await self._get_user_document(user_id)
        if self._user_has_global_chat_access(user) and user.get("organization_id"):
            global_filters: dict = {
                "organization_id": user.get("organization_id"),
                "is_global_chat": True,
                "member_ids": user_id,
                "is_active": {"$ne": False},
            }
            if search:
                global_filters["name"] = {"$regex": search, "$options": "i"}
            global_groups = await self.db.groups.find(global_filters).sort("updated_at", -1).to_list(length=10)
            existing_ids = {item["_id"] for item in groups}
            groups.extend([item for item in global_groups if item["_id"] not in existing_ids])

        groups = sorted(groups, key=lambda item: item.get("updated_at") or item.get("created_at"), reverse=True)
        total = len(groups)
        slice_start = (page - 1) * page_size
        groups = groups[slice_start : slice_start + page_size]
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
        group = await self._get_active_group_for_admin(user_id, group_id)
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
        group = await self._get_active_group_for_admin(user_id, group_id)
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
        group = await self._get_active_group_for_admin(user_id, group_id)
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
        group = await self._get_active_group_for_admin(user_id, group_id)
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
        group = await self._get_active_group_for_admin(user_id, group_id)
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
        group = await self._get_active_group_for_admin(user_id, group_id)
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
        group = await self._get_active_group_for_member(user_id, group_id)
        if group.get("owner_user_id") == user_id or group.get("user_id") == user_id:
            raise AppException(
                status_code=400,
                code="GROUP_OWNER_CANNOT_LEAVE",
                message="The group owner cannot leave this group. Delete it instead.",
            )
        member_ids = [m for m in group.get("member_ids", []) if m != user_id]
        admin_ids = [m for m in group.get("admin_ids", []) if m != user_id]
        now = utc_now()
        
        updates = {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": now}
        if not member_ids:
            updates["is_active"] = False
            updates["left_at"] = now
            
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": updates},
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

    async def _finalize_outbound_delivery(
        self,
        *,
        user_id: str,
        conversation_id: str,
        message_id: str,
        platform: str,
        contact_id: str | None,
        content: str,
    ) -> None:
        delivered = await self._deliver_outbound(user_id, platform, contact_id, content)
        if delivered or not ObjectId.is_valid(message_id):
            return

        updated = await self.db.messages.find_one_and_update(
            {"_id": ObjectId(message_id), "user_id": user_id},
            {"$set": {"status": "failed"}},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            return

        serialized = await self._serialize_message(updated)
        await conversation_realtime_hub.publish(conversation_id, "message.updated", serialized)
        await self._publish_inbox_update(user_id, conversation_id)

    async def ensure_global_chat(self, organization_id: str, business_name: str, owner_id: str) -> dict:
        """Ensure a global chat exists for the organization."""
        owner = await self._resolve_global_chat_owner(organization_id, owner_id)
        owner_user_id = str((owner or {}).get("_id") or owner_id or organization_id)
        display_name = business_name or (owner or {}).get("business_name") or (owner or {}).get("full_name") or "Organization"
        group = await self._find_global_chat_group(organization_id, owner_user_id)
        if group:
            group = await self.db.groups.find_one_and_update(
                {"_id": group["_id"]},
                {
                    "$set": {
                        "organization_id": organization_id,
                        "owner_user_id": owner_user_id,
                        "user_id": owner_user_id,
                        "is_global_chat": True,
                        "is_system_managed": True,
                        "is_active": True,
                        "global_chat_type": "organization",
                        "updated_at": utc_now(),
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
            if group.get("conversation_id"):
                await self.db.conversations.update_one(
                    {"_id": ObjectId(group["conversation_id"])},
                    {
                        "$set": {
                            "organization_id": organization_id,
                            "is_global_chat": True,
                            "is_system_managed": True,
                            "is_active": True,
                            "global_chat_type": "organization",
                            "platform": "global_chat",
                            "title": group.get("name") or f"{display_name} Global Chat",
                        }
                    },
                )
                await self._sync_global_chat_member_lists(group["conversation_id"], group.get("member_ids", []))
            return group

        now = utc_now()
        conversation = await self.create_conversation(
            owner_user_id,
            {
                "title": f"{display_name} Global Chat",
                "member_ids": [owner_user_id],
                "type": "group",
                "platform": "global_chat",
                "contact_id": None,
            },
        )
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation["id"])},
            {
                "$set": {
                    "organization_id": organization_id,
                    "is_global_chat": True,
                    "is_system_managed": True,
                    "is_active": True,
                    "global_chat_type": "organization",
                }
            },
        )
        group_doc = {
            "user_id": owner_user_id,
            "owner_user_id": owner_user_id,
            "name": f"{display_name} Global Chat",
            "avatar_url": None,
            "description": f"Global chat for {display_name}",
            "member_ids": [owner_user_id],
            "admin_ids": [owner_user_id],
            "pending_invites": [],
            "is_active": True,
            "is_global_chat": True,
            "is_system_managed": True,
            "organization_id": organization_id,
            "global_chat_type": "organization",
            "conversation_id": conversation["id"],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.groups.insert_one(group_doc)
        group_doc["_id"] = result.inserted_id
        return group_doc

    async def sync_user_global_chat_membership(self, user_id: str, organization_id: str | None = None) -> dict | None:
        user = await self._get_user_document(user_id)
        org_id = organization_id or user.get("organization_id")
        if not org_id:
            return None

        owner = await self._resolve_global_chat_owner(org_id, str(user["_id"]))
        business_name = (owner or {}).get("business_name") or (owner or {}).get("full_name") or "Organization"
        group = await self.ensure_global_chat(org_id, business_name, str((owner or {}).get("_id") or user["_id"]))
        is_eligible = self._user_has_global_chat_access(user) and user.get("organization_id") == org_id

        if is_eligible:
            return await self.add_user_to_global_chat(org_id, user_id)
        return await self.remove_user_from_global_chat(org_id, user_id)

    async def backfill_global_chats(self) -> dict:
        owners = await self.db.users.find({"$or": [{"primary_role": "owner"}, {"role": "owner"}]}).to_list(length=2000)
        created_or_checked = 0
        synced_users = 0
        for owner in owners:
            owner_id = str(owner["_id"])
            organization_id = owner.get("organization_id") or owner_id
            await self.ensure_global_chat(organization_id, owner.get("business_name") or owner.get("full_name") or "Organization", owner_id)
            created_or_checked += 1
            org_users = await self.db.users.find({"organization_id": organization_id}).to_list(length=2000)
            for org_user in org_users:
                await self.sync_user_global_chat_membership(str(org_user["_id"]), organization_id)
                synced_users += 1
        return {"organizations_processed": created_or_checked, "users_synced": synced_users}

    async def add_user_to_global_chat(self, organization_id: str, user_id: str) -> dict | None:
        """Add a user to the organization's global chat."""
        group = await self._find_global_chat_group(organization_id)
        if not group:
            return None

        member_ids = list(dict.fromkeys([*group.get("member_ids", []), user_id]))
        admin_ids = list(dict.fromkeys(group.get("admin_ids", [])))
        user = await self.db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        role_slug = str((user or {}).get("primary_role") or (user or {}).get("role") or "user").lower()
        if role_slug in {"owner", "admin", "manager"}:
            admin_ids = list(dict.fromkeys([*admin_ids, user_id]))
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        await self._sync_global_chat_member_lists(updated.get("conversation_id"), member_ids)
        if updated.get("conversation_id"):
            await conversation_realtime_hub.publish(
                updated["conversation_id"],
                "global_member.added",
                {"user_id": user_id, "organization_id": organization_id},
            )
            await self._publish_global_chat_inbox_updates(
                {"_id": ObjectId(updated["conversation_id"]), "member_ids": member_ids}
            )
        return updated

    async def remove_user_from_global_chat(self, organization_id: str, user_id: str) -> dict | None:
        """Remove a user from the organization's global chat."""
        group = await self._find_global_chat_group(organization_id)
        if not group:
            return None
        user = await self.db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        if (
            user
            and user.get("organization_id") == organization_id
            and str(user.get("primary_role") or user.get("role") or "").lower() == "owner"
        ):
            return group

        member_ids = [m for m in group.get("member_ids", []) if m != user_id]
        admin_ids = [m for m in group.get("admin_ids", []) if m != user_id]
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        await self._sync_global_chat_member_lists(updated.get("conversation_id"), member_ids)
        if updated.get("conversation_id"):
            await conversation_realtime_hub.publish(
                updated["conversation_id"],
                "global_member.removed",
                {"user_id": user_id, "organization_id": organization_id},
            )
            await conversation_realtime_hub.disconnect_user(updated["conversation_id"], user_id)
            await self._publish_inbox_update(user_id, updated["conversation_id"])
            await self._publish_global_chat_inbox_updates(
                {"_id": ObjectId(updated["conversation_id"]), "member_ids": member_ids}
            )
        return updated

    async def delete_group(self, user_id: str, group_id: str) -> None:
        group = await self._get_active_group_for_admin(user_id, group_id)
        await self.db.groups.delete_one({"_id": group["_id"]})
        conversation_id = group.get("conversation_id")
        if conversation_id and ObjectId.is_valid(conversation_id):
            await self.db.conversations.delete_one({"_id": ObjectId(conversation_id), "user_id": user_id})
            await self.db.messages.delete_many({"conversation_id": conversation_id, "user_id": user_id})
            await self.db.typing_states.delete_many({"conversation_id": conversation_id, "user_id": user_id})
