from __future__ import annotations

import asyncio
import base64
import hashlib
import re
import secrets
import json
from datetime import date, datetime, timedelta
from io import BytesIO
from math import ceil
from urllib.parse import quote_plus
from urllib.parse import urlencode

from bson import ObjectId
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.core.realtime import conversation_realtime_hub, inbox_realtime_hub
from app.core.security import hash_password, verify_password
from app.services.call_service import CallService
from app.services.email_service import EmailService
from app.services.mabdel_ai_service import MabdelAIService
from app.services.media_storage_service import MediaStorageService
from app.services.push_notification_service import PushNotificationService
from app.services.social_provider_adapters import get_social_provider_adapter
from app.utils.helpers import serialize_mongo_document, serialize_mongo_documents, utc_now
from app.workflows.graph import run_assistant_workflow


DEFAULT_SUBSCRIPTION_PLANS: list[dict] = [
    {
        "code": "free",
        "name": "Free",
        "description": "Core Mabdel access for getting started.",
        "price_cents": 0,
        "currency": "USD",
        "billing_interval": "month",
        "features": ["Profile and settings", "Business profile", "AI command history"],
        "is_popular": False,
        "is_active": True,
        "display_order": 1,
    },
    {
        "code": "pro",
        "name": "Pro",
        "description": "Advanced SmartFlow tools for growing teams.",
        "price_cents": 1900,
        "currency": "USD",
        "billing_interval": "month",
        "features": ["Unlimited SmartFlow history", "Business automation", "Priority notifications"],
        "is_popular": True,
        "is_active": True,
        "display_order": 2,
    },
    {
        "code": "business",
        "name": "Business",
        "description": "Team-ready workflows with expanded support.",
        "price_cents": 4900,
        "currency": "USD",
        "billing_interval": "month",
        "features": ["Team workflows", "Advanced integrations", "Priority support"],
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


class SmartFlowBase:
    """Shared base for all SmartFlow domain services.

    Holds the database handle, shared service dependencies, and every cross-cutting
    helper used by multiple domain services. Two public methods (``log_ai_command`` and
    ``create_notification``) live here because they are invoked from nearly every domain.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.ai_service = MabdelAIService()
        self.call_service = CallService()
        self.media_storage = MediaStorageService()

    # ------------------------------------------------------------------
    # Shared public methods (used across many domains)
    # ------------------------------------------------------------------
    async def log_ai_command(
        self,
        user_id: str,
        command_text: str,
        command_type: str,
        status: str,
        is_replayable: bool,
        *,
        related_resource: dict | None = None,
        preview_payload: dict | None = None,
        timestamp: datetime | None = None,
    ) -> dict:
        document = {
            "user_id": user_id,
            "command_text": command_text,
            "command_type": command_type,
            "status": status,
            "timestamp": timestamp or utc_now(),
            "is_replayable": is_replayable,
            "related_resource": related_resource,
            "preview_payload": preview_payload,
        }
        result = await self.db.ai_command_history.insert_one(document)
        document["_id"] = result.inserted_id
        return self._serialize_history_item(document)

    async def create_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        body: str,
        *,
        action_url: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        document = {
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "body": body,
            "read": False,
            "action_url": action_url,
            "metadata": metadata or {},
            "created_at": utc_now(),
        }
        result = await self.db.notifications.insert_one(document)
        document["_id"] = result.inserted_id
        public_document = self._serialize_notification(document)
        await PushNotificationService(self.db).enqueue_notification(user_id, public_document)
        return public_document

    # ------------------------------------------------------------------
    # Generic persistence / serialization utilities
    # ------------------------------------------------------------------
    def _store_image_file(
        self,
        *,
        user_id: str,
        folder: str,
        file_bytes: bytes,
        content_type: str | None,
        filename: str | None,
        label: str,
    ) -> str:
        stored = self.media_storage.store_image(
            owner_id=user_id,
            folder=folder,
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
            label=label,
        )
        return stored.url

    def _normalize_media_url(self, url: str | None) -> str | None:
        return self.media_storage.normalize_public_url(url)

    async def _paginate(
        self,
        collection,
        filters: dict,
        page: int,
        page_size: int,
        sort_field: str,
        ascending: bool = False,
    ) -> dict:
        total = await collection.count_documents(filters)
        direction = 1 if ascending else -1
        cursor = collection.find(filters).sort(sort_field, direction).skip((page - 1) * page_size).limit(page_size)
        items = self._to_public_many(await cursor.to_list(length=page_size))
        return {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def _get_owned_document(self, collection, user_id: str, document_id: str, code: str) -> dict:
        if not ObjectId.is_valid(document_id):
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")
        document = await collection.find_one({"_id": ObjectId(document_id), "user_id": user_id})
        if not document:
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")
        return document

    def _to_public(self, document: dict | None) -> dict:
        safe = serialize_mongo_document(document) or {}
        if "_id" in safe:
            safe["id"] = safe.pop("_id")
        return safe

    def _to_public_many(self, documents: list[dict]) -> list[dict]:
        return [self._to_public(document) for document in documents]

    # ------------------------------------------------------------------
    # Contact helpers (shared widely)
    # ------------------------------------------------------------------
    @staticmethod
    def _normalize_contact_names(payload: dict) -> dict:
        name = str(payload.get("name") or "").strip()
        first_name = str(payload.get("first_name") or "").strip()
        last_name = str(payload.get("last_name") or "").strip()
        if not name:
            name = " ".join(part for part in [first_name, last_name] if part).strip()
        if not first_name and name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            if not last_name and len(parts) > 1:
                last_name = parts[1]
        if not name:
            raise AppException(status_code=422, code="CONTACT_NAME_REQUIRED", message="Contact name is required.")
        return {"name": name, "first_name": first_name or None, "last_name": last_name or None}

    async def _contact_summary(self, user_id: str) -> dict:
        total = await self.db.contacts.count_documents({"user_id": user_id})
        online = await self.db.contacts.count_documents({"user_id": user_id, "presence": "online"})
        with_email = await self.db.contacts.count_documents({"user_id": user_id, "email": {"$nin": [None, ""]}})
        with_phone = await self.db.contacts.count_documents({"user_id": user_id, "phone": {"$nin": [None, ""]}})
        return {
            "total_contacts": total,
            "online_contacts": online,
            "with_email": with_email,
            "with_phone": with_phone,
        }

    def _serialize_contact(self, contact: dict | None) -> dict:
        safe = self._to_public(contact)
        safe.pop("user_id", None)
        names = self._normalize_contact_names(safe)
        safe.update(names)
        safe["presence"] = safe.get("presence") or "offline"
        safe["presence_label"] = safe["presence"].replace("_", " ").title()
        safe["is_online"] = safe["presence"] == "online"
        safe["initials"] = self._contact_initials(safe.get("name"))
        safe["primary_detail"] = safe.get("email") or safe.get("phone")
        safe["avatar_url"] = self._normalize_media_url(safe.get("avatar_url"))
        safe.setdefault("avatar_url", None)
        safe.setdefault("company", None)
        safe.setdefault("job_title", None)
        safe.setdefault("address", None)
        safe.setdefault("date_of_birth", None)
        safe.setdefault("notes", None)
        safe.setdefault("identities", [])
        return safe

    @staticmethod
    def _contact_date_to_iso(value) -> str | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    @staticmethod
    def _contact_initials(name: str | None) -> str:
        if not name:
            return "NA"
        parts = [part[:1].upper() for part in name.split() if part.strip()]
        return "".join(parts[:2]) or "NA"

    # ------------------------------------------------------------------
    # Call helpers (shared with home dashboard and call history)
    # ------------------------------------------------------------------
    async def _serialize_call_log(self, call: dict | None) -> dict:
        safe = self._to_public(call)
        contact = await self._call_contact(safe)
        contact_name = safe.get("contact_name") or (contact or {}).get("name")
        phone_number = safe.get("phone_number") or (contact or {}).get("phone") or safe.get("from_number")
        safe["contact"] = contact
        safe["contact_name"] = contact_name
        safe["phone_number"] = phone_number
        safe["duration"] = int(safe.get("duration") or 0)
        safe["duration_label"] = self._duration_label(safe["duration"])
        safe["call_type_label"] = self._call_type_label(safe.get("call_type"), safe.get("ai_ready"))
        safe["status_label"] = self._call_status_label(safe.get("status"), safe.get("call_type"))
        safe["status_tone"] = self._call_status_tone(safe.get("status"), safe.get("call_type"))
        safe["display_time_label"] = self._call_time_label(safe.get("timestamp"))
        safe["date_bucket"] = self._date_bucket(safe.get("timestamp"))
        safe["recording_available"] = bool(safe.get("recording_url"))
        safe["transcript_available"] = bool(safe.get("transcript"))
        safe["ai_summary"] = safe.get("ai_summary") or None
        safe["ai_summary_available"] = bool(safe.get("ai_summary"))
        safe["speaker_segments"] = safe.get("speaker_segments", [])
        safe["repeat_count"] = await self._call_repeat_count(safe)
        safe["initials"] = self._contact_initials(contact_name or phone_number)
        safe["actions"] = self._call_actions(safe)
        safe.setdefault("ai_ready", False)
        safe.setdefault("callback_requested", False)
        safe.pop("user_id", None)
        return safe

    async def _call_contact(self, call: dict) -> dict | None:
        contact_id = call.get("contact_id")
        user_id = call.get("user_id")
        if contact_id and user_id and ObjectId.is_valid(contact_id):
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if contact:
                return self._serialize_contact(contact)
        return None

    async def _call_repeat_count(self, call: dict) -> int:
        user_id = call.get("user_id")
        if not user_id:
            return 1
        filters = {"user_id": user_id}
        if call.get("contact_id"):
            filters["contact_id"] = call["contact_id"]
        elif call.get("phone_number"):
            filters["phone_number"] = call["phone_number"]
        else:
            return 1
        return max(1, await self.db.call_logs.count_documents(filters))

    @staticmethod
    def _duration_label(seconds: int) -> str:
        if seconds <= 0:
            return "--"
        minutes, remainder = divmod(seconds, 60)
        if minutes:
            return f"{minutes}m {remainder:02d}s"
        return f"{remainder}s"

    @staticmethod
    def _call_type_label(call_type: str | None, ai_ready: bool | None = False) -> str:
        if call_type == "missed":
            return "Missed Call"
        if call_type == "outbound":
            return "Outgoing Call"
        if call_type in {"incoming", "incoming_automated"}:
            return "Incoming Automated" if ai_ready or call_type == "incoming_automated" else "Incoming Call"
        if call_type == "scheduled":
            return "Scheduled Call"
        return "Completed Call"

    @staticmethod
    def _call_status_label(status: str | None, call_type: str | None = None) -> str:
        if status == "callback":
            return "Callback Requested"
        if status == "missed" or call_type == "missed":
            return "Missed"
        if status == "completed":
            return "Recorded"
        return (status or "completed").replace("_", " ").title()

    @staticmethod
    def _call_status_tone(status: str | None, call_type: str | None = None) -> str:
        if status == "missed" or call_type == "missed":
            return "danger"
        if status in {"completed", "callback"}:
            return "success"
        if status in {"queued", "initiated", "ringing", "in_progress", "ai_ready"}:
            return "info"
        return "muted"

    @staticmethod
    def _call_actions(call: dict) -> list[str]:
        actions: list[str] = []
        if call.get("transcript"):
            actions.append("transcript")
        if call.get("ai_summary") or call.get("ai_ready"):
            actions.append("ai_summary")
        if call.get("recording_url"):
            actions.append("recording")
        if call.get("phone_number") or call.get("contact_id"):
            actions.append("call_back")
            actions.append("message")
        return actions

    @staticmethod
    def _default_call_ai_summary(call: dict) -> dict:
        transcript = (call.get("transcript") or "").strip()
        if transcript:
            return {
                "purpose": transcript[:180],
                "key_points": [],
                "action_items": [],
                "highlights": [],
            }
        return {"purpose": None, "key_points": [], "action_items": [], "highlights": []}

    @staticmethod
    def _call_time_label(value) -> str | None:
        if not value:
            return None
        timestamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        bucket = SmartFlowBase._date_bucket(timestamp)
        time_label = timestamp.strftime("%I:%M %p").lstrip("0")
        if bucket == "today":
            return f"Today {time_label}"
        if bucket == "yesterday":
            return f"Yesterday {time_label}"
        return timestamp.strftime("%b %d, %Y %I:%M %p").replace(" 0", " ")

    @staticmethod
    def _date_bucket(value) -> str:
        if not value:
            return "older"
        timestamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        today = utc_now().date()
        call_date = timestamp.date()
        if call_date == today:
            return "today"
        if call_date == today - timedelta(days=1):
            return "yesterday"
        return "older"

    def _call_history_summary(self, calls: list[dict]) -> dict:
        return {
            "total_calls": len(calls),
            "missed_calls": sum(1 for call in calls if call.get("status") == "missed" or call.get("call_type") == "missed"),
            "recorded_calls": sum(1 for call in calls if call.get("recording_url")),
            "transcribed_calls": sum(1 for call in calls if call.get("transcript")),
            "ai_summary_calls": sum(1 for call in calls if call.get("ai_summary") or call.get("ai_ready")),
            "callback_requested_calls": sum(1 for call in calls if call.get("callback_requested")),
        }

    @staticmethod
    def _derive_call_status(payload: dict) -> str:
        if payload.get("status"):
            return str(payload["status"])
        if payload.get("callback_requested"):
            return "callback"
        if payload.get("ai_ready"):
            return "ai_ready"
        if payload.get("call_type") == "missed":
            return "missed"
        return "completed"

    # ------------------------------------------------------------------
    # Conversation / message helpers
    # ------------------------------------------------------------------
    async def _serialize_conversation(self, conversation: dict) -> dict:
        safe = self._to_public(conversation)
        latest = await self.db.messages.find({"conversation_id": safe["id"], "user_id": safe["user_id"]}).sort(
            "timestamp", -1
        ).limit(1).to_list(length=1)
        unread_count = await self.db.messages.aggregate(
            [
                {"$match": {"conversation_id": safe["id"], "user_id": safe["user_id"]}},
                {"$group": {"_id": None, "total": {"$sum": "$unread_count"}}},
            ]
        ).to_list(length=1)
        latest_message = latest[0] if latest else None
        latest_sender_name = await self._resolve_message_sender_name(safe.get("user_id", ""), latest_message, safe)
        safe["last_message_preview"] = latest_message["content"] if latest_message else None
        safe["last_message_sender_name"] = latest_sender_name
        safe["unread_count"] = unread_count[0]["total"] if unread_count else 0
        safe["has_unread"] = safe["unread_count"] > 0
        safe["is_ai_assistant"] = safe.get("type") == "ai"
        safe["is_group"] = safe.get("type") == "group"
        safe["member_count"] = len([member_id for member_id in safe.get("member_ids", []) if member_id != safe.get("user_id")])
        safe["display_time_label"] = self._conversation_time_label(latest_message.get("timestamp") if latest_message else safe.get("updated_at"))
        safe["delivery_state"] = self._conversation_delivery_state(latest_message, safe["has_unread"])
        safe["platform_label"] = self._platform_label(safe.get("platform"))
        safe["platform_icon_key"] = self._platform_icon_key(safe.get("platform"))
        safe["platform_badge_color"] = self._platform_badge_color(safe.get("platform"))

        if safe["is_ai_assistant"]:
            safe["title"] = "Mabdel AI Assistant"
            safe["contact_name"] = "Mabdel AI Assistant"
            safe["avatar_url"] = None
            safe["presence"] = "online"
            safe["presence_label"] = "Online"
            safe["participant_preview"] = []
        elif safe["is_group"]:
            safe["presence"] = "group"
            safe["presence_label"] = "Group"
            group = await self.db.groups.find_one({"conversation_id": safe["id"], "user_id": safe.get("user_id"), "is_active": {"$ne": False}})
            group_members = (group or {}).get("member_ids", safe.get("member_ids", []))
            safe["participant_preview"] = await self._group_participant_preview(safe.get("user_id", ""), group_members)
            safe["avatar_url"] = self._normalize_media_url((group or {}).get("avatar_url"))
            safe["member_count"] = len(group_members)
            safe["contact_name"] = safe.get("title")
            if latest_sender_name and safe["last_message_preview"]:
                safe["last_message_preview"] = f"{latest_sender_name}: {safe['last_message_preview']}"
        else:
            contact = await self._get_conversation_contact(safe.get("user_id", ""), safe)
            safe["contact_name"] = contact.get("name") if contact else safe.get("title")
            safe["title"] = safe.get("title") or (contact.get("name") if contact else None)
            safe["avatar_url"] = self._normalize_media_url(contact.get("avatar_url")) if contact else None
            safe["presence"] = (contact or {}).get("presence", "offline")
            safe["presence_label"] = self._presence_label(safe["presence"])
            safe["participant_preview"] = []
        safe.pop("user_id", None)
        return safe

    async def _serialize_message(self, message: dict) -> dict:
        safe = self._to_public(message)
        reply_id = safe.get("reply_to_message_id")
        forward_id = safe.get("forward_from_message_id")
        reply_doc = await self._get_optional_owned_message(safe.get("user_id", ""), reply_id)
        forward_doc = await self._get_optional_owned_message(safe.get("user_id", ""), forward_id)
        sender = await self._resolve_message_sender(safe.get("user_id", ""), safe)
        attachments = safe.get("attachments") or self._legacy_message_attachments(safe.get("media_url"))
        safe["is_read"] = safe.get("status") == "read" or safe.get("read_at") is not None
        safe["read_receipt_label"] = self._format_read_receipt_label(safe.get("read_at")) if safe["is_read"] else None
        safe["attachments"] = attachments
        safe["attachment_count"] = len(attachments)
        safe["has_attachments"] = bool(attachments)
        safe["mentions"] = await self._serialize_message_mentions(safe.get("user_id", ""), safe.get("mentions", []))
        safe["status_timestamps"] = {
            "sent_at": safe.get("timestamp"),
            "delivered_at": safe.get("delivered_at"),
            "read_at": safe.get("read_at"),
        }
        safe["reply_to_message_preview"] = self._message_preview(reply_doc)
        safe["forward_from_message_preview"] = self._message_preview(forward_doc)
        safe["sender_name"] = sender.get("name")
        safe["sender_avatar_url"] = self._normalize_media_url(sender.get("avatar_url"))
        safe["sender_presence"] = sender.get("presence")
        safe["sender_is_self"] = sender.get("is_self", False)
        safe.pop("user_id", None)
        return safe

    @staticmethod
    def _conversation_matches_search(item: dict, needle: str) -> bool:
        haystacks = [
            item.get("title") or "",
            item.get("contact_name") or "",
            item.get("last_message_preview") or "",
            item.get("last_message_sender_name") or "",
            " ".join(item.get("participant_preview", [])),
        ]
        return any(needle in value.lower() for value in haystacks)

    def _conversation_list_summary(self, items: list[dict]) -> dict:
        total_unread = sum(item.get("unread_count", 0) for item in items)
        by_platform: dict[str, int] = {}
        for item in items:
            platform = item.get("platform", "unknown")
            by_platform[platform] = by_platform.get(platform, 0) + item.get("unread_count", 0)
        return {"total_unread": total_unread, "by_platform": by_platform}

    async def _get_conversation_contact(self, user_id: str, conversation: dict) -> dict | None:
        contact_id = conversation.get("contact_id")
        if contact_id and ObjectId.is_valid(contact_id):
            return await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
        title = conversation.get("title")
        if title:
            return await self.db.contacts.find_one({"user_id": user_id, "name": title})
        return None

    async def _publish_inbox_update(self, user_id: str, conversation_id: str) -> None:
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id), "user_id": user_id}) if ObjectId.is_valid(conversation_id) else None
        if not conversation:
            return
        serialized = await self._serialize_conversation(conversation)
        summary = await self.get_unread_message_summary(user_id, None)
        await inbox_realtime_hub.publish(
            user_id,
            "inbox.updated",
            {"conversation": serialized, "summary": summary},
        )

    async def get_unread_message_summary(self, user_id: str, platform: str | None) -> dict:
        filters = {"user_id": user_id}
        if platform:
            filters["platform"] = platform
        pipeline = [
            {"$match": filters},
            {"$group": {"_id": "$platform", "unread": {"$sum": "$unread_count"}}},
        ]
        grouped = await self.db.messages.aggregate(pipeline).to_list(length=20)
        return {
            "total_unread": sum(item["unread"] for item in grouped),
            "by_platform": {item["_id"]: item["unread"] for item in grouped},
        }

    async def _resolve_message_sender_name(self, user_id: str, latest_message: dict | None, conversation: dict) -> str | None:
        if not latest_message:
            return None
        if conversation.get("type") == "ai":
            return "Mabdel AI"
        contact_id = latest_message.get("contact_id")
        if contact_id and ObjectId.is_valid(contact_id):
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if contact:
                return contact.get("name")
        if latest_message.get("direction") == "outbound":
            return "You"
        if conversation.get("type") == "group":
            return "Member"
        return conversation.get("title")

    async def _group_participant_preview(self, user_id: str, member_ids: list[str]) -> list[str]:
        names: list[str] = []
        for member_id in member_ids:
            if member_id == user_id or not ObjectId.is_valid(member_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": user_id})
            if contact and contact.get("name"):
                names.append(contact["name"])
            if len(names) >= 3:
                break
        return names

    @staticmethod
    def _presence_label(presence: str | None) -> str:
        mapping = {
            "online": "Online",
            "offline": "Offline",
            "busy": "Busy",
            "away": "Away",
            "group": "Group",
        }
        return mapping.get((presence or "offline").lower(), "Offline")

    @staticmethod
    def _conversation_delivery_state(latest_message: dict | None, has_unread: bool) -> str | None:
        if not latest_message:
            return None
        if has_unread:
            return "unread"
        if latest_message.get("direction") == "outbound":
            status = latest_message.get("status")
            if status == "read":
                return "read"
            if status == "delivered":
                return "delivered"
            return "sent"
        return "received"

    @staticmethod
    def _platform_label(platform: str | None) -> str:
        labels = {
            "whatsapp": "WhatsApp",
            "facebook_messenger": "Facebook",
            "instagram": "Instagram",
            "linkedin": "LinkedIn",
            "twitter_x": "X",
            "snapchat": "Snapchat",
            "telegram": "Telegram",
            "sms": "SMS",
            "email": "Email",
            "google_business": "Google Business",
            "ai": "AI",
        }
        return labels.get(platform or "", "Unknown")

    @staticmethod
    def _platform_icon_key(platform: str | None) -> str:
        mapping = {
            "facebook_messenger": "facebook",
            "twitter_x": "x",
            "google_business": "google",
            "snapchat": "snapchat",
        }
        return mapping.get(platform or "", platform or "unknown")

    @staticmethod
    def _platform_badge_color(platform: str | None) -> str:
        colors = {
            "whatsapp": "#25D366",
            "facebook_messenger": "#1877F2",
            "instagram": "#E4405F",
            "linkedin": "#0A66C2",
            "twitter_x": "#111111",
            "snapchat": "#FFFC00",
            "telegram": "#229ED9",
            "sms": "#3B82F6",
            "email": "#64748B",
            "google_business": "#4285F4",
            "ai": "#06B6D4",
        }
        return colors.get(platform or "", "#64748B")

    @staticmethod
    def _conversation_time_label(value: datetime | None) -> str | None:
        if not value:
            return None
        now = utc_now()
        current = value if value.tzinfo else value.replace(tzinfo=now.tzinfo)
        delta = now - current
        if delta < timedelta(minutes=1):
            return "Now"
        if delta < timedelta(hours=1):
            return f"{max(1, int(delta.total_seconds() // 60))}m ago"
        if delta < timedelta(days=1):
            return f"{max(1, int(delta.total_seconds() // 3600))}h ago"
        if delta < timedelta(days=2):
            return "Yesterday"
        return current.strftime("%b %d")

    @staticmethod
    def _primary_attachment_url(attachments: list[dict]) -> str | None:
        if not attachments:
            return None
        return attachments[0].get("thumbnail_url") or attachments[0].get("url")

    def _legacy_message_attachments(self, media_url: str | None) -> list[dict]:
        if not media_url:
            return []
        return [{"type": self._guess_attachment_type(media_url), "url": media_url}]

    def _normalize_message_attachments(self, payload: dict) -> list[dict]:
        attachments = [dict(item) for item in payload.get("attachments", [])]
        if not attachments and payload.get("media_url"):
            attachments = self._legacy_message_attachments(payload.get("media_url"))
        for attachment in attachments:
            attachment["type"] = attachment.get("type") or self._guess_attachment_type(
                attachment.get("url"),
                attachment.get("mime_type"),
            )
        return attachments

    async def _normalize_message_mentions(self, user_id: str, mention_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        for mention_id in list(dict.fromkeys(mention_ids or [])):
            if not ObjectId.is_valid(mention_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(mention_id), "user_id": user_id})
            if contact:
                normalized.append(mention_id)
        return normalized

    async def _serialize_message_mentions(self, user_id: str, mention_ids: list[str]) -> list[dict]:
        mentions: list[dict] = []
        for mention_id in mention_ids or []:
            if not ObjectId.is_valid(mention_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(mention_id), "user_id": user_id})
            if contact:
                mentions.append({"contact_id": mention_id, "name": contact.get("name")})
        return mentions

    async def _resolve_message_sender(self, user_id: str, message: dict) -> dict:
        if message.get("direction") == "outbound":
            return {"name": "You", "avatar_url": None, "presence": "online", "is_self": True}
        contact_id = message.get("contact_id")
        if contact_id and ObjectId.is_valid(contact_id):
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if contact:
                return {
                    "name": contact.get("name"),
                    "avatar_url": contact.get("avatar_url"),
                    "presence": contact.get("presence", "offline"),
                    "is_self": False,
                }
        return {"name": "Member", "avatar_url": None, "presence": "offline", "is_self": False}

    @staticmethod
    def _guess_attachment_type(url: str | None, mime_type: str | None = None) -> str:
        hint = f"{mime_type or ''} {url or ''}".lower()
        if any(token in hint for token in ("image/", ".png", ".jpg", ".jpeg", ".gif", ".webp")):
            return "image"
        if any(token in hint for token in ("audio/", ".mp3", ".wav", ".m4a")):
            return "audio"
        if any(token in hint for token in ("video/", ".mp4", ".mov", ".webm")):
            return "video"
        if any(token in hint for token in ("application/pdf", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx")):
            return "document"
        return "file"

    async def _validate_message_links(self, user_id: str, payload: dict) -> None:
        reply_to_message_id = payload.get("reply_to_message_id")
        forward_from_message_id = payload.get("forward_from_message_id")

        if reply_to_message_id:
            reply_message = await self._get_owned_document(self.db.messages, user_id, reply_to_message_id, "MESSAGE_NOT_FOUND")
            if reply_message["conversation_id"] != payload["conversation_id"]:
                raise AppException(
                    status_code=400,
                    code="INVALID_REPLY_TARGET",
                    message="Reply target must belong to the same conversation.",
                )

        if forward_from_message_id:
            await self._get_owned_document(self.db.messages, user_id, forward_from_message_id, "MESSAGE_NOT_FOUND")

    async def _get_optional_owned_message(self, user_id: str, message_id: str | None) -> dict | None:
        if not message_id or not ObjectId.is_valid(message_id):
            return None
        return await self.db.messages.find_one({"_id": ObjectId(message_id), "user_id": user_id})

    @staticmethod
    def _message_preview(message: dict | None) -> dict | None:
        if not message:
            return None
        return {
            "id": str(message["_id"]),
            "content": message.get("content"),
            "direction": message.get("direction"),
            "timestamp": message.get("timestamp"),
            "status": message.get("status"),
        }

    @staticmethod
    def _format_read_receipt_label(read_at) -> str | None:
        if not read_at:
            return None
        return f"READ {read_at.strftime('%I:%M %p')}"

    @staticmethod
    def _is_future_timestamp(value) -> bool:
        if not value:
            return False
        now = utc_now()
        if getattr(value, "tzinfo", None) is None:
            now = now.replace(tzinfo=None)
        return value > now

    # ------------------------------------------------------------------
    # Group helpers
    # ------------------------------------------------------------------
    async def _serialize_group(self, group: dict, *, include_members: bool = True) -> dict:
        safe = self._to_public(group)
        member_ids = list(dict.fromkeys(safe.get("member_ids", [])))
        admin_ids = list(dict.fromkeys(safe.get("admin_ids", [])))
        members = await self._serialize_group_members(safe.get("user_id", ""), member_ids, admin_ids) if include_members else []
        pending_invites = [
            {
                "id": invite.get("id"),
                "email": invite.get("email"),
                "phone": invite.get("phone"),
                "name": invite.get("name"),
                "role": invite.get("role", "member"),
                "status": invite.get("status", "pending"),
                "invited_at": invite.get("invited_at"),
            }
            for invite in safe.get("pending_invites", [])
        ]
        safe["members"] = members
        safe["pending_invites"] = pending_invites
        safe["member_count"] = len(member_ids)
        safe["pending_invite_count"] = len(pending_invites)
        safe["admin_count"] = len(admin_ids) + 1
        safe["can_manage"] = True
        safe["can_leave"] = True
        safe.pop("user_id", None)
        return safe

    async def _serialize_group_members(self, user_id: str, member_ids: list[str], admin_ids: list[str]) -> list[dict]:
        members: list[dict] = []
        for member_id in member_ids:
            if not ObjectId.is_valid(member_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": user_id})
            if not contact:
                continue
            safe_contact = self._to_public(contact)
            members.append(
                {
                    "id": safe_contact["id"],
                    "name": safe_contact.get("name") or "Unknown",
                    "email": safe_contact.get("email"),
                    "phone": safe_contact.get("phone"),
                    "avatar_url": safe_contact.get("avatar_url"),
                    "presence": safe_contact.get("presence", "offline"),
                    "role": "admin" if safe_contact["id"] in admin_ids else "member",
                    "status": "active",
                    "is_self": False,
                }
            )
        return members

    async def _get_active_owned_group(self, user_id: str, group_id: str) -> dict:
        group = await self._get_owned_document(self.db.groups, user_id, group_id, "GROUP_NOT_FOUND")
        if group.get("is_active", True) is False:
            raise AppException(status_code=404, code="GROUP_NOT_FOUND", message="Requested resource was not found.")
        return group

    async def _normalize_group_member_ids(self, user_id: str, member_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        for member_id in list(dict.fromkeys(member_ids or [])):
            if not ObjectId.is_valid(member_id):
                raise AppException(status_code=400, code="GROUP_MEMBER_INVALID", message="One or more group members are invalid.")
            contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": user_id})
            if not contact:
                raise AppException(status_code=404, code="GROUP_MEMBER_NOT_FOUND", message="One or more group members were not found.")
            normalized.append(member_id)
        return normalized

    @staticmethod
    def _normalize_group_admin_ids(member_ids: list[str], admin_ids: list[str]) -> list[str]:
        valid_members = set(member_ids)
        return [member_id for member_id in list(dict.fromkeys(admin_ids or [])) if member_id in valid_members]

    async def _sync_group_conversation(self, group: dict, *, rename_only: bool = False) -> None:
        conversation_id = group.get("conversation_id")
        if not conversation_id or not ObjectId.is_valid(conversation_id):
            return
        updates = {"title": group.get("name"), "updated_at": utc_now()}
        if not rename_only:
            updates["member_ids"] = [group.get("user_id"), *group.get("member_ids", [])]
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id), "user_id": group.get("user_id")},
            {"$set": updates},
        )

    # ------------------------------------------------------------------
    # History helpers
    # ------------------------------------------------------------------
    def _serialize_history_item(self, document: dict | None) -> dict:
        safe = self._to_public(document)
        safe["command_type_label"] = self._history_type_label(safe.get("command_type"))
        safe["status_label"] = self._history_status_label(safe.get("status"))
        safe["icon"] = self._history_icon(safe.get("command_type"))
        safe["accent_tone"] = self._history_accent_tone(safe.get("status"))
        safe["date_bucket"] = self._history_date_bucket(safe.get("timestamp"))
        return safe

    def _group_history_items_by_day(self, items: list[dict]) -> dict[str, list[dict]]:
        grouped = {"today": [], "yesterday": [], "older": []}
        for item in items:
            grouped.setdefault(item["date_bucket"], []).append(item)
        return grouped

    @staticmethod
    def _history_type_label(command_type: str | None) -> str:
        labels = {
            "invoice": "Invoices",
            "voice": "AI Voice",
            "email": "Email",
            "report": "Report",
            "message": "Message",
            "agreement": "Agreement",
            "lease": "Lease",
            "calendar": "Calendar",
            "bulk_message": "Bulk Messaging",
            "legal": "Legal",
            "document": "Document",
        }
        return labels.get(command_type or "", "Activity")

    @staticmethod
    def _history_status_label(status: str | None) -> str:
        labels = {
            "completed": "Completed",
            "archived": "Archived",
            "exported": "Exported",
            "delivered": "Delivered",
            "scheduled": "Scheduled",
            "processing": "Processing",
            "failed": "Failed",
        }
        return labels.get(status or "", "Completed")

    @staticmethod
    def _history_icon(command_type: str | None) -> str:
        icons = {
            "invoice": "invoice",
            "voice": "microphone",
            "email": "mail",
            "report": "chart",
            "message": "message",
            "agreement": "document",
            "lease": "document",
            "calendar": "calendar",
            "bulk_message": "send",
            "legal": "document",
            "document": "document",
        }
        return icons.get(command_type or "", "history")

    @staticmethod
    def _history_accent_tone(status: str | None) -> str:
        tones = {
            "completed": "success",
            "archived": "muted",
            "exported": "info",
            "delivered": "success",
            "scheduled": "warning",
            "processing": "info",
            "failed": "danger",
        }
        return tones.get(status or "", "info")

    @staticmethod
    def _history_date_bucket(value: datetime | None) -> str:
        if not value:
            return "older"
        now = utc_now()
        current = value.astimezone(now.tzinfo).date() if value.tzinfo else value.date()
        today = now.date()
        if current == today:
            return "today"
        if current == today - timedelta(days=1):
            return "yesterday"
        return "older"

    @staticmethod
    def _document_command_type(document_type: str | None) -> str:
        mapping = {
            "agreement": "agreement",
            "invoice": "invoice",
            "lease": "lease",
            "others": "document",
        }
        return mapping.get(document_type or "", "document")

    # ------------------------------------------------------------------
    # Document helpers
    # ------------------------------------------------------------------
    def _with_preview_url(self, document: dict) -> dict:
        if "preview_url" not in document:
            encoded = quote_plus(document.get("file_url", ""))
            document["preview_url"] = f"/api/v1/smartflow/documents/preview?file={encoded}"
        return document

    # ------------------------------------------------------------------
    # Notification helpers
    # ------------------------------------------------------------------
    async def _notification_summary(self, user_id: str) -> dict:
        total = await self.db.notifications.count_documents({"user_id": user_id})
        unread = await self.db.notifications.count_documents({"user_id": user_id, "read": False})
        today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_unread = await self.db.notifications.count_documents(
            {"user_id": user_id, "read": False, "created_at": {"$gte": today_start}}
        )
        return {
            "total": total,
            "unread_count": unread,
            "new_count": unread,
            "today_unread_count": today_unread,
            "has_unread": unread > 0,
        }

    def _serialize_notification(self, notification: dict | None) -> dict:
        safe = self._to_public(notification)
        safe.pop("user_id", None)
        notification_type = safe.get("type") or "message"
        created_at = safe.get("created_at") or utc_now()
        read = bool(safe.get("read", False))
        safe["type"] = notification_type
        safe["title"] = safe.get("title") or self._notification_type_label(notification_type)
        safe["body"] = safe.get("body") or ""
        safe["read"] = read
        safe["unread"] = not read
        safe["icon_key"] = safe.get("icon_key") or self._notification_icon_key(notification_type)
        safe["accent_tone"] = safe.get("accent_tone") or self._notification_accent_tone(notification_type)
        safe["date_bucket"] = self._notification_date_bucket(created_at)
        safe["display_time_label"] = self._relative_time_label(created_at)
        safe["primary_action"] = safe.get("primary_action") or self._notification_primary_action(notification_type)
        safe["action_url"] = safe.get("action_url")
        safe["metadata"] = safe.get("metadata") or {}
        return safe

    def _notification_sections(self, items: list[dict]) -> list[dict]:
        sections = [
            {"key": "today", "title": "TODAY", "new_count": 0, "items": []},
            {"key": "earlier", "title": "EARLIER", "new_count": 0, "items": []},
        ]
        by_key = {section["key"]: section for section in sections}
        for item in items:
            key = item.get("date_bucket") or "earlier"
            section = by_key.get(key, by_key["earlier"])
            section["items"].append(item)
            if item.get("unread"):
                section["new_count"] += 1
        return [section for section in sections if section["items"]]

    @staticmethod
    def _notification_date_bucket(created_at) -> str:
        if not isinstance(created_at, datetime):
            return "earlier"
        now = utc_now()
        if created_at.tzinfo is None:
            now = now.replace(tzinfo=None)
        return "today" if created_at.date() == now.date() else "earlier"

    @staticmethod
    def _relative_time_label(value) -> str:
        if not isinstance(value, datetime):
            return ""
        now = utc_now()
        if value.tzinfo is None:
            now = now.replace(tzinfo=None)
        delta = now - value
        seconds = max(0, int(delta.total_seconds()))
        if seconds < 60:
            return "Just now"
        minutes = seconds // 60
        if minutes < 60:
            return f"{minutes}m ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        if hours < 48:
            return "Yesterday"
        days = hours // 24
        if days < 7:
            return f"{days}d ago"
        return value.strftime("%b %d")

    @staticmethod
    def _notification_icon_key(notification_type: str) -> str:
        return {
            "message": "message",
            "missed_call": "phone-missed",
            "scheduled_call": "phone-call",
            "ai_task": "sparkles",
            "ai_insight": "sparkles",
            "calendar": "calendar",
            "daily_digest": "chart-line",
            "system_update": "mail",
        }.get(notification_type, "bell")

    @staticmethod
    def _notification_accent_tone(notification_type: str) -> str:
        return {
            "message": "cyan",
            "missed_call": "red",
            "scheduled_call": "cyan",
            "ai_task": "cyan",
            "ai_insight": "cyan",
            "calendar": "cyan",
            "daily_digest": "indigo",
            "system_update": "indigo",
        }.get(notification_type, "neutral")

    @staticmethod
    def _notification_type_label(notification_type: str) -> str:
        return notification_type.replace("_", " ").title()

    @staticmethod
    def _notification_primary_action(notification_type: str) -> str | None:
        return {
            "message": "open_conversation",
            "missed_call": "open_call",
            "scheduled_call": "open_call",
            "calendar": "open_event",
            "ai_task": "open_ai_history",
            "ai_insight": "open_ai_insight",
            "daily_digest": "open_digest",
            "system_update": "open_release_notes",
        }.get(notification_type)

    # ------------------------------------------------------------------
    # Integration helpers
    # ------------------------------------------------------------------
    def _sanitize_integration(self, document: dict) -> dict:
        safe = self._to_public(document)
        safe.pop("access_token_encrypted", None)
        safe.pop("refresh_token_encrypted", None)
        safe.pop("user_id", None)
        return safe

    @staticmethod
    def _decrypt_integration_token(document: dict) -> str | None:
        encrypted = document.get("access_token_encrypted")
        return decrypt_value(encrypted) if encrypted else None

    def _serialize_integration(self, document: dict, metadata: dict | None = None) -> dict:
        safe = self._sanitize_integration(document)
        meta = metadata or self._integration_metadata(safe.get("platform"))
        connected = safe.get("status") == "connected"
        adapter = get_social_provider_adapter(safe.get("platform") or "")
        safe["connected"] = connected
        safe["platform_label"] = meta["platform_label"]
        safe["description"] = meta["description"]
        safe["icon_key"] = meta["icon_key"]
        safe["brand_color"] = meta["brand_color"]
        safe["auth_mode"] = meta["auth_mode"]
        safe["is_available"] = meta["is_available"]
        safe["is_configured"] = meta["is_configured"]
        safe["sync_status"] = safe.get("sync_status") or "idle"
        safe["last_sync_at"] = safe.get("last_sync_at")
        safe["last_error"] = safe.get("last_error")
        safe["message_sync_enabled"] = bool(safe.get("message_sync_enabled", adapter.supports_webhooks or adapter.supports_recent_sync))
        safe["webhook_status"] = safe.get("webhook_status") or ("configured" if connected and adapter.supports_webhooks else "not_configured")
        safe["external_account_name"] = safe.get("external_account_name")
        if not meta["is_configured"]:
            health_status = "misconfigured"
        elif connected and safe.get("sync_status") == "error":
            health_status = "error"
        elif connected:
            health_status = "connected"
        else:
            health_status = "disconnected"
        safe["health_status"] = health_status
        safe["cta_label"] = "Connected" if connected else ("Connect" if meta["is_configured"] else "Unavailable")
        return safe

    def _integration_metadata(self, platform: str | None) -> dict:
        for item in self._integration_catalog_metadata():
            if item["platform"] == platform:
                return item
        return {
            "platform": platform or "unknown",
            "platform_label": "Unknown",
            "description": "",
            "icon_key": platform or "unknown",
            "brand_color": "#64748B",
            "auth_mode": "oauth",
            "is_available": False,
            "is_configured": False,
        }

    def _integration_catalog_metadata(self) -> list[dict]:
        return [
            {
                "platform": "facebook_messenger",
                "platform_label": "Facebook",
                "description": "Manage page posts and messenger leads.",
                "icon_key": "facebook",
                "brand_color": "#1877F2",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.META_CLIENT_ID and settings.META_CLIENT_SECRET),
            },
            {
                "platform": "instagram",
                "platform_label": "Instagram",
                "description": "Sync visual content and DMs.",
                "icon_key": "instagram",
                "brand_color": "#E4405F",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.META_CLIENT_ID and settings.META_CLIENT_SECRET),
            },
            {
                "platform": "whatsapp",
                "platform_label": "WhatsApp",
                "description": "Customer service and automated replies.",
                "icon_key": "whatsapp",
                "brand_color": "#25D366",
                "auth_mode": "manual",
                "is_available": True,
                "is_configured": True,
            },
            {
                "platform": "google_business",
                "platform_label": "Google Business",
                "description": "Connect your business listing and messages.",
                "icon_key": "google",
                "brand_color": "#4285F4",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            },
            {
                "platform": "linkedin",
                "platform_label": "LinkedIn",
                "description": "B2B outreach and company updates.",
                "icon_key": "linkedin",
                "brand_color": "#0A66C2",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.LINKEDIN_CLIENT_ID and settings.LINKEDIN_CLIENT_SECRET),
            },
            {
                "platform": "twitter_x",
                "platform_label": "Twitter (X)",
                "description": "Real-time engagement and support.",
                "icon_key": "x",
                "brand_color": "#111111",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.TWITTER_CLIENT_ID and settings.TWITTER_CLIENT_SECRET),
            },
            {
                "platform": "snapchat",
                "platform_label": "Snapchat",
                "description": "Sync allowed Public Profile collaboration messages.",
                "icon_key": "snapchat",
                "brand_color": "#FFFC00",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.SNAPCHAT_CLIENT_ID and settings.SNAPCHAT_CLIENT_SECRET),
            },
            {
                "platform": "telegram",
                "platform_label": "Telegram",
                "description": "Broadcast news and direct support.",
                "icon_key": "telegram",
                "brand_color": "#229ED9",
                "auth_mode": "manual",
                "is_available": True,
                "is_configured": True,
            },
        ]

    @staticmethod
    def _oauth_provider(platform: str) -> dict:
        providers = {
            "google_business": {
                "provider": "google",
                "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_url": "https://oauth2.googleapis.com/token",
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/google_business/oauth/callback",
                "scopes": [
                    "https://www.googleapis.com/auth/calendar",
                    "https://www.googleapis.com/auth/userinfo.email",
                ],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {"access_type": "offline", "prompt": "consent"},
            },
            "instagram": {
                "provider": "meta",
                "authorize_url": "https://www.facebook.com/v20.0/dialog/oauth",
                "token_url": "https://graph.facebook.com/v20.0/oauth/access_token",
                "client_id": settings.META_CLIENT_ID,
                "client_secret": settings.META_CLIENT_SECRET,
                "redirect_uri": settings.META_INSTAGRAM_REDIRECT_URI or settings.META_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/instagram/oauth/callback",
                "scopes": ["instagram_basic", "pages_show_list", "instagram_manage_messages"],
                "token_payload": {},
                "extra_authorize_params": {},
            },
            "facebook_messenger": {
                "provider": "meta",
                "authorize_url": "https://www.facebook.com/v20.0/dialog/oauth",
                "token_url": "https://graph.facebook.com/v20.0/oauth/access_token",
                "client_id": settings.META_CLIENT_ID,
                "client_secret": settings.META_CLIENT_SECRET,
                "redirect_uri": settings.META_MESSENGER_REDIRECT_URI or settings.META_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/facebook_messenger/oauth/callback",
                "scopes": ["pages_show_list", "pages_messaging"],
                "token_payload": {},
                "extra_authorize_params": {},
            },
            "whatsapp": {
                "provider": "meta",
                "authorize_url": "https://www.facebook.com/v20.0/dialog/oauth",
                "token_url": "https://graph.facebook.com/v20.0/oauth/access_token",
                "client_id": settings.META_CLIENT_ID,
                "client_secret": settings.META_CLIENT_SECRET,
                "redirect_uri": settings.META_WHATSAPP_REDIRECT_URI or settings.META_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/whatsapp/oauth/callback",
                "scopes": ["whatsapp_business_messaging", "whatsapp_business_management"],
                "token_payload": {},
                "extra_authorize_params": {},
            },
            "linkedin": {
                "provider": "linkedin",
                "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
                "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": settings.LINKEDIN_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/linkedin/oauth/callback",
                "scopes": ["openid", "profile", "email", "w_member_social"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
            "twitter_x": {
                "provider": "twitter",
                "authorize_url": "https://twitter.com/i/oauth2/authorize",
                "token_url": "https://api.twitter.com/2/oauth2/token",
                "client_id": settings.TWITTER_CLIENT_ID,
                "client_secret": settings.TWITTER_CLIENT_SECRET,
                "redirect_uri": settings.TWITTER_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/twitter_x/oauth/callback",
                "scopes": ["tweet.read", "users.read", "offline.access"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
            "snapchat": {
                "provider": "snapchat",
                "authorize_url": "https://accounts.snapchat.com/login/oauth2/authorize",
                "token_url": "https://accounts.snapchat.com/login/oauth2/access_token",
                "client_id": settings.SNAPCHAT_CLIENT_ID,
                "client_secret": settings.SNAPCHAT_CLIENT_SECRET,
                "redirect_uri": settings.SNAPCHAT_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/snapchat/oauth/callback",
                "scopes": ["snapchat-marketing-api"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
        }
        provider = providers.get(platform)
        if not provider:
            raise AppException(status_code=400, code="INTEGRATION_UNSUPPORTED", message="This integration is not supported yet.")
        if not provider["client_id"] or not provider["client_secret"]:
            raise AppException(
                status_code=503,
                code="INTEGRATION_NOT_CONFIGURED",
                message="This integration is not configured yet.",
                details={"platform": platform},
            )
        return provider

    @staticmethod
    def _twitter_pkce_authorize_params(code_verifier: str) -> dict[str, str]:
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
        return {
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

    # ------------------------------------------------------------------
    # Calendar helpers
    # ------------------------------------------------------------------
    async def _serialize_calendar_event(self, event: dict | None) -> dict:
        safe = self._to_public(event)
        user_id = safe.get("user_id", "")
        attendees = await self._hydrate_calendar_attendees(user_id, safe.get("contact_ids", []))
        safe["attendees"] = attendees
        safe["attendee_count"] = len(attendees)
        safe["meeting_mode"] = safe.get("meeting_mode", "offline")
        safe["location"] = safe.get("location")
        safe["meeting_link"] = safe.get("meeting_link")
        safe["notify_via_push"] = safe.get("notify_via_push", True)
        safe["notify_via_email"] = safe.get("notify_via_email", False)
        safe["notify_via_sms"] = safe.get("notify_via_sms", False)
        safe["timezone"] = safe.get("timezone", "UTC")
        safe["status"] = safe.get("status", "scheduled")
        safe["sync_status"] = safe.get("sync_status", "local")
        safe["share_url"] = self._calendar_share_url(safe["share_token"]) if safe.get("share_token") else None
        safe.pop("share_token", None)
        safe.pop("user_id", None)
        return safe

    async def _hydrate_calendar_attendees(self, user_id: str, contact_ids: list[str]) -> list[dict]:
        attendees: list[dict] = []
        for contact_id in contact_ids:
            if not ObjectId.is_valid(contact_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if not contact:
                continue
            attendees.append(
                {
                    "id": str(contact["_id"]),
                    "name": contact.get("name", "Unknown Contact"),
                    "email": contact.get("email"),
                    "phone": contact.get("phone"),
                    "avatar_url": contact.get("avatar_url"),
                    "initials": self._contact_initials(contact.get("name")),
                }
            )
        return attendees

    def _validate_calendar_event_payload(self, payload: dict) -> None:
        starts_at = payload.get("starts_at")
        ends_at = payload.get("ends_at")
        if not starts_at or not ends_at:
            raise AppException(status_code=400, code="CALENDAR_TIMING_REQUIRED", message="Meeting start and end time are required.")
        if ends_at <= starts_at:
            raise AppException(status_code=400, code="CALENDAR_INVALID_RANGE", message="Meeting end time must be later than start time.")
        if payload.get("meeting_mode") == "online" and payload.get("location") and not payload.get("meeting_link"):
            return

    async def _assert_calendar_slot_available(
        self,
        user_id: str,
        starts_at: datetime,
        ends_at: datetime,
        exclude_event_id: str | None = None,
    ) -> None:
        filters: dict = {
            "user_id": user_id,
            "starts_at": {"$lt": ends_at},
            "ends_at": {"$gt": starts_at},
            "status": {"$ne": "cancelled"},
        }
        if exclude_event_id and ObjectId.is_valid(exclude_event_id):
            filters["_id"] = {"$ne": ObjectId(exclude_event_id)}
        existing = await self.db.calendar_events.find_one(filters)
        if existing:
            raise AppException(
                status_code=409,
                code="CALENDAR_CONFLICT",
                message="Another meeting already exists in this time slot.",
                details={"event_id": str(existing["_id"]), "title": existing.get("title")},
            )

    @staticmethod
    def _parse_date_boundary(value: str, *, end_of_day: bool) -> datetime:
        parsed_date = datetime.strptime(value, "%Y-%m-%d").date()
        if end_of_day:
            return datetime.combine(parsed_date, datetime.max.time()).replace(microsecond=0)
        return datetime.combine(parsed_date, datetime.min.time())

    @staticmethod
    def _generate_meeting_link() -> str:
        base = settings.PUBLIC_BACKEND_URL.rstrip("/")
        return f"{base}/meet/{secrets.token_urlsafe(12)}"

    @staticmethod
    def _calendar_share_url(share_token: str) -> str:
        base = settings.PUBLIC_BACKEND_URL.rstrip("/")
        return f"{base}/calendar/share/{share_token}"

    def _calendar_share_text(self, event: dict, message: str | None, share_url: str) -> str:
        starts_at = event["starts_at"].strftime("%b %d, %Y %I:%M %p")
        lines = [f"You're invited to {event['title']}.", f"Starts: {starts_at}"]
        if event.get("meeting_link"):
            lines.append(f"Join link: {event['meeting_link']}")
        if event.get("location"):
            lines.append(f"Location: {event['location']}")
        if message:
            lines.append("")
            lines.append(message)
        lines.append("")
        lines.append(f"View details: {share_url}")
        return "\n".join(lines)

    def _calendar_share_html(self, event: dict, message: str | None, share_url: str) -> str:
        starts_at = event["starts_at"].strftime("%b %d, %Y %I:%M %p")
        location_html = f"<p><strong>Location:</strong> {event['location']}</p>" if event.get("location") else ""
        meeting_link_html = (
            f"<p><strong>Join link:</strong> <a href=\"{event['meeting_link']}\">{event['meeting_link']}</a></p>"
            if event.get("meeting_link")
            else ""
        )
        note_html = f"<p>{message}</p>" if message else ""
        return (
            f"<h2>{event['title']}</h2>"
            f"<p><strong>Starts:</strong> {starts_at}</p>"
            f"{location_html}"
            f"{meeting_link_html}"
            f"{note_html}"
            f"<p><a href=\"{share_url}\">View meeting details</a></p>"
        )

    async def _create_calendar_event_notifications(self, user_id: str, event: dict, *, action: str) -> None:
        if not event.get("notify_via_push", True):
            return
        starts_at = event["starts_at"].strftime("%b %d, %Y %I:%M %p")
        action_map = {
            "created": ("Meeting scheduled", f"{event['title']} is scheduled for {starts_at}."),
            "updated": ("Meeting updated", f"{event['title']} was updated. Starts at {starts_at}."),
            "shared": ("Meeting shared", f"{event['title']} was shared successfully."),
        }
        title, body = action_map.get(action, ("Meeting update", event["title"]))
        await self.create_notification(user_id=user_id, notification_type="calendar", title=title, body=body)

    # ------------------------------------------------------------------
    # Bulk message helpers
    # ------------------------------------------------------------------
    async def _dispatch_bulk_message(self, document: dict) -> dict:
        now = utc_now()
        deliveries: list[dict] = []
        sent_count = 0
        failed_count = 0
        for recipient in document.get("recipients", []):
            target = recipient.get("email") if document["channel"] == "email" else recipient.get("phone")
            if not target:
                deliveries.append(
                    {
                        "target": "",
                        "contact_id": recipient.get("id"),
                        "name": recipient.get("name"),
                        "status": "failed",
                        "error": "Recipient does not have a valid delivery target.",
                        "sent_at": None,
                    }
                )
                failed_count += 1
                continue

            if document["channel"] == "email":
                try:
                    await EmailService().send_invoice_email(
                        email=target,
                        subject=document.get("subject") or "Mabdel bulk message",
                        text=document["content"],
                        html=f"<p>{document['content']}</p>",
                    )
                    status = "sent"
                    error = None
                    sent_count += 1
                except Exception as exc:
                    status = "failed"
                    error = str(exc)
                    failed_count += 1
            else:
                status = "sent"
                error = None
                sent_count += 1

            deliveries.append(
                {
                    "target": target,
                    "contact_id": recipient.get("id"),
                    "name": recipient.get("name"),
                    "status": status,
                    "error": error,
                    "sent_at": now if status == "sent" else None,
                }
            )

        final_status = "sent"
        if sent_count and failed_count:
            final_status = "partial_failed"
        elif failed_count and not sent_count:
            final_status = "failed"

        updated = await self.db.bulk_messages.find_one_and_update(
            {"_id": document["_id"]},
            {
                "$set": {
                    "deliveries": deliveries,
                    "sent_count": sent_count,
                    "failed_count": failed_count,
                    "status": final_status,
                    "sent_at": now if sent_count else None,
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self.create_notification(
            user_id=document["user_id"],
            notification_type="message",
            title="Bulk message dispatched",
            body=f"{sent_count} delivered, {failed_count} failed.",
        )
        await self.log_ai_command(
            user_id=document["user_id"],
            command_text=f"Send bulk {document['channel']} to {len(document.get('recipients', []))} recipients",
            command_type="bulk_message",
            status="delivered" if sent_count else "failed",
            is_replayable=True,
            related_resource={"type": "bulk_message", "id": str(document["_id"]), "status": final_status},
            preview_payload={"channel": document["channel"], "sent_count": sent_count, "failed_count": failed_count},
        )
        return updated

    async def _resolve_bulk_recipients(self, user_id: str, payload: dict) -> dict:
        channel = payload.get("channel", "email")
        recipients: list[dict] = []
        invalid_entries: list[str] = []
        duplicate_entries: list[str] = []
        unavailable_contact_ids: list[str] = []
        unavailable_group_ids: list[str] = []
        seen_targets: set[str] = set()
        seen_raw_inputs: set[str] = set()

        def add_recipient(entry: dict, *, raw_key: str | None = None) -> None:
            target = (entry.get("email") if channel == "email" else entry.get("phone")) or ""
            normalized_target = target.strip().lower()
            if not normalized_target:
                if raw_key:
                    invalid_entries.append(raw_key)
                return
            if normalized_target in seen_targets:
                duplicate_entries.append(raw_key or normalized_target)
                return
            seen_targets.add(normalized_target)
            recipients.append(entry)

        for raw_email in payload.get("recipient_emails", []):
            if not isinstance(raw_email, str):
                continue
            normalized = raw_email.strip().lower()
            if not normalized:
                continue
            if normalized in seen_raw_inputs:
                duplicate_entries.append(normalized)
                continue
            seen_raw_inputs.add(normalized)
            if not self._is_valid_email(normalized):
                invalid_entries.append(normalized)
                continue
            if channel == "email":
                add_recipient(
                    {
                        "id": None,
                        "name": normalized,
                        "email": normalized,
                        "phone": None,
                        "avatar_url": None,
                        "initials": self._contact_initials(normalized),
                        "source": "raw_email",
                    },
                    raw_key=normalized,
                )

        for contact_id in list(dict.fromkeys(payload.get("contact_ids", []))):
            if not ObjectId.is_valid(contact_id):
                unavailable_contact_ids.append(contact_id)
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if not contact:
                unavailable_contact_ids.append(contact_id)
                continue
            add_recipient(
                {
                    "id": str(contact["_id"]),
                    "name": contact.get("name"),
                    "email": contact.get("email"),
                    "phone": contact.get("phone"),
                    "avatar_url": contact.get("avatar_url"),
                    "initials": self._contact_initials(contact.get("name")),
                    "source": "contact",
                },
                raw_key=(contact.get("email") if channel == "email" else contact.get("phone")) or contact_id,
            )

        for group_id in list(dict.fromkeys(payload.get("group_ids", []))):
            if not ObjectId.is_valid(group_id):
                unavailable_group_ids.append(group_id)
                continue
            group = await self.db.groups.find_one({"_id": ObjectId(group_id), "user_id": user_id})
            if not group:
                unavailable_group_ids.append(group_id)
                continue
            for member_id in group.get("member_ids", []):
                if not ObjectId.is_valid(member_id):
                    continue
                contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": user_id})
                if not contact:
                    continue
                add_recipient(
                    {
                        "id": str(contact["_id"]),
                        "name": contact.get("name"),
                        "email": contact.get("email"),
                        "phone": contact.get("phone"),
                        "avatar_url": contact.get("avatar_url"),
                        "initials": self._contact_initials(contact.get("name")),
                        "source": "group_member",
                    },
                    raw_key=(contact.get("email") if channel == "email" else contact.get("phone")) or member_id,
                )

        return {
            "recipients": recipients,
            "invalid_entries": invalid_entries,
            "duplicate_entries": duplicate_entries,
            "unavailable_contact_ids": unavailable_contact_ids,
            "unavailable_group_ids": unavailable_group_ids,
        }

    def _validate_bulk_message_payload(self, payload: dict, resolution: dict) -> None:
        channel = payload.get("channel", "email")
        content = (payload.get("content") or "").strip()
        if not content:
            raise AppException(status_code=400, code="BULK_CONTENT_REQUIRED", message="Bulk message content is required.")
        if channel == "email" and not (payload.get("subject") or "").strip():
            raise AppException(status_code=400, code="BULK_SUBJECT_REQUIRED", message="Email bulk messages require a subject.")
        if not resolution["recipients"]:
            raise AppException(status_code=400, code="BULK_RECIPIENTS_REQUIRED", message="At least one valid recipient is required.")
        scheduled_at = payload.get("scheduled_at")
        if scheduled_at and scheduled_at <= utc_now():
            raise AppException(status_code=400, code="BULK_SCHEDULE_INVALID", message="Scheduled send time must be in the future.")

    @staticmethod
    def _serialize_bulk_message(document: dict | None) -> dict:
        safe = serialize_mongo_document(document) or {}
        if "_id" in safe:
            safe["id"] = safe.pop("_id")
        safe.pop("user_id", None)
        return safe

    @staticmethod
    def _bulk_segment_count(channel: str, content: str) -> int:
        if channel == "sms":
            return max(1, ceil(len(content) / 160))
        return 1

    @staticmethod
    def _is_valid_email(value: str) -> bool:
        return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))

    # ------------------------------------------------------------------
    # Agreement / lease shared helpers
    # ------------------------------------------------------------------
    async def _next_agreement_number(self) -> str:
        counter = await self.db.counters.find_one_and_update(
            {"_id": "agreement_number"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return f"AGR-{date.today().year}-{int(counter['seq']):04d}"

    async def _next_lease_number(self) -> str:
        counter = await self.db.counters.find_one_and_update(
            {"_id": "lease_number"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return f"LD-{date.today().year}-{int(counter['seq']):04d}"

    async def _expire_stale_agreements(self, user_id: str) -> None:
        await self.db.agreements.update_many(
            {
                "user_id": user_id,
                "status": {"$in": ["draft", "pending_signature"]},
                "end_date": {"$lt": date.today().isoformat()},
            },
            {"$set": {"status": "expired", "expired_at": utc_now(), "updated_at": utc_now()}},
        )

    async def _expire_stale_leases(self, user_id: str) -> None:
        await self.db.agreements.update_many(
            {
                "user_id": user_id,
                "agreement_type": "lease",
                "status": {"$nin": ["expired", "cancelled"]},
                "end_date": {"$lt": date.today().isoformat()},
            },
            {"$set": {"status": "expired", "expired_at": utc_now(), "updated_at": utc_now()}},
        )

    async def _refresh_agreement_status(self, agreement: dict) -> dict:
        derived_status = self._derive_agreement_status(agreement)
        if derived_status != agreement.get("status"):
            agreement = await self.db.agreements.find_one_and_update(
                {"_id": agreement["_id"]},
                {"$set": {"status": derived_status, "expired_at": utc_now(), "updated_at": utc_now()}},
                return_document=ReturnDocument.AFTER,
            )
        return agreement

    async def _refresh_lease_status(self, lease: dict) -> dict:
        derived_status = self._derive_lease_status(lease)
        agreement_status = self._agreement_status_from_lease_status(derived_status)
        if agreement_status != lease.get("status"):
            lease = await self.db.agreements.find_one_and_update(
                {"_id": lease["_id"]},
                {"$set": {"status": agreement_status, "expired_at": utc_now() if derived_status == "expired" else None, "updated_at": utc_now()}},
                return_document=ReturnDocument.AFTER,
            )
        return lease

    async def _get_owned_lease(self, user_id: str, lease_id: str) -> dict:
        lease = await self._get_owned_document(self.db.agreements, user_id, lease_id, "LEASE_NOT_FOUND")
        if lease.get("agreement_type") != "lease":
            raise AppException(status_code=404, code="LEASE_NOT_FOUND", message="Requested lease was not found.")
        return lease

    def _lease_list_filters(self, user_id: str, search: str | None, status: str | None) -> dict:
        filters: dict = {"user_id": user_id, "agreement_type": "lease"}
        and_clauses: list[dict] = []
        today = date.today().isoformat()
        if status and status != "all":
            if status == "active":
                and_clauses.append({"status": "signed"})
                and_clauses.append({"$or": [{"end_date": None}, {"end_date": ""}, {"end_date": {"$gte": today}}]})
            elif status == "expired":
                and_clauses.append({"$or": [{"status": "expired"}, {"end_date": {"$lt": today}}]})
            elif status == "pending_signature":
                and_clauses.append({"status": "pending_signature"})
            elif status in {"draft", "cancelled"}:
                and_clauses.append({"status": status})
        if search:
            and_clauses.append(
                {
                    "$or": [
                        {"title": {"$regex": search, "$options": "i"}},
                        {"client_name": {"$regex": search, "$options": "i"}},
                        {"client_email": {"$regex": search, "$options": "i"}},
                        {"agreement_number": {"$regex": search, "$options": "i"}},
                        {"metadata.lease.tenant_name": {"$regex": search, "$options": "i"}},
                        {"metadata.lease.landlord_name": {"$regex": search, "$options": "i"}},
                        {"metadata.lease.property_address": {"$regex": search, "$options": "i"}},
                    ]
                }
            )
        if and_clauses:
            filters["$and"] = and_clauses
        return filters

    @staticmethod
    def _agreement_status_from_lease_status(status: str | None) -> str:
        if status == "active":
            return "signed"
        if status in {"draft", "pending_signature", "expired", "cancelled", "signed"}:
            return status
        return "draft"

    def _normalize_lease_details(self, payload: dict, existing: dict | None = None) -> dict:
        details = dict(existing or {})
        rent_cents_source = payload["monthly_rent_cents"] if "monthly_rent_cents" in payload else None if "monthly_rent" in payload else details.get("monthly_rent_cents")
        deposit_cents_source = (
            payload["security_deposit_cents"]
            if "security_deposit_cents" in payload
            else None if "security_deposit" in payload else details.get("security_deposit_cents")
        )
        amount_cents = self._amount_to_cents(
            rent_cents_source,
            payload.get("monthly_rent"),
        )
        if amount_cents == 0 and payload.get("prompt") and not existing:
            amount_cents = self._prompt_money_to_cents(payload["prompt"])
        deposit_cents = self._amount_to_cents(
            deposit_cents_source,
            payload.get("security_deposit"),
        )
        signature_fields = payload.get("signature_fields", details.get("signature_fields") or {})
        if hasattr(signature_fields, "model_dump"):
            signature_fields = signature_fields.model_dump()
        normalized = {
            "property_address": str(payload.get("property_address", details.get("property_address") or "Property address to be confirmed")).strip(),
            "property_type": payload.get("property_type", details.get("property_type") or "apartment"),
            "landlord_name": str(payload.get("landlord_name", details.get("landlord_name") or "Landlord")).strip(),
            "tenant_name": str(payload.get("tenant_name", details.get("tenant_name") or payload.get("client_name") or "Tenant")).strip(),
            "tenant_email": payload.get("tenant_email", details.get("tenant_email")),
            "tenant_phone": payload.get("tenant_phone", details.get("tenant_phone")),
            "monthly_rent_cents": amount_cents,
            "security_deposit_cents": deposit_cents,
            "currency": str(payload.get("currency", details.get("currency") or "USD")).strip().upper(),
            "rent_due_day": int(payload.get("rent_due_day", details.get("rent_due_day") or 1)),
            "start_date": self._agreement_date_to_iso(payload.get("start_date", details.get("start_date"))),
            "end_date": self._agreement_date_to_iso(payload.get("end_date", details.get("end_date"))),
            "custom_terms": str(payload.get("custom_terms", details.get("custom_terms") or "")).strip(),
            "signature_fields": {
                "tenant_signature": bool(signature_fields.get("tenant_signature", True)),
                "landlord_signature": bool(signature_fields.get("landlord_signature", True)),
            },
        }
        if not 1 <= normalized["rent_due_day"] <= 31:
            raise AppException(status_code=422, code="LEASE_RENT_DUE_DAY_INVALID", message="Rent due day must be between 1 and 31.")
        self._validate_agreement_dates(normalized)
        return normalized

    def _lease_details_from_agreement(self, agreement: dict) -> dict:
        metadata = agreement.get("metadata") or {}
        details = metadata.get("lease") or {}
        return self._normalize_lease_details(
            {
                "property_address": details.get("property_address") or agreement.get("title"),
                "property_type": details.get("property_type") or "apartment",
                "landlord_name": details.get("landlord_name") or "Landlord",
                "tenant_name": details.get("tenant_name") or agreement.get("client_name"),
                "tenant_email": details.get("tenant_email") or agreement.get("client_email"),
                "tenant_phone": details.get("tenant_phone") or agreement.get("client_phone"),
                "monthly_rent_cents": details.get("monthly_rent_cents"),
                "security_deposit_cents": details.get("security_deposit_cents"),
                "currency": details.get("currency") or "USD",
                "rent_due_day": details.get("rent_due_day") or 1,
                "start_date": details.get("start_date") or agreement.get("start_date"),
                "end_date": details.get("end_date") or agreement.get("end_date"),
                "custom_terms": details.get("custom_terms") or "",
                "signature_fields": details.get("signature_fields") or {},
            }
        )

    @staticmethod
    def _lease_smart_fields(details: dict) -> list[dict]:
        fields: list[dict] = []
        signature_fields = details.get("signature_fields") or {}
        if signature_fields.get("tenant_signature", True):
            fields.append(
                {
                    "key": "tenant_signature",
                    "label": "Tenant Signature",
                    "field_type": "signature",
                    "required": True,
                    "enabled": True,
                    "page": 1,
                    "anchor_text": "Tenant Signature",
                }
            )
        if signature_fields.get("landlord_signature", True):
            fields.append(
                {
                    "key": "landlord_signature",
                    "label": "Landlord Signature",
                    "field_type": "signature",
                    "required": True,
                    "enabled": True,
                    "page": 1,
                    "anchor_text": "Landlord Signature",
                }
            )
        fields.append(
            {
                "key": "date_signed",
                "label": "Date Signed",
                "field_type": "date",
                "required": True,
                "enabled": True,
                "page": 1,
                "anchor_text": "Date Signed",
            }
        )
        return fields

    @staticmethod
    def _derive_lease_status(lease: dict) -> str:
        status = lease.get("status") or "draft"
        if status == "cancelled":
            return "cancelled"
        end_date = SmartFlowBase._agreement_date_value(lease.get("end_date"))
        if end_date and end_date < date.today():
            return "expired"
        if status == "pending_signature":
            return "pending_signature"
        if status == "signed":
            return "active"
        if status == "expired":
            return "expired"
        return "draft"

    def _lease_summary(self, leases: list[dict]) -> dict:
        statuses = [self._derive_lease_status(item) for item in leases]
        return {
            "total_leases": len(leases),
            "draft_leases": statuses.count("draft"),
            "active_leases": statuses.count("active"),
            "pending_signature_leases": statuses.count("pending_signature"),
            "expired_leases": statuses.count("expired"),
            "cancelled_leases": statuses.count("cancelled"),
        }

    def _serialize_lease(self, lease: dict, *, include_content: bool) -> dict:
        safe = self._serialize_agreement(lease, include_content=include_content)
        details = self._lease_details_from_agreement(lease)
        lease_status = self._derive_lease_status({**lease, "end_date": details.get("end_date")})
        lease_id = safe["id"]
        safe["agreement_status"] = safe.get("status")
        safe["status"] = lease_status
        safe["lease_status"] = lease_status
        safe["status_label"] = self._lease_status_label(lease_status)
        safe["status_tone"] = self._lease_status_tone(lease_status)
        safe["lease_number"] = safe.get("agreement_number")
        safe["tenant_name"] = details["tenant_name"]
        safe["landlord_name"] = details["landlord_name"]
        safe["property_address"] = details["property_address"]
        safe["property_type"] = details["property_type"]
        safe["property_type_label"] = self._lease_property_type_label(details["property_type"])
        safe["monthly_rent_cents"] = details["monthly_rent_cents"]
        safe["monthly_rent_label"] = self._money_label(details["monthly_rent_cents"], details["currency"], suffix="/mo")
        safe["security_deposit_cents"] = details["security_deposit_cents"]
        safe["security_deposit_label"] = self._money_label(details["security_deposit_cents"], details["currency"])
        safe["currency"] = details["currency"]
        safe["rent_due_day"] = details["rent_due_day"]
        safe["rent_due_label"] = self._ordinal_day(details["rent_due_day"])
        safe["duration_months"] = self._lease_duration_months(details.get("start_date"), details.get("end_date"))
        safe["duration_label"] = self._lease_duration_label(details.get("start_date"), details.get("end_date"))
        safe["signature_fields"] = details["signature_fields"]
        safe["lease"] = details
        safe["property"] = {
            "address": details["property_address"],
            "type": details["property_type"],
            "type_label": safe["property_type_label"],
        }
        safe["rent"] = {
            "monthly_rent_cents": details["monthly_rent_cents"],
            "monthly_rent_label": safe["monthly_rent_label"],
            "security_deposit_cents": details["security_deposit_cents"],
            "security_deposit_label": safe["security_deposit_label"],
            "currency": details["currency"],
            "due_day": details["rent_due_day"],
            "due_label": safe["rent_due_label"],
        }
        safe["duration"] = {
            "start_date": details.get("start_date"),
            "end_date": details.get("end_date"),
            "months": safe["duration_months"],
            "label": safe["duration_label"],
        }
        safe["created_date_label"] = self._date_label(safe.get("created_at"))
        existing_review = lease.get("ai_review") or []
        safe["ai_review"] = existing_review if any(item.get("key") == "duration" for item in existing_review) else self._review_lease_content(lease.get("content", ""), details)
        safe["actions"] = self._lease_actions(lease_status, lease)
        safe["primary_action"] = self._lease_primary_action(lease_status, lease)
        safe["pdf_url"] = f"/api/v1/smartflow/leases/{lease_id}/pdf"
        safe["signature_request_url"] = self._lease_signature_url(lease["signature_request_token"]) if lease.get("signature_request_token") else None
        return safe

    @staticmethod
    def _lease_property_type_label(property_type: str | None) -> str:
        labels = {
            "apartment": "Apartment",
            "house": "House",
            "office_space": "Office Space",
            "shop": "Shop",
            "warehouse": "Warehouse",
            "land": "Land",
            "other": "Other",
        }
        return labels.get(property_type or "", "Property")

    @staticmethod
    def _lease_status_label(status: str | None) -> str:
        labels = {
            "draft": "Draft",
            "active": "Active",
            "pending_signature": "Pending Signature",
            "expired": "Expired",
            "cancelled": "Cancelled",
        }
        return labels.get(status or "", "Draft")

    @staticmethod
    def _lease_status_tone(status: str | None) -> str:
        tones = {
            "draft": "muted",
            "active": "success",
            "pending_signature": "warning",
            "expired": "danger",
            "cancelled": "muted",
        }
        return tones.get(status or "", "muted")

    @staticmethod
    def _lease_actions(status: str | None, lease: dict) -> list[str]:
        actions = ["view", "download"]
        if status == "draft":
            actions.extend(["edit", "send_signature"])
        elif status == "pending_signature":
            actions.extend(["sign", "edit"])
        elif status == "active":
            actions.append("manage")
            if lease.get("signature"):
                actions.append("verified")
        elif status == "expired":
            actions.extend(["renew", "download"])
        elif status == "cancelled":
            actions.append("delete")
        return list(dict.fromkeys(actions))

    @staticmethod
    def _lease_primary_action(status: str | None, lease: dict) -> str:
        if status == "pending_signature":
            return "sign"
        if status == "expired":
            return "renew"
        if status == "active" and lease.get("signature"):
            return "verified"
        if status == "active":
            return "manage"
        if status == "draft":
            return "manage"
        return "view"

    @staticmethod
    def _lease_signature_url(token: str) -> str:
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}/api/v1/smartflow/leases/signing/{token}"

    @staticmethod
    def _infer_lease_title(details: dict) -> str:
        property_label = SmartFlowBase._lease_property_type_label(details.get("property_type"))
        address = details.get("property_address")
        if address and address != "Property address to be confirmed":
            return f"{property_label} Lease - {address}"
        return f"{property_label} Lease Agreement"

    def _generate_lease_content(self, payload: dict) -> str:
        details = self._normalize_lease_details(payload)
        title = (payload.get("title") or "Residential Lease Agreement").strip()
        prompt = (payload.get("prompt") or "").strip()
        start_date = details.get("start_date") or "the lease start date"
        end_date = details.get("end_date") or "the lease end date"
        rent_label = self._money_label(details["monthly_rent_cents"], details["currency"], suffix="/month")
        deposit_label = self._money_label(details["security_deposit_cents"], details["currency"])
        custom_terms = details.get("custom_terms")
        sections = [
            title.upper(),
            f"This Lease Agreement is made by and between {details['landlord_name']} (\"Landlord\") and {details['tenant_name']} (\"Tenant\").",
            f"1. PROPERTY ADDRESS\nThe Landlord agrees to rent the {self._lease_property_type_label(details['property_type']).lower()} located at {details['property_address']} to the Tenant.",
            f"2. RENT PAYMENT\nThe Tenant shall pay monthly rent of {rent_label}. Rent is due on the {self._ordinal_day(details['rent_due_day'])} day of each calendar month.",
            f"3. SECURITY DEPOSIT\nThe Tenant shall pay a refundable security deposit of {deposit_label}. Deductions may be made only for unpaid rent, approved charges, or damage beyond ordinary wear and tear.",
            f"4. TERM OF LEASE\nThe lease begins on {start_date} and ends on {end_date}, unless extended or terminated in accordance with this Agreement.",
            "5. LATE FEES\nIf rent is not received within five calendar days after the due date, the Landlord may charge a reasonable late fee where permitted by applicable law.",
            "6. USE AND OCCUPANCY\nThe Tenant shall use the property only for lawful occupancy and shall not assign or sublet the property without written consent from the Landlord.",
            "7. MAINTENANCE\nThe Tenant shall keep the property clean and promptly report needed repairs. The Landlord remains responsible for repairs required by applicable housing law.",
        ]
        if prompt:
            sections.append(f"8. AI REQUEST SUMMARY\nThis lease was generated from the following request: {prompt}")
        if custom_terms:
            sections.append(f"9. ADDITIONAL TERMS\n{custom_terms}")
        sections.append("10. SIGNATURES\nTenant Signature: ____________________ Date: __________\nLandlord Signature: __________________ Date: __________")
        return "\n\n".join(sections)

    @staticmethod
    def _enhance_lease_terms_text(custom_terms: str | None, focus: str) -> str:
        base_terms = (custom_terms or "").strip()
        additions = [
            "Late Fee: If rent is unpaid five calendar days after the due date, a reasonable late fee may apply where allowed by law.",
            "Maintenance: Tenant must promptly report urgent repairs, and Landlord must address habitability repairs within a reasonable time.",
            "Access: Landlord may enter the property after reasonable notice, except during emergencies.",
            "Renewal: Any renewal, rent change, or extension must be confirmed in writing by both parties.",
        ]
        if focus == "tenant":
            additions.append("Tenant Protection: Security deposit deductions must be itemized in writing with supporting documentation.")
        elif focus == "landlord":
            additions.append("Landlord Protection: Unauthorized occupants, subletting, or material property misuse may trigger default remedies.")
        elif focus == "compliance":
            additions.append("Compliance: Both parties must comply with applicable local rental, housing, safety, and notice requirements.")
        enhanced = base_terms
        for addition in additions:
            key = addition.split(":", 1)[0].lower()
            if key not in enhanced.lower():
                enhanced = f"{enhanced}\n{addition}".strip()
        return enhanced

    @staticmethod
    def _merge_lease_enhanced_terms(content: str, enhanced_terms: str) -> str:
        cleaned = content.strip()
        if "additional terms" in cleaned.lower():
            return f"{cleaned}\n\nAI-ENHANCED TERMS\n{enhanced_terms}"
        return f"{cleaned}\n\nADDITIONAL TERMS\n{enhanced_terms}"

    def _review_lease_content(self, content: str, details: dict) -> list[dict]:
        lower = content.lower()
        signature_fields = details.get("signature_fields") or {}
        checks = [
            (
                "duration",
                "Lease duration clearly defined",
                bool(details.get("start_date") and details.get("end_date")) or ("begin" in lower and ("end" in lower or "terminate" in lower)),
                "Lease start and end dates are present.",
                "Start date or end date is missing.",
                "error",
            ),
            (
                "payment_terms",
                "Payment terms included",
                details.get("monthly_rent_cents", 0) > 0 or "rent" in lower or "$" in content,
                "Monthly rent and due date are specified.",
                "Monthly rent amount or due date is missing.",
                "error",
            ),
            (
                "late_fee",
                "Late fee specified",
                "late fee" in lower or "late charge" in lower,
                "Late payment consequence is defined.",
                "Missing standard late fee terms for payment delays.",
                "warning",
            ),
            (
                "property_address",
                "Property address included",
                bool(details.get("property_address") and details["property_address"] != "Property address to be confirmed"),
                "Rental property address is present.",
                "Property address should be confirmed before signature.",
                "error",
            ),
            (
                "signature_fields",
                "Signature fields included",
                bool(signature_fields.get("tenant_signature", True) and signature_fields.get("landlord_signature", True)) and "signature" in lower,
                "Tenant and landlord signature fields are enabled.",
                "Both tenant and landlord signature fields should be enabled.",
                "warning",
            ),
            (
                "security_deposit",
                "Security deposit addressed",
                details.get("security_deposit_cents", 0) > 0 or "security deposit" in lower,
                "Security deposit handling is included.",
                "Security deposit amount or handling is not specified.",
                "warning",
            ),
        ]
        return [
            {
                "key": key,
                "title": title,
                "message": success_message if passed else failure_message,
                "severity": "success" if passed else severity,
                "passed": passed,
            }
            for key, title, passed, success_message, failure_message, severity in checks
        ]

    @staticmethod
    def _amount_to_cents(cents_value, amount_value) -> int:
        if cents_value is not None:
            return int(cents_value)
        if amount_value is None or amount_value == "":
            return 0
        return int(round(float(amount_value) * 100))

    @staticmethod
    def _prompt_money_to_cents(prompt: str) -> int:
        match = re.search(r"\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)", prompt)
        if not match:
            return 0
        return int(round(float(match.group(1).replace(",", "")) * 100))

    @staticmethod
    def _money_label(cents: int | None, currency: str, suffix: str = "") -> str:
        amount = (cents or 0) / 100
        symbol = "$" if currency == "USD" else f"{currency} "
        if amount.is_integer():
            formatted = f"{symbol}{int(amount):,}"
        else:
            formatted = f"{symbol}{amount:,.2f}"
        return f"{formatted}{suffix}"

    @staticmethod
    def _lease_duration_months(start_value, end_value) -> int | None:
        start = SmartFlowBase._agreement_date_value(start_value)
        end = SmartFlowBase._agreement_date_value(end_value)
        if not start or not end:
            return None
        months = (end.year - start.year) * 12 + end.month - start.month
        if end.day >= start.day:
            months += 1
        return max(1, months)

    @staticmethod
    def _lease_duration_label(start_value, end_value) -> str:
        months = SmartFlowBase._lease_duration_months(start_value, end_value)
        if not months:
            return "Duration TBD"
        return f"{months} Month" if months == 1 else f"{months} Months"

    @staticmethod
    def _ordinal_day(day: int) -> str:
        if 10 <= day % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix}"

    @staticmethod
    def _date_label(value) -> str | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value.strftime("%b %d, %Y")
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%b %d, %Y")
            except ValueError:
                return value
        return str(value)

    @staticmethod
    def _normalize_agreement_smart_fields(fields: list[dict] | None) -> list[dict]:
        if fields is None:
            return SmartFlowBase._default_agreement_smart_fields()
        normalized: list[dict] = []
        for field in fields:
            key = str(field.get("key") or "").strip()
            if not key:
                continue
            normalized.append(
                {
                    "key": key,
                    "label": str(field.get("label") or key.replace("_", " ").title()).strip(),
                    "field_type": field.get("field_type") or field.get("type") or "text",
                    "required": bool(field.get("required", True)),
                    "enabled": bool(field.get("enabled", True)),
                    "page": int(field.get("page") or 1),
                    "anchor_text": field.get("anchor_text"),
                }
            )
        return normalized or SmartFlowBase._default_agreement_smart_fields()

    @staticmethod
    def _default_agreement_smart_fields() -> list[dict]:
        return [
            {
                "key": "signature",
                "label": "Signature Field",
                "field_type": "signature",
                "required": True,
                "enabled": True,
                "page": 1,
                "anchor_text": "Client Authorized Representative",
            },
            {
                "key": "date_signed",
                "label": "Date Signed",
                "field_type": "date",
                "required": True,
                "enabled": True,
                "page": 1,
                "anchor_text": "Date Signed",
            },
        ]

    @staticmethod
    def _validate_agreement_dates(document: dict) -> None:
        start_date = SmartFlowBase._agreement_date_value(document.get("start_date"))
        end_date = SmartFlowBase._agreement_date_value(document.get("end_date"))
        if start_date and end_date and end_date < start_date:
            raise AppException(status_code=422, code="AGREEMENT_DATE_INVALID", message="Agreement end date must be after start date.")

    @staticmethod
    def _derive_agreement_status(agreement: dict) -> str:
        status = agreement.get("status") or "draft"
        if status in {"signed", "cancelled"}:
            return status
        end_date = SmartFlowBase._agreement_date_value(agreement.get("end_date"))
        if end_date and end_date < date.today():
            return "expired"
        return status

    @staticmethod
    def _agreement_date_to_iso(value) -> str | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    @staticmethod
    def _agreement_date_value(value) -> date | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value)
        return None

    def _agreement_summary(self, agreements: list[dict]) -> dict:
        statuses = [self._derive_agreement_status(item) for item in agreements]
        return {
            "total_agreements": len(agreements),
            "draft_agreements": statuses.count("draft"),
            "pending_signature_agreements": statuses.count("pending_signature"),
            "signed_agreements": statuses.count("signed"),
            "expired_agreements": statuses.count("expired"),
            "cancelled_agreements": statuses.count("cancelled"),
        }

    def _serialize_agreement(self, agreement: dict, *, include_content: bool) -> dict:
        safe = self._to_public(agreement)
        safe.pop("user_id", None)
        agreement_id = safe["id"]
        status = self._derive_agreement_status(safe)
        safe["status"] = status
        safe["agreement_type_label"] = self._agreement_type_label(safe.get("agreement_type"))
        safe["status_label"] = self._agreement_status_label(status)
        safe["status_tone"] = self._agreement_status_tone(status)
        safe["smart_fields"] = self._normalize_agreement_smart_fields(safe.get("smart_fields"))
        safe["ai_review"] = safe.get("ai_review") or self._review_agreement_content(safe.get("content", ""), safe.get("agreement_type", "contract"))
        safe["signature_request_url"] = self._agreement_signature_url(safe["signature_request_token"]) if safe.get("signature_request_token") else None
        safe["pdf_url"] = self._agreement_pdf_url(agreement_id)
        safe["actions"] = self._agreement_actions(status)
        if not include_content:
            safe["content"] = None
        return safe

    @staticmethod
    def _agreement_type_label(agreement_type: str | None) -> str:
        labels = {
            "contract": "Contract",
            "lease": "Lease",
            "legal": "Legal",
            "vendor": "Vendor",
            "service": "Service Agreement",
            "nda": "NDA",
            "other": "Other",
        }
        return labels.get(agreement_type or "", "Agreement")

    @staticmethod
    def _agreement_status_label(status: str | None) -> str:
        labels = {
            "draft": "Draft",
            "pending_signature": "Pending Signature",
            "signed": "Signed",
            "expired": "Expired",
            "cancelled": "Cancelled",
        }
        return labels.get(status or "", "Draft")

    @staticmethod
    def _agreement_status_tone(status: str | None) -> str:
        tones = {
            "draft": "muted",
            "pending_signature": "warning",
            "signed": "success",
            "expired": "danger",
            "cancelled": "muted",
        }
        return tones.get(status or "", "muted")

    @staticmethod
    def _agreement_actions(status: str | None) -> list[str]:
        actions = ["view", "download"]
        if status in {"draft", "pending_signature"}:
            actions.append("edit")
        if status == "draft":
            actions.append("send_signature")
        if status == "pending_signature":
            actions.append("sign")
        if status == "expired":
            actions.extend(["renew", "delete"])
        if status == "cancelled":
            actions.append("delete")
        return actions

    @staticmethod
    def _agreement_pdf_url(agreement_id: str) -> str:
        return f"/api/v1/smartflow/agreements/{agreement_id}/pdf"

    @staticmethod
    def _agreement_signature_url(token: str) -> str:
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}/api/v1/smartflow/agreements/signing/{token}"

    @staticmethod
    def _infer_agreement_title(prompt: str, agreement_type: str) -> str:
        prompt_lower = prompt.lower()
        if "website" in prompt_lower:
            return "Website Development Agreement"
        if agreement_type == "nda":
            return "NDA Agreement"
        if agreement_type == "lease":
            return "Office Lease Agreement"
        if agreement_type == "vendor":
            return "Vendor Agreement"
        return f"{SmartFlowBase._agreement_type_label(agreement_type)} Agreement"

    def _generate_agreement_content(self, payload: dict) -> str:
        prompt = payload.get("prompt", "").strip()
        title = payload.get("title") or self._infer_agreement_title(prompt, payload.get("agreement_type", "contract"))
        client_name = payload.get("client_name") or "Client"
        amount_match = re.search(r"\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)", prompt)
        amount_text = f"${amount_match.group(1)} USD" if amount_match else "the agreed project fee"
        upfront_text = "50% upfront and 50% upon completion" if "50%" in prompt else "according to the payment schedule agreed by both parties"
        start_date = payload.get("start_date") or date.today()
        end_date = payload.get("end_date") or "the final delivery date"
        return "\n\n".join(
            [
                f"{title.upper()}",
                f"This Agreement is entered into as of {start_date} by and between the Provider and {client_name} (\"Client\").",
                "1. PARTIES\nThe Provider will deliver the services described in this Agreement, and the Client will cooperate in good faith to provide timely information, approvals, and access needed for delivery.",
                f"2. SCOPE OF WORK\nThe Provider shall complete the work described by the following request: {prompt or 'the agreed business services'}. Deliverables must be reasonably fit for the agreed purpose.",
                f"3. PAYMENT TERMS\nThe total fee is {amount_text}. Payment will be made {upfront_text}. Late payments may pause delivery timelines until the account is current.",
                f"4. TERM AND DELIVERY\nThe Agreement begins on {start_date} and remains active until {end_date}, unless extended in writing by both parties.",
                "5. CONFIDENTIALITY\nBoth parties shall protect confidential information received during the engagement and use it only for the purposes of this Agreement.",
                "6. SIGNATURE\nBy signing below, the authorized representatives confirm that they understand and accept the terms of this Agreement.",
            ]
        )

    def _improve_agreement_content(self, content: str, instruction: str | None) -> str:
        improved = content.strip()
        lower = improved.lower()
        additions: list[str] = []
        if "payment" not in lower:
            additions.append("PAYMENT TERMS\nThe Client will pay all approved fees according to the agreed schedule and any overdue balance may pause active work.")
        if "penalty" not in lower and "late fee" not in lower:
            additions.append("PENALTY CLAUSE\nIf a party materially misses an agreed milestone without written approval, the affected party may request a written cure plan or apply reasonable late fees where permitted by law.")
        if "signature" not in lower:
            additions.append("SIGNATURE\nBoth parties agree that electronic signatures are valid and enforceable for this Agreement.")
        if instruction:
            additions.append(f"AI IMPROVEMENT NOTE\nUpdated according to instruction: {instruction.strip()}")
        if additions:
            improved = f"{improved}\n\n" + "\n\n".join(additions)
        return improved

    @staticmethod
    def _review_agreement_content(content: str, agreement_type: str) -> list[dict]:
        lower = content.lower()
        checks = [
            (
                "structure",
                "Agreement structure complete",
                any(token in lower for token in ("scope", "parties", "payment", "signature")),
                "All standard enterprise clauses are properly formatted.",
                "Agreement should include parties, scope, payment, term, and signature sections.",
                "error",
            ),
            (
                "payment_terms",
                "Payment terms included",
                "payment" in lower or "fee" in lower or "$" in content,
                "Milestones align with scope of work delivery dates.",
                "Payment amount, timing, or milestone language is missing.",
                "error",
            ),
            (
                "signature",
                "Signature field ready",
                "signature" in lower or "authorized representative" in lower,
                "Electronic signature language is present.",
                "Add a clear signature section before sending to the client.",
                "warning",
            ),
            (
                "penalty_clause",
                "Penalty clause included",
                "penalty" in lower or "late fee" in lower or "cure plan" in lower,
                "Late milestone consequences are defined.",
                "Failure to meet delivery milestones has no defined financial consequence.",
                "warning",
            ),
        ]
        return [
            {
                "key": key,
                "title": title,
                "message": success_message if passed else failure_message,
                "severity": "success" if passed else severity,
                "passed": passed,
            }
            for key, title, passed, success_message, failure_message, severity in checks
        ]

    async def _get_signature_request(self, signature_token: str) -> dict:
        signature_request = await self.db.signature_requests.find_one({"token": signature_token, "status": "pending"})
        if not signature_request:
            raise AppException(status_code=404, code="SIGNATURE_REQUEST_NOT_FOUND", message="Signature request was not found.")
        expires_at = signature_request.get("expires_at")
        now = utc_now()
        if expires_at and getattr(expires_at, "tzinfo", None) is None:
            now = now.replace(tzinfo=None)
        if expires_at and expires_at < now:
            await self.db.signature_requests.update_one({"_id": signature_request["_id"]}, {"$set": {"status": "expired", "updated_at": utc_now()}})
            raise AppException(status_code=410, code="SIGNATURE_LINK_EXPIRED", message="Signature request link has expired.")
        return signature_request

    async def _complete_agreement_signature(self, agreement: dict, payload: dict, *, signed_by_user_id: str | None) -> dict:
        if agreement.get("status") == "signed":
            raise AppException(status_code=409, code="AGREEMENT_ALREADY_SIGNED", message="This agreement has already been signed.")
        if agreement.get("status") in {"cancelled", "expired"}:
            raise AppException(status_code=409, code="AGREEMENT_NOT_SIGNABLE", message="Cancelled or expired agreements cannot be signed.")
        signed_at = utc_now()
        signature = {
            "signer_name": payload["signer_name"].strip(),
            "signer_email": payload.get("signer_email"),
            "signature_text": payload.get("signature_text"),
            "signature_url": payload.get("signature_url"),
            "signed_at": signed_at,
            "signed_by_user_id": signed_by_user_id,
        }
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {
                "$set": {
                    "status": "signed",
                    "signature": signature,
                    "signed_at": signed_at,
                    "updated_at": signed_at,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self.db.signature_requests.update_many(
            {"agreement_id": str(agreement["_id"])},
            {"$set": {"status": "completed", "updated_at": signed_at, "completed_at": signed_at}},
        )
        await self.log_ai_command(
            user_id=agreement["user_id"],
            command_text=f"Sign agreement {agreement['agreement_number']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"signer_name": signature["signer_name"]},
        )
        return self._serialize_agreement(updated, include_content=True)

    @staticmethod
    def _agreement_signature_email_text(agreement: dict, message: str | None, signature_url: str) -> str:
        lines = [
            f"Signature requested for {agreement['title']}",
            f"Agreement number: {agreement['agreement_number']}",
            f"Client: {agreement['client_name']}",
            f"Sign here: {signature_url}",
        ]
        if message:
            lines.append(f"Message: {message}")
        return "\n".join(lines)

    @staticmethod
    def _agreement_signature_email_html(agreement: dict, message: str | None, signature_url: str) -> str:
        note = f"<p>{message}</p>" if message else ""
        return f"""
        <div>
          <h2>Signature requested: {agreement['title']}</h2>
          <p>Agreement number: {agreement['agreement_number']}</p>
          <p>Client: {agreement['client_name']}</p>
          {note}
          <p><a href="{signature_url}">Review and sign agreement</a></p>
        </div>
        """

    def _generate_agreement_pdf_bytes(self, agreement: dict) -> bytes:
        lines = [
            agreement.get("title", "Agreement"),
            f"Agreement No: {agreement.get('agreement_number', '-')}",
            f"Client: {agreement.get('client_name', '-')}",
            f"Status: {self._agreement_status_label(agreement.get('status'))}",
            "",
        ]
        for paragraph in agreement.get("content", "").splitlines():
            stripped = paragraph.strip()
            if not stripped:
                lines.append("")
                continue
            while len(stripped) > 88:
                lines.append(stripped[:88])
                stripped = stripped[88:]
            lines.append(stripped)
        if agreement.get("signature"):
            signature = agreement["signature"]
            lines.extend(["", f"Signed by: {signature.get('signer_name')}", f"Signed at: {signature.get('signed_at')}"])
        return self._build_simple_pdf(lines[:46])

    @staticmethod
    def _build_simple_pdf(lines: list[str]) -> bytes:
        def escape(text: str) -> str:
            return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

        content_lines = ["BT", "/F1 11 Tf", "50 790 Td", "15 TL"]
        first = True
        for line in lines:
            if first:
                content_lines.append(f"({escape(line)}) Tj")
                first = False
            else:
                content_lines.append("T*")
                content_lines.append(f"({escape(line)}) Tj")
        content_lines.append("ET")
        stream = "\n".join(content_lines).encode("latin-1", "replace")
        objects = [
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
            f"5 0 obj << /Length {len(stream)} >> stream\n".encode("latin-1") + stream + b"\nendstream endobj\n",
        ]
        buffer = BytesIO()
        buffer.write(b"%PDF-1.4\n")
        offsets = [0]
        for obj in objects:
            offsets.append(buffer.tell())
            buffer.write(obj)
        xref_offset = buffer.tell()
        buffer.write(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
        buffer.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            buffer.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
        buffer.write((f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF").encode("latin-1"))
        return buffer.getvalue()

    # ------------------------------------------------------------------
    # Workflow / AI prefill helpers
    # ------------------------------------------------------------------
    async def _build_workflow_prefill(
        self,
        intent: str,
        transcript: str,
        current_values: dict,
        user_id: str | None = None,
        workflow_output: dict | None = None,
    ) -> dict:
        text = transcript.strip()
        lowered = text.lower()
        amount = self._extract_money_amount(text)
        emails = self._extract_emails(text)
        ai_prefill = await self._extract_workflow_prefill_with_ai(intent, text, current_values)
        ai_recipient_name = (
            ai_prefill.pop("_recipient_name", None)
            or ai_prefill.get("client_name")
            or ai_prefill.get("tenant_name")
        )

        # 1. Resolve recipient or client name
        recipient_name = ai_recipient_name
        if not recipient_name and workflow_output:
            recipient_name = (
                workflow_output.get("recipient")
                or workflow_output.get("tenant_name")
                or workflow_output.get("client_name")
                or workflow_output.get("party_b")
            )
        if not recipient_name:
            recipient_name = self._extract_name_phrase(text)

        # 2. Look up name in DB contacts to resolve their full name & email
        resolved_contact = None
        if user_id and recipient_name:
            clean_name = recipient_name.strip()
            if clean_name:
                resolved_contact = await self.db.contacts.find_one({
                    "user_id": user_id,
                    "$or": [
                        {"name": {"$regex": rf"\b{re.escape(clean_name)}\b", "$options": "i"}},
                        {"first_name": {"$regex": rf"^{re.escape(clean_name)}$", "$options": "i"}},
                        {"last_name": {"$regex": rf"^{re.escape(clean_name)}$", "$options": "i"}},
                    ]
                })

        if resolved_contact:
            final_name = resolved_contact.get("name") or resolved_contact.get("first_name") or recipient_name
            final_email = resolved_contact.get("email") or ""
        else:
            final_name = recipient_name or ""
            final_email = emails[0] if emails else ""

        tomorrow = utc_now() + timedelta(days=1)
        prefill: dict = dict(current_values)
        prefill.update(ai_prefill)

        if intent == "invoice":
            if final_name:
                prefill["client_name"] = final_name
                prefill["client_email"] = final_email or prefill.get("client_email", "")
            elif emails:
                prefill["client_email"] = emails[0]

            prefill.setdefault("currency", "USD")
            prefill.setdefault("tax_rate", 0)
            prefill.setdefault("notes", text)

            # Cleanly build prefilled items with dynamic quantity and price
            qty, unit_price = self._extract_qty_and_price(text, amount)
            work_desc = self._extract_work_description(text, recipient_name) or "Service"
            # If the description has the quantity pattern (e.g., "5 website designs"), strip the leading quantity number
            if work_desc and re.match(r"^\d+\s+", work_desc):
                work_desc = re.sub(r"^\d+\s+", "", work_desc).strip()

            if amount is not None or (not prefill.get("items") and work_desc != "Service"):
                prefill["items"] = [{
                    "description": work_desc,
                    "quantity": qty,
                    "unit_price": unit_price,
                }]

            # Dynamic Due Date (prefill both due_date and payment_due_date)
            extracted_due = None
            if workflow_output:
                extracted_due = workflow_output.get("due_date")
            if not extracted_due:
                extracted_due = prefill.get("due_date") or prefill.get("payment_due_date")
            resolved_due_date = self._parse_due_date(extracted_due, text)

            if resolved_due_date:
                prefill["due_date"] = resolved_due_date
                prefill["payment_due_date"] = resolved_due_date

            return prefill

        if intent == "bulk_message":
            channel = "sms" if "sms" in lowered or "text message" in lowered else "email"
            prefill.setdefault("channel", channel)
            prefill.setdefault("recipient_emails", emails)
            prefill.setdefault("contact_ids", [])
            prefill.setdefault("group_ids", [])
            prefill.setdefault("subject", self._short_subject_from_text(text) if channel == "email" else None)
            prefill.setdefault("content", text)
            prefill.setdefault("send_now", True)
            prefill.setdefault("timezone", "UTC")
            prefill.setdefault("ai_transcript", text)
            return prefill

        if intent == "calendar":
            starts_at = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            ends_at = starts_at + timedelta(hours=1)
            prefill.setdefault("title", self._calendar_title_from_text(text))
            prefill.setdefault("description", text)
            prefill.setdefault("starts_at", starts_at.isoformat())
            prefill.setdefault("ends_at", ends_at.isoformat())
            prefill.setdefault("meeting_mode", "online" if "online" in lowered or "zoom" in lowered or "meet" in lowered else "offline")
            prefill.setdefault("contact_ids", [])
            prefill.setdefault("timezone", "UTC")
            prefill.setdefault("reminder_minutes", 15)
            return prefill

        if intent == "lease":
            prefill.setdefault("prompt", text)
            if final_name:
                prefill["tenant_name"] = final_name
            prefill.setdefault("property_type", self._infer_property_type(lowered))
            prefill.setdefault("property_address", self._extract_address_hint(text) or "")
            prefill.setdefault("monthly_rent", amount)
            prefill.setdefault("currency", "USD")
            prefill.setdefault("rent_due_day", 1)
            prefill.setdefault("signature_fields", {"tenant_signature": True, "landlord_signature": True})
            return prefill

        if intent == "agreement":
            agreement_type = "nda" if "nda" in lowered else "service" if "service" in lowered else "contract"
            prefill.setdefault("prompt", text)
            prefill.setdefault("title", self._agreement_title_from_text(text, agreement_type))
            if final_name:
                prefill["client_name"] = final_name
                prefill["client_email"] = final_email or prefill.get("client_email", "")
            elif emails:
                prefill["client_email"] = emails[0]
            prefill.setdefault("agreement_type", agreement_type)
            prefill.setdefault("priority", "standard")
            return prefill

        return prefill

    async def _extract_workflow_prefill_with_ai(self, intent: str, transcript: str, current_values: dict) -> dict:
        if not settings.OPENAI_API_KEY:
            return {}

        prompt = self._workflow_prefill_ai_prompt(intent, transcript, current_values)

        def call_openai() -> str | None:
            try:
                from openai import OpenAI
            except ImportError:
                return None

            try:
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    temperature=0,
                    response_format={"type": "json_object"},
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You extract form-prefill JSON for a business workflow. "
                                "Return only valid JSON. Do not invent people, emails, dates, or prices "
                                "that the user did not state or clearly imply."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                )
                return response.choices[0].message.content
            except Exception:
                return None

        content = await asyncio.to_thread(call_openai)
        if not content:
            return {}

        try:
            parsed = json.loads(self._strip_json_code_fence(content))
        except (TypeError, ValueError):
            return {}

        raw_prefill = parsed.get("prefill") if isinstance(parsed, dict) else None
        if not isinstance(raw_prefill, dict):
            raw_prefill = parsed if isinstance(parsed, dict) else {}
        sanitized = self._sanitize_ai_prefill(intent, raw_prefill)

        recipient_name = parsed.get("recipient_name") if isinstance(parsed, dict) else None
        if isinstance(recipient_name, str) and recipient_name.strip():
            sanitized["_recipient_name"] = recipient_name.strip()[:120]

        return sanitized

    @staticmethod
    def _workflow_prefill_ai_prompt(intent: str, transcript: str, current_values: dict) -> str:
        field_guides = {
            "invoice": {
                "fields": {
                    "client_name": "person/company being billed",
                    "client_email": "email only if explicitly provided",
                    "currency": "3-letter code, default omitted unless stated",
                    "notes": "short invoice note from the request",
                    "due_date": "YYYY-MM-DD when stated or clearly relative to current_date",
                    "payment_due_date": "same as due_date when applicable",
                    "items": [{"description": "work/product", "quantity": 1, "unit_price": 0}],
                }
            },
            "bulk_message": {
                "fields": {
                    "channel": "email, sms, whatsapp, or in_app",
                    "recipient_emails": ["explicit email addresses"],
                    "subject": "email subject when useful",
                    "content": "message body the user wants sent",
                    "send_now": "true unless user asks to schedule",
                    "timezone": "timezone if stated",
                }
            },
            "calendar": {
                "fields": {
                    "title": "meeting/event title",
                    "description": "details",
                    "starts_at": "ISO datetime when stated or clearly relative to current_date",
                    "ends_at": "ISO datetime, infer duration only when user implies it",
                    "meeting_mode": "online or offline",
                    "location": "physical location if stated",
                    "meeting_link": "online link if stated",
                    "timezone": "timezone if stated",
                    "reminder_minutes": "integer reminder if stated",
                }
            },
            "lease": {
                "fields": {
                    "prompt": "lease generation request",
                    "tenant_name": "tenant",
                    "tenant_email": "email only if explicitly provided",
                    "property_type": "apartment, house, office_space, shop, warehouse, or land",
                    "property_address": "property address",
                    "monthly_rent": "monthly rent as number",
                    "security_deposit": "deposit as number",
                    "currency": "3-letter code",
                    "rent_due_day": "1-31",
                    "start_date": "YYYY-MM-DD",
                    "end_date": "YYYY-MM-DD",
                    "custom_terms": "extra terms",
                }
            },
            "agreement": {
                "fields": {
                    "prompt": "agreement generation request",
                    "title": "agreement title",
                    "client_name": "client/other party",
                    "client_email": "email only if explicitly provided",
                    "client_phone": "phone if explicitly provided",
                    "agreement_type": "contract, service, nda, partnership, employment, vendor, or other",
                    "priority": "low, standard, high, or urgent",
                    "start_date": "YYYY-MM-DD",
                    "end_date": "YYYY-MM-DD",
                }
            },
        }
        payload = {
            "intent": intent,
            "current_date": utc_now().date().isoformat(),
            "transcript": transcript,
            "current_values": current_values,
            "allowed_output": {
                "recipient_name": "best person/company name for contact lookup, if present",
                "prefill": field_guides.get(intent, {}).get("fields", {}),
            },
        }
        return json.dumps(payload, ensure_ascii=True, default=str)

    @staticmethod
    def _strip_json_code_fence(content: str) -> str:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    @classmethod
    def _sanitize_ai_prefill(cls, intent: str, raw: dict) -> dict:
        allowed = {
            "invoice": {"client_name", "client_email", "currency", "tax_rate", "notes", "items", "due_date", "payment_due_date"},
            "bulk_message": {"channel", "recipient_emails", "contact_ids", "group_ids", "subject", "content", "send_now", "timezone", "scheduled_at"},
            "calendar": {"title", "description", "starts_at", "ends_at", "meeting_mode", "contact_ids", "timezone", "reminder_minutes", "location", "meeting_link"},
            "lease": {
                "prompt", "title", "tenant_name", "tenant_email", "tenant_phone", "property_type", "property_address",
                "monthly_rent", "security_deposit", "currency", "rent_due_day", "start_date", "end_date", "custom_terms",
                "signature_fields",
            },
            "agreement": {
                "prompt", "title", "client_name", "client_email", "client_phone", "agreement_type", "priority",
                "start_date", "end_date",
            },
        }.get(intent, set())
        clean: dict = {}
        for key, value in raw.items():
            if key not in allowed or value in (None, "", []):
                continue
            clean[key] = cls._sanitize_ai_value(key, value)
        if intent == "invoice" and isinstance(raw.get("items"), list):
            items = []
            for item in raw["items"][:20]:
                if not isinstance(item, dict):
                    continue
                description = str(item.get("description") or "Service").strip()[:120]
                quantity = cls._coerce_int(item.get("quantity"), default=1, minimum=1)
                unit_price = cls._coerce_float(item.get("unit_price"), default=0.0, minimum=0.0)
                items.append({"description": description or "Service", "quantity": quantity, "unit_price": unit_price})
            if items:
                clean["items"] = items
        return clean

    @staticmethod
    def _sanitize_ai_value(key: str, value):
        if key in {"recipient_emails", "contact_ids", "group_ids"}:
            return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []
        if key in {"send_now"}:
            return bool(value)
        if key in {"tax_rate", "monthly_rent", "security_deposit", "reminder_minutes"}:
            return SmartFlowBase._coerce_float(value, default=0.0, minimum=0.0)
        if key in {"rent_due_day"}:
            return SmartFlowBase._coerce_int(value, default=1, minimum=1, maximum=31)
        if key == "currency":
            return str(value).strip().upper()[:3]
        if key == "signature_fields" and isinstance(value, dict):
            return {
                "tenant_signature": bool(value.get("tenant_signature", True)),
                "landlord_signature": bool(value.get("landlord_signature", True)),
            }
        if key == "items":
            return value
        return str(value).strip()[:3000]

    @staticmethod
    def _coerce_float(value, default: float = 0.0, minimum: float | None = None, maximum: float | None = None) -> float:
        try:
            number = float(str(value).replace(",", ""))
        except (TypeError, ValueError):
            number = default
        if minimum is not None:
            number = max(minimum, number)
        if maximum is not None:
            number = min(maximum, number)
        return number

    @staticmethod
    def _coerce_int(value, default: int = 0, minimum: int | None = None, maximum: int | None = None) -> int:
        try:
            number = int(float(str(value).replace(",", "")))
        except (TypeError, ValueError):
            number = default
        if minimum is not None:
            number = max(minimum, number)
        if maximum is not None:
            number = min(maximum, number)
        return number

    @staticmethod
    def _workflow_missing_fields(intent: str, prefill: dict) -> list[str]:
        required = {
            "invoice": ["client_name", "items"],
            "bulk_message": ["content"],
            "calendar": ["title", "starts_at", "ends_at"],
            "lease": ["prompt"],
            "agreement": ["prompt", "client_name"],
        }.get(intent, [])
        missing = [field for field in required if prefill.get(field) in (None, "", [])]
        if intent == "bulk_message" and not prefill.get("recipient_emails") and not prefill.get("contact_ids") and not prefill.get("group_ids"):
            missing.append("recipients")
        return missing

    @staticmethod
    def _workflow_create_config(intent: str) -> dict:
        configs = {
            "invoice": {"endpoint": "/api/v1/invoices", "submit_label": "Create Invoice"},
            "bulk_message": {"endpoint": "/api/v1/smartflow/bulk-messages", "submit_label": "Create Bulk Message"},
            "calendar": {"endpoint": "/api/v1/smartflow/calendar/events", "submit_label": "Schedule Meeting"},
            "lease": {"endpoint": "/api/v1/smartflow/leases/generate", "submit_label": "Generate Lease"},
            "agreement": {"endpoint": "/api/v1/smartflow/agreements/generate", "submit_label": "Generate Agreement"},
        }
        return configs[intent]

    @staticmethod
    def _workflow_label(intent: str) -> str:
        return {"invoice": "Invoice", "bulk_message": "Bulk message", "calendar": "Calendar", "lease": "Lease", "agreement": "Agreement"}.get(intent, "AI")

    @staticmethod
    def _extract_qty_and_price(text: str, default_amount: float | None = None) -> tuple[int, float]:
        # Standard fallback: check for numbers preceding typical item words (allowing optional adjective)
        qty_match = re.search(r"\b(\d+)\s+(?:[\w-]+\s+)?(?:items?|pcs?|copies|designs?|hours?|days?|services?)\b", text, flags=re.IGNORECASE)
        qty = int(qty_match.group(1)) if qty_match else 1

        # Determine the price
        price_match = re.search(r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.\d{1,2})?)", text, flags=re.IGNORECASE)
        if not price_match:
            price_match = re.search(r"([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:dollars?|usd|/month|per month)", text, flags=re.IGNORECASE)

        amount = float(price_match.group(1).replace(",", "")) if price_match else (default_amount or 0.0)

        # If "each" or "per" or "a piece" is mentioned, the amount is the unit price
        if re.search(r"\b(?:each|per|/|a piece)\b", text, flags=re.IGNORECASE):
            unit_price = amount
        else:
            # Otherwise, the amount is the total worth, so divide by quantity
            unit_price = amount / qty if qty > 0 else amount

        return qty, unit_price

    @staticmethod
    def _parse_due_date(due_date_str: str | None, transcript: str) -> str | None:
        now = utc_now()

        # Parse relative phrases from due_date_str or the raw transcript text
        val = (due_date_str or "").strip().lower() or transcript.lower()

        if "tomorrow" in val:
            return (now + timedelta(days=1)).date().isoformat()
        if "next week" in val:
            return (now + timedelta(days=7)).date().isoformat()
        if "next month" in val:
            return (now + timedelta(days=30)).date().isoformat()

        # Check standard date formats like 2026-06-15 or 06-15-2026
        match_iso = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", val)
        if match_iso:
            return f"{match_iso.group(1)}-{match_iso.group(2)}-{match_iso.group(3)}"

        # Default fallback to 7 days from now (standard payment terms)
        return (now + timedelta(days=7)).date().isoformat()

    @staticmethod
    def _extract_money_amount(text: str) -> float | None:
        match = re.search(r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.\d{1,2})?)", text, flags=re.IGNORECASE)
        if not match:
            match = re.search(r"([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:dollars?|usd|/month|per month)", text, flags=re.IGNORECASE)
        return float(match.group(1).replace(",", "")) if match else None

    @staticmethod
    def _extract_emails(text: str) -> list[str]:
        return re.findall(r"[\w.\-+]+@[\w.\-]+\.[A-Za-z]{2,}", text)

    @staticmethod
    def _extract_name_phrase(text: str) -> str | None:
        patterns = [
            r"\bfor\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\bwith\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\bto\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\bclient\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\btenant\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
        ]
        stop_words = {"Apartment", "Office", "House", "Shop", "Warehouse", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                candidate = match.group(1).strip()
                if candidate.split()[0] not in stop_words:
                    return candidate
        return None

    @staticmethod
    def _extract_work_description(text: str, recipient_name: str | None = None) -> str | None:
        cleaned_text = text
        if recipient_name:
            # Strip "for Sarah", "to Sarah", etc. case-insensitively
            cleaned_text = re.sub(rf"\b(?:for|to|with|client|tenant)\s+{re.escape(recipient_name)}\b", "", cleaned_text, flags=re.IGNORECASE)

        match = re.search(r"\bfor\s+(.+?)\s+(?:worth|for|\$|usd|at)\b", cleaned_text, flags=re.IGNORECASE)
        if not match:
            match = re.search(r"\bfor\s+([^$]+)$", cleaned_text, flags=re.IGNORECASE)
        return match.group(1).strip()[:120] if match else None

    @staticmethod
    def _short_subject_from_text(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", text.strip())
        return cleaned if len(cleaned) <= 80 else cleaned[:77].rstrip() + "..."

    @staticmethod
    def _calendar_title_from_text(text: str) -> str:
        cleaned = re.sub(r"\b(schedule|create|set up|meeting|calendar|event)\b", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:,.")
        return cleaned[:140] if cleaned else "Meeting"

    @staticmethod
    def _infer_property_type(lowered: str) -> str:
        for value in ("apartment", "house", "office_space", "shop", "warehouse", "land"):
            if value.replace("_", " ") in lowered:
                return value
        return "office_space" if "office" in lowered else "apartment"

    @staticmethod
    def _extract_address_hint(text: str) -> str | None:
        match = re.search(r"\b(?:at|located at|property at)\s+(.+?)(?:\s+for\s+\$|\s+with\s+|\s+rent|\s*$)", text, flags=re.IGNORECASE)
        return match.group(1).strip(" ,.")[:300] if match else None

    @staticmethod
    def _agreement_title_from_text(text: str, agreement_type: str) -> str:
        if agreement_type == "nda":
            return "NDA Agreement"
        if agreement_type == "service":
            return "Service Agreement"
        cleaned = re.sub(r"\b(create|draft|agreement|contract|for)\b", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:,.")
        return f"{cleaned[:120]} Agreement" if cleaned else "Agreement"

    # ------------------------------------------------------------------
    # History replay helper (used by HistoryService)
    # ------------------------------------------------------------------
    async def _replay_linked_resource(self, user_id: str, history: dict) -> dict | None:
        related = history.get("related_resource") or {}
        resource_type = related.get("type")
        resource_id = related.get("id")
        if not resource_type or not resource_id:
            return None

        if resource_type == "invoice" and ObjectId.is_valid(resource_id):
            invoice = await self.db.invoices.find_one({"_id": ObjectId(resource_id), "owner_user_id": user_id})
            if invoice:
                return {
                    "result_type": "invoice",
                    "resource_id": resource_id,
                    "resource_type": "invoice",
                    "resource": {
                        "id": resource_id,
                        "invoice_number": invoice.get("invoice_number"),
                        "status": invoice.get("status"),
                        "total_amount": invoice.get("total_amount"),
                        "client_name": invoice.get("client_name"),
                    },
                }

        if resource_type == "bulk_message" and ObjectId.is_valid(resource_id):
            bulk_message = await self.db.bulk_messages.find_one({"_id": ObjectId(resource_id), "user_id": user_id})
            if bulk_message:
                serialized = self._serialize_bulk_message(bulk_message)
                return {
                    "result_type": "bulk_message",
                    "resource_id": resource_id,
                    "resource_type": "bulk_message",
                    "resource": serialized,
                }

        if resource_type == "document" and ObjectId.is_valid(resource_id):
            document = await self.db.documents.find_one({"_id": ObjectId(resource_id), "user_id": user_id})
            if document:
                serialized = self._with_preview_url(self._to_public(document))
                return {
                    "result_type": "document",
                    "resource_id": resource_id,
                    "resource_type": "document",
                    "resource": serialized,
                }

        if resource_type == "agreement" and ObjectId.is_valid(resource_id):
            agreement = await self.db.agreements.find_one({"_id": ObjectId(resource_id), "user_id": user_id})
            if agreement:
                return {
                    "result_type": "agreement",
                    "resource_id": resource_id,
                    "resource_type": "agreement",
                    "resource": self._serialize_agreement(agreement, include_content=False),
                }
        return None

    # ------------------------------------------------------------------
    # Settings / business profile / subscription helpers
    # ------------------------------------------------------------------
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
        lines = SmartFlowBase._business_address_lines(address, None)
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

    # ------------------------------------------------------------------
    # Support helpers
    # ------------------------------------------------------------------
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
            "support_typing": False,
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
