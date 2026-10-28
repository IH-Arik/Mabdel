from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from math import ceil

from bson import ObjectId

from app.core.exceptions import AppException
from app.services.push_notification_service import PushNotificationService
from app.utils.helpers import resolve_team_user_ids, utc_now

logger = logging.getLogger(__name__)


class CoreMixin:
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

    async def log_ai_usage(
        self,
        user_id: str,
        action: str,
        status: str,
        *,
        response_time: float | None = None,
        tokens_used: int = 0,
        error_type: str | None = None,
        prompt_text: str | None = None,
        response_text: str | None = None,
    ) -> None:
        """Best-effort write to ``ai_logs`` for the admin AI Insights dashboard. Never raises."""
        try:
            organization_id = None
            if ObjectId.is_valid(user_id):
                user = await self.db.users.find_one({"_id": ObjectId(user_id)}, {"organization_id": 1})
                organization_id = (user or {}).get("organization_id")
            
            if (not tokens_used or tokens_used <= 0) and (prompt_text or response_text):
                char_count = len(prompt_text or "") + len(response_text or "")
                tokens_used = max(1, char_count // 4)
            elif not tokens_used or tokens_used <= 0:
                tokens_used = 150

            document = {
                "user_id": user_id,
                "organization_id": organization_id,
                "action": action,
                "status": status,
                "response_time": response_time or 0.0,
                "tokens_used": tokens_used,
                "error_type": error_type,
                "timestamp": utc_now(),
            }
            await self.db.ai_logs.insert_one(document)
        except Exception:
            logger.warning("Failed to record ai_logs entry for action=%s", action, exc_info=True)

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
        direction = 1 if ascending else -1
        cursor = collection.find(filters).sort(sort_field, direction).skip((page - 1) * page_size).limit(page_size)
        # The count and the page of results don't depend on each other - run them
        # concurrently instead of paying two sequential network round-trips.
        total, raw_items = await asyncio.gather(collection.count_documents(filters), cursor.to_list(length=page_size))
        items = self._to_public_many(raw_items)
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

    async def _resolve_team_user_ids(self, user_id: str) -> list[str]:
        """Every user_id that shares CRM data visibility with this user (their
        organization), or just themselves if unscoped. Used to broaden contacts/
        invoices/leases/agreements from per-creator to org-wide."""
        return await resolve_team_user_ids(self.db, user_id)

    async def _get_team_document(self, collection, user_id: str, document_id: str, code: str) -> dict:
        """Like _get_owned_document, but visible/editable by anyone in the same
        organization as the creator — not just the creator themselves."""
        if not ObjectId.is_valid(document_id):
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")
        team_ids = await self._resolve_team_user_ids(user_id)
        document = await collection.find_one({"_id": ObjectId(document_id), "user_id": {"$in": team_ids}})
        if not document:
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")
        return document

    async def _get_user_document(self, user_id: str) -> dict:
        if not ObjectId.is_valid(user_id):
            raise AppException(status_code=404, code="USER_NOT_FOUND", message="Requested resource was not found.")
        user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise AppException(status_code=404, code="USER_NOT_FOUND", message="Requested resource was not found.")
        return user

    # Channels that talk to people outside the business. Their threads belong to the
    # organization's shared inbox, not to whoever happened to connect the channel.
    CUSTOMER_PLATFORMS = frozenset(
        {"whatsapp", "facebook_messenger", "instagram", "telegram", "email", "sms",
         "google_business", "linkedin", "twitter_x", "snapchat", "threads", "ai_receptionist"}
    )

    async def _resolve_organization_id(self, user_id: str) -> str | None:
        """The business a user belongs to. Shared by every service that stores
        org-level configuration on the ``organizations`` document (business hours,
        AI call persona, Telnyx/Stripe wiring)."""
        if not ObjectId.is_valid(user_id):
            return None
        user = await self.db.users.find_one({"_id": ObjectId(user_id)}, {"organization_id": 1})
        return (user or {}).get("organization_id")

    async def resolve_capability(self, organization_id: str | None, capability: str) -> str:
        """The effective hard-permission state for an AI receptionist capability -
        "disabled" / "ai_allowed" / "human_approval_required". An explicit entry in
        ``ai_call_settings.ai_capabilities`` always wins. Capabilities with no legacy
        equivalent (take_message, transfer_to_human, send_sms, send_email,
        create_crm_contact, capture_lead, send_payment_link) default to "ai_allowed" -
        today's actual unconditional behavior - until an owner explicitly dials one
        down. ``schedule``/``reschedule``/``cancel`` fall back to the older approval
        booleans so an existing business's behavior never silently changes just
        because this field now exists."""
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        org = org or {}
        explicit = ((org.get("ai_call_settings") or {}).get("ai_capabilities") or {}).get(capability)
        if explicit in ("disabled", "ai_allowed", "human_approval_required"):
            return explicit
        if capability not in ("schedule", "reschedule", "cancel"):
            return "ai_allowed"
        legacy = bool(org.get("require_meeting_approval", False))
        if capability == "cancel":
            return "human_approval_required" if bool(org.get("require_approval_for_cancellations", False)) else "ai_allowed"
        if capability == "reschedule":
            return "human_approval_required" if bool(org.get("require_approval_for_reschedules", legacy)) else "ai_allowed"
        return "human_approval_required" if legacy else "ai_allowed"

