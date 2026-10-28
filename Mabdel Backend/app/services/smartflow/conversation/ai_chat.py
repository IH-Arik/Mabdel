from __future__ import annotations

import logging
import asyncio
import time
from bson import ObjectId
from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.helpers import utc_now

logger = logging.getLogger(__name__)


class ConversationAIChatMixin:
    async def ensure_ai_conversation(self, user_id: str, conversation_id: str | None = None) -> dict:
        """Get-or-create the AI conversation to chat in. If conversation_id is given
        (an existing chat picked from the sidebar), it must be this user's own "ai"
        conversation — a stale or foreign id fails loudly rather than silently
        redirecting the message into a different chat. Otherwise falls back to the
        most recently active AI conversation (multiple can now exist — one per
        "New Chat" — so this is a sort, not just any match), creating one if this
        user has never chatted with the assistant before."""
        if conversation_id:
            if not ObjectId.is_valid(conversation_id):
                raise AppException(status_code=404, code="CONVERSATION_NOT_FOUND", message="Requested resource was not found.")
            conversation = await self.db.conversations.find_one(
                {"_id": ObjectId(conversation_id), "user_id": user_id, "type": "ai"}
            )
            if not conversation:
                raise AppException(status_code=404, code="CONVERSATION_NOT_FOUND", message="Requested resource was not found.")
            return conversation

        existing = await self.db.conversations.find({"user_id": user_id, "type": "ai"}).sort("updated_at", -1).limit(1).to_list(length=1)
        if existing:
            return existing[0]
        return await self.create_ai_conversation(user_id)

    async def create_ai_conversation(self, user_id: str) -> dict:
        """Always creates a fresh AI conversation — backs the "New Chat" button.
        Title starts unset; chat_with_ai auto-titles it from the first message,
        same as ChatGPT naming a chat after what you first said in it."""
        now = utc_now()
        doc = {
            "user_id": user_id,
            "title": None,
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

    @staticmethod
    def _auto_title_from_message(content: str) -> str:
        title = " ".join(content.strip().split())
        if len(title) > 60:
            title = title[:57].rstrip() + "..."
        return title or "New Chat"

    async def chat_with_ai(
        self,
        user_id: str,
        content: str,
        response_mode: str = "text",
        voice_id: str | None = None,
        conversation_id: str | None = None,
    ) -> dict:
        conversation = await self.ensure_ai_conversation(user_id, conversation_id)
        history = await self.db.messages.find({"user_id": user_id, "conversation_id": str(conversation["_id"])}).sort(
            "timestamp", -1
        ).limit(20).to_list(length=20)
        history.reverse()
        if not history and not conversation.get("title"):
            # First message in this chat and it has no title yet (a fresh "New
            # Chat", or a legacy single-conversation account) — name it from what
            # was just said, same as ChatGPT auto-titling a new chat.
            auto_title = self._auto_title_from_message(content)
            await self.db.conversations.update_one({"_id": conversation["_id"]}, {"$set": {"title": auto_title}})
            conversation = {**conversation, "title": auto_title}
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
        started_at = time.monotonic()
        try:
            ai_result = await self.ai_service.generate_response(content, history)
        except Exception as exc:
            asyncio.create_task(self.log_ai_usage(
                user_id, "ai_chat", "failed",
                response_time=time.monotonic() - started_at,
                error_type=type(exc).__name__,
                prompt_text=content,
            ))
            raise
        tokens_used = ai_result.get("tokens_used") or max(1, (len(content) + len(ai_result.get("content", ""))) // 4)
        asyncio.create_task(self.log_ai_usage(
            user_id, ai_result.get("command_type") or "ai_chat", "success",
            response_time=time.monotonic() - started_at,
            tokens_used=tokens_used,
            prompt_text=content,
            response_text=ai_result.get("content", ""),
        ))
        # create_message (ai reply) and log_ai_command are independent writes —
        # the latter doesn't touch ai_message at all — so run them concurrently
        # instead of paying for both round-trips back to back.
        ai_message, history_item = await asyncio.gather(
            self.create_message(
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
            ),
            self.log_ai_command(
                user_id=user_id,
                command_text=content,
                command_type=ai_result["command_type"],
                status="completed",
                is_replayable=True,
                preview_payload={
                    "workflow": ai_result.get("workflow"),
                    "navigation": ai_result.get("navigation"),
                },
            ),
        )
        asyncio.create_task(self.update_message(user_id, ai_message["id"], {"status": "read"}))
        audio = None
        if response_mode in {"audio", "both"}:
            audio = await self.ai_service.synthesize_speech(ai_message["content"], voice_id=voice_id)
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
        started_at = time.monotonic()
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
                await self.log_ai_usage(
                    user_id, "generate_image", "success",
                    response_time=time.monotonic() - started_at,
                    tokens_used=100,
                    prompt_text=prompt,
                )
            except Exception as e:
                logger.error("OpenAI image generation error: %s", e)
                await self.log_ai_usage(
                    user_id, "generate_image", "failed",
                    response_time=time.monotonic() - started_at,
                    error_type=type(e).__name__,
                    prompt_text=prompt,
                )

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
