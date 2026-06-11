from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from app.core.exceptions import AppException
from app.utils.helpers import utc_now


@dataclass(frozen=True)
class NormalizedSocialMessage:
    event_id: str
    contact_external_id: str
    content: str
    media_url: str | None = None
    timestamp: datetime | None = None
    external_account_id: str | None = None
    contact_name: str | None = None
    raw_payload: dict[str, Any] | None = None

    def to_payload(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "contact_external_id": self.contact_external_id,
            "content": self.content,
            "media_url": self.media_url,
            "timestamp": self.timestamp or utc_now(),
            "external_account_id": self.external_account_id,
            "contact_name": self.contact_name,
            "raw_payload": self.raw_payload,
        }


class SocialProviderAdapter:
    platform = "unknown"
    supports_recent_sync = False
    supports_webhooks = False
    unsupported_reason = "unsupported_by_provider"

    def normalize_webhook(self, payload: dict[str, Any]) -> NormalizedSocialMessage | None:
        if {"event_id", "contact_external_id", "content"}.issubset(payload.keys()):
            return NormalizedSocialMessage(
                event_id=str(payload["event_id"]),
                contact_external_id=str(payload["contact_external_id"]),
                content=str(payload["content"]),
                media_url=payload.get("media_url"),
                timestamp=payload.get("timestamp") if isinstance(payload.get("timestamp"), datetime) else utc_now(),
                external_account_id=payload.get("external_account_id"),
                contact_name=payload.get("contact_name"),
                raw_payload=payload.get("raw_payload") or payload,
            )
        return None

    async def fetch_recent_messages(self, integration: dict[str, Any], access_token: str | None) -> list[NormalizedSocialMessage]:
        return []

    async def fetch_account_metadata(self, access_token: str | None, token_data: dict[str, Any]) -> dict[str, Any]:
        return {
            "external_account_id": token_data.get("account_id") or token_data.get("id") or token_data.get("scope") or token_data.get("token_type"),
            "external_account_name": token_data.get("name"),
        }


class MetaMessagingAdapter(SocialProviderAdapter):
    supports_recent_sync = False
    supports_webhooks = True
    unsupported_reason = "needs_provider_access"

    def normalize_webhook(self, payload: dict[str, Any]) -> NormalizedSocialMessage | None:
        normalized = super().normalize_webhook(payload)
        if normalized:
            return normalized

        entries = payload.get("entry") or []
        first_entry = entries[0] if entries else {}
        external_account_id = first_entry.get("id") or first_entry.get("uid")
        changes = first_entry.get("changes") or []
        value = (changes[0] or {}).get("value", {}) if changes else first_entry
        messages = value.get("messages") or value.get("messaging") or []
        first_message = messages[0] if messages else {}
        sender = first_message.get("from") or (first_message.get("sender") or {}).get("id")
        text = (
            ((first_message.get("text") or {}).get("body"))
            or ((first_message.get("message") or {}).get("text"))
            or payload.get("content")
            or ""
        )
        event_id = first_message.get("id") or value.get("message_id") or payload.get("event_id")
        media_url = first_message.get("image", {}).get("url") if isinstance(first_message.get("image"), dict) else payload.get("media_url")
        if event_id and sender and text:
            return NormalizedSocialMessage(
                event_id=str(event_id),
                contact_external_id=str(sender),
                content=str(text),
                media_url=media_url,
                timestamp=utc_now(),
                external_account_id=str(external_account_id) if external_account_id else value.get("metadata", {}).get("phone_number_id"),
                raw_payload=payload,
            )
        return None


class TelegramAdapter(SocialProviderAdapter):
    platform = "telegram"
    supports_webhooks = True

    def normalize_webhook(self, payload: dict[str, Any]) -> NormalizedSocialMessage | None:
        normalized = super().normalize_webhook(payload)
        if normalized:
            return normalized
        message = payload.get("message") or payload.get("edited_message") or {}
        sender_doc = message.get("from") or {}
        sender = sender_doc.get("id")
        text = message.get("text") or message.get("caption")
        event_id = message.get("message_id") or payload.get("update_id")
        if event_id and sender and text:
            name = " ".join(part for part in [sender_doc.get("first_name"), sender_doc.get("last_name")] if part) or sender_doc.get("username")
            return NormalizedSocialMessage(
                event_id=str(event_id),
                contact_external_id=str(sender),
                content=str(text),
                timestamp=utc_now(),
                external_account_id=sender_doc.get("username"),
                contact_name=name,
                raw_payload=payload,
            )
        return None

    async def fetch_account_metadata(self, access_token: str | None, token_data: dict[str, Any]) -> dict[str, Any]:
        username = token_data.get("bot_username") or token_data.get("external_account_id")
        return {"external_account_id": username, "external_account_name": username}


class SnapchatAdapter(SocialProviderAdapter):
    platform = "snapchat"
    supports_recent_sync = True
    supports_webhooks = False
    unsupported_reason = "needs_provider_access"

    async def fetch_recent_messages(self, integration: dict[str, Any], access_token: str | None) -> list[NormalizedSocialMessage]:
        metadata = integration.get("provider_metadata") or {}
        profile_id = metadata.get("snapchat_profile_id") or integration.get("external_account_id")
        conversation_id = metadata.get("snapchat_conversation_id")
        conversation_token = metadata.get("snapchat_conversation_token")
        if not access_token or not profile_id or not conversation_id or not conversation_token:
            raise AppException(
                status_code=409,
                code="SNAPCHAT_PROVIDER_ACCESS_REQUIRED",
                message="Snapchat message sync requires Public Profile Messaging allowlist access plus profile and conversation metadata.",
                details={"sync_status": "needs_provider_access"},
            )

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://businessapi.snapchat.com/v1/public_profiles/{profile_id}/group_conversation_messages",
                params={"conversation_id": conversation_id, "token": conversation_token, "limit": 50},
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="SNAPCHAT_SYNC_FAILED",
                message="Snapchat message sync failed.",
                details={"provider_status": response.status_code, "response": response.text[:300]},
            )
        payload = response.json()
        messages: list[NormalizedSocialMessage] = []
        for item in payload.get("group_conversation_messages") or []:
            message = item.get("group_conversation_message") or item
            message_id = message.get("message_id")
            text = message.get("text_message")
            if not message_id or not text:
                continue
            messages.append(
                NormalizedSocialMessage(
                    event_id=str(message_id),
                    contact_external_id=str(conversation_id),
                    content=str(text),
                    external_account_id=str(profile_id),
                    contact_name=metadata.get("snapchat_creator_name") or "Snapchat Creator",
                    raw_payload=item,
                )
            )
        return messages


class UnsupportedInboxAdapter(SocialProviderAdapter):
    def __init__(self, platform: str, reason: str = "needs_provider_access") -> None:
        self.platform = platform
        self.unsupported_reason = reason


class WhatsAppAdapter(MetaMessagingAdapter):
    platform = "whatsapp"


class FacebookMessengerAdapter(MetaMessagingAdapter):
    platform = "facebook_messenger"


class InstagramAdapter(MetaMessagingAdapter):
    platform = "instagram"


ADAPTERS: dict[str, SocialProviderAdapter] = {
    "facebook_messenger": FacebookMessengerAdapter(),
    "instagram": InstagramAdapter(),
    "whatsapp": WhatsAppAdapter(),
    "telegram": TelegramAdapter(),
    "google_business": UnsupportedInboxAdapter("google_business"),
    "linkedin": UnsupportedInboxAdapter("linkedin", "unsupported_by_provider"),
    "twitter_x": UnsupportedInboxAdapter("twitter_x", "needs_provider_access"),
    "snapchat": SnapchatAdapter(),
}


def get_social_provider_adapter(platform: str) -> SocialProviderAdapter:
    return ADAPTERS.get(platform, UnsupportedInboxAdapter(platform, "unsupported_by_provider"))
