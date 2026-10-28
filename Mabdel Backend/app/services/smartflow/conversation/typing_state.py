from __future__ import annotations

from pymongo import ReturnDocument
from datetime import timedelta
from app.core.realtime import conversation_realtime_hub
from app.utils.helpers import utc_now


class ConversationTypingMixin:
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
