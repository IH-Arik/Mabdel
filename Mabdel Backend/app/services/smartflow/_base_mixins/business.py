from __future__ import annotations


from bson import ObjectId
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.utils.helpers import utc_now


DEFAULT_SUBSCRIPTION_PLANS: list[dict] = [
    {
        "code": "starter",
        "name": "Starter",
        "description": "Capture leads, respond instantly, and never miss a customer.",
        "price_cents": 29900,
        "currency": "USD",
        "billing_interval": "month",
        "features": [
            "1 User",
            "AI Receptionist (calls + SMS handling)",
            "CRM (leads, contacts, pipeline)",
            "Calendar booking & scheduling",
            "Missed call text back",
            "Basic 1-to-1 follow-up automation",
            "Mobile app access"
        ],
        "is_popular": False,
        "is_active": True,
        "display_order": 1,
    },
    {
        "code": "growth",
        "name": "Growth",
        "description": "Turn conversations into customers with automation and marketing.",
        "price_cents": 69900,
        "currency": "USD",
        "billing_interval": "month",
        "features": [
            "Everything in Starter",
            "Unlimited users",
            "Facebook + Instagram messaging integration",
            "AI auto-replies to social media posts",
            "AI reads & responds to messages",
            "Bulk SMS campaigns",
            "Bulk email campaigns",
            "AI social media post creation",
            "AI marketing content generation",
            "Team inbox (shared conversations)",
            "Advanced automation workflows"
        ],
        "is_popular": True,
        "is_active": True,
        "display_order": 2,
    },
    {
        "code": "pro",
        "name": "Pro",
        "description": "Full AI-powered business system for operations and scale.",
        "price_cents": 99900,
        "currency": "USD",
        "billing_interval": "month",
        "features": [
            "Everything in Growth",
            "Invoice generation & billing tools",
            "Business document generation",
            "Priority support"
        ],
        "is_popular": False,
        "is_active": True,
        "display_order": 3,
    },
]

SUPPORT_AGENT = {
    "id": "live-support",
    "name": "Live Support",
    "display_name": "Alex",
    "avatar_url": None,
    "presence": "online",
    "status_label": "Online now",
}

SUPPORT_QUICK_REPLIES = [
    {"key": "billing", "label": "Billing Issue"},
    {"key": "technical", "label": "Technical Help"},
    {"key": "account", "label": "Account Problem"},
]


class BusinessMixin:
    @staticmethod
    def _default_notification_preferences() -> dict:
        return {
            "general_notification": True,
            "sound": True,
            "vibrate": True,
            "new_messages": True,
            "missed_calls": True,
            "scheduled_calls": True,
            "ai_tasks": True,
            "calendar_reminders": True,
        }

    def _merge_notification_preferences(self, current: dict | None = None, updates: dict | None = None) -> dict:
        preferences = self._default_notification_preferences()
        preferences.update({key: value for key, value in (current or {}).items() if value is not None})
        preferences.update({key: value for key, value in (updates or {}).items() if value is not None})
        return preferences

    def _serialize_business_profile(self, profile: dict | None, user: dict) -> dict:
        safe = self._to_public(profile)
        address = safe.get("office_address") or {}
        office_address_text = safe.get("office_address_text") or self._business_address_text(address)
        profile_completed = self._business_profile_completed(safe)
        return {
            "id": safe.get("id"),
            "business_name": safe.get("business_name"),
            "email": safe.get("email") or user.get("email"),
            "phone_number": safe.get("phone_number"),
            "website": safe.get("website"),
            "logo_url": self._normalize_media_url(safe.get("logo_url")),
            "office_address": {
                "street_address": address.get("street_address"),
                "suite": address.get("suite"),
                "city": address.get("city"),
                "state": address.get("state"),
                "postal_code": address.get("postal_code"),
                "country": address.get("country"),
            },
            "office_address_text": office_address_text,
            "office_location_lines": self._business_address_lines(address, office_address_text),
            "profile_completed": profile_completed,
            "created_at": safe.get("created_at"),
            "updated_at": safe.get("updated_at"),
        }

    @staticmethod
    def _business_profile_completed(profile: dict) -> bool:
        return bool(
            profile.get("business_name")
            and profile.get("email")
            and profile.get("phone_number")
            and (profile.get("office_address") or profile.get("office_address_text"))
        )

    @staticmethod
    def _business_address_text(address: dict) -> str | None:
        lines = BusinessMixin._business_address_lines(address, None)
        return "\n".join(lines) if lines else None

    @staticmethod
    def _business_address_lines(address: dict, fallback_text: str | None) -> list[str]:
        lines = [
            address.get("street_address"),
            address.get("suite"),
            ", ".join(part for part in [address.get("city"), address.get("state")] if part),
            address.get("postal_code"),
            address.get("country"),
        ]
        cleaned = [line.strip() for line in lines if isinstance(line, str) and line.strip()]
        if cleaned:
            return cleaned
        if fallback_text:
            return [line.strip() for line in fallback_text.splitlines() if line.strip()]
        return []

    async def _ensure_default_subscription_plans(self) -> None:
        now = utc_now()
        for plan in DEFAULT_SUBSCRIPTION_PLANS:
            await self.db.subscription_plans.update_one(
                {"code": plan["code"]},
                {
                    "$setOnInsert": {
                        **plan,
                        "created_at": now,
                        "updated_at": now,
                    }
                },
                upsert=True,
            )

    @staticmethod
    def _serialize_subscription_plan(plan: dict | None) -> dict:
        plan = plan or DEFAULT_SUBSCRIPTION_PLANS[0]
        return {
            "code": plan["code"],
            "name": plan["name"],
            "description": plan["description"],
            "price_cents": int(plan.get("price_cents", 0)),
            "currency": plan.get("currency", "USD"),
            "billing_interval": plan.get("billing_interval", "month"),
            "features": plan.get("features", []),
            "is_popular": bool(plan.get("is_popular", False)),
            "is_active": bool(plan.get("is_active", True)),
            "display_order": int(plan.get("display_order", 0)),
        }

    async def _get_support_session(self, user: dict, session_id: str | None = None) -> dict:
        user_id = str(user["_id"])
        if session_id:
            if not ObjectId.is_valid(session_id):
                raise AppException(status_code=404, code="SUPPORT_SESSION_NOT_FOUND", message="Support session was not found.")
            session = await self.db.support_sessions.find_one({"_id": ObjectId(session_id), "user_id": user_id})
            if not session:
                raise AppException(status_code=404, code="SUPPORT_SESSION_NOT_FOUND", message="Support session was not found.")
            return session
        session_payload = await self.get_or_create_support_session(user)
        session = await self.db.support_sessions.find_one({"_id": ObjectId(session_payload["id"]), "user_id": user_id})
        if not session:
            raise AppException(status_code=404, code="SUPPORT_SESSION_NOT_FOUND", message="Support session was not found.")
        return session

    async def _create_support_message(
        self,
        *,
        user_id: str,
        session_id: str,
        sender_type: str,
        sender_name: str,
        sender_avatar_url: str | None,
        content: str,
        attachment_url: str | None = None,
    ) -> dict:
        now = utc_now()
        document = {
            "user_id": user_id,
            "session_id": session_id,
            "sender_type": sender_type,
            "sender_name": sender_name,
            "sender_avatar_url": sender_avatar_url,
            "content": content,
            "attachment_url": attachment_url,
            "created_at": now,
        }
        result = await self.db.support_messages.insert_one(document)
        document["_id"] = result.inserted_id
        return document

    async def _serialize_support_session(self, user_id: str, session: dict, include_messages: bool = True) -> dict:
        messages: list[dict] = []
        if include_messages:
            latest = (
                await self.db.support_messages.find({"user_id": user_id, "session_id": str(session["_id"])})
                .sort("created_at", 1)
                .limit(50)
                .to_list(length=50)
            )
            messages = [self._serialize_support_message(message) for message in latest]
        return {
            "id": str(session["_id"]),
            "status": session.get("status", "open"),
            "topic": session.get("topic", "general"),
            "agent": session.get("agent") or SUPPORT_AGENT,
            "quick_replies": SUPPORT_QUICK_REPLIES,
            "support_typing": bool(session.get("support_typing", False)),
            "started_at": session.get("created_at"),
            "updated_at": session.get("updated_at"),
            "latest_messages": messages,
        }

    def _serialize_support_message(self, message: dict) -> dict:
        safe = self._to_public(message)
        return {
            "id": safe["id"],
            "session_id": safe["session_id"],
            "sender_type": safe.get("sender_type", "support"),
            "sender_name": safe.get("sender_name") or SUPPORT_AGENT["display_name"],
            "sender_avatar_url": safe.get("sender_avatar_url"),
            "content": safe.get("content", ""),
            "attachment_url": safe.get("attachment_url"),
            "created_at": safe.get("created_at"),
        }

    # Support session creation is shared (referenced by _get_support_session)
    async def get_or_create_support_session(self, user: dict, topic: str = "general") -> dict:
        user_id = str(user["_id"])
        session = await self.db.support_sessions.find_one(
            {"user_id": user_id, "status": "open"},
            sort=[("updated_at", -1), ("created_at", -1)],
        )
        if not session:
            now = utc_now()
            session = {
                "user_id": user_id,
                "status": "open",
                "topic": topic,
                "agent": SUPPORT_AGENT,
                "created_at": now,
                "updated_at": now,
            }
            result = await self.db.support_sessions.insert_one(session)
            session["_id"] = result.inserted_id
            await self._create_support_message(
                user_id=user_id,
                session_id=str(session["_id"]),
                sender_type="support",
                sender_name=SUPPORT_AGENT["display_name"],
                sender_avatar_url=SUPPORT_AGENT.get("avatar_url"),
                content="Hi there! I'm Alex from SmartFlow. How can I help you streamline your workflow today?",
            )
        elif topic != "general" and session.get("topic") != topic:
            session = await self.db.support_sessions.find_one_and_update(
                {"_id": session["_id"]},
                {"$set": {"topic": topic, "updated_at": utc_now()}},
                return_document=ReturnDocument.AFTER,
            )
        return await self._serialize_support_session(user_id, session)
