from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.helpers import utc_now


def graph_base() -> str:
    return f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}"


def _parse_timestamp(value: Any) -> datetime | None:
    # The gateway sends an ISO-8601 string over JSON, not a Python datetime - this
    # used to always fall through to utc_now(), silently discarding the real
    # message time a history import (or a delayed live delivery) needs.
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


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
    # "inbound" (a contact wrote in) or "outbound" (sent from the connected account
    # itself, e.g. directly from a linked WhatsApp phone rather than through this app).
    direction: str = "inbound"

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
            "direction": self.direction,
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
                timestamp=_parse_timestamp(payload.get("timestamp")),
                external_account_id=payload.get("external_account_id"),
                contact_name=payload.get("contact_name"),
                raw_payload=payload.get("raw_payload") or payload,
                direction=payload.get("direction") if payload.get("direction") in ("inbound", "outbound") else "inbound",
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

    async def fetch_account_metadata(self, access_token: str | None, token_data: dict[str, Any]) -> dict[str, Any]:
        """Fetch the connected Page/Account ID from Graph API so webhook resolution works."""
        if not access_token:
            return {"external_account_id": None, "external_account_name": None}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{graph_base()}/me/accounts",
                    params={"access_token": access_token, "fields": "id,name"},
                )
            if response.status_code == 200:
                data = response.json()
                pages = data.get("data") or []
                if pages:
                    return {"external_account_id": pages[0]["id"], "external_account_name": pages[0].get("name")}
            # Fallback: use /me
            async with httpx.AsyncClient(timeout=15.0) as client:
                me = await client.get(
                    f"{graph_base()}/me",
                    params={"access_token": access_token, "fields": "id,name"},
                )
            if me.status_code == 200:
                me_data = me.json()
                return {"external_account_id": me_data.get("id"), "external_account_name": me_data.get("name")}
        except Exception:
            pass
        return {"external_account_id": None, "external_account_name": None}

    async def connect_messenger(self, user_access_token: str) -> dict[str, Any]:
        """Turn the short-lived *user* token from OAuth into what Messenger actually needs.

        The Send API requires a **Page** access token, and a Page must be subscribed to
        this app's webhook (POST /{page-id}/subscribed_apps) before Meta sends it any
        events. Page tokens derived from a long-lived user token don't expire, so the
        user token is exchanged first."""
        base = graph_base()
        async with httpx.AsyncClient(timeout=20.0) as client:
            long_lived = user_access_token
            exchange = await client.get(
                f"{base}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.META_CLIENT_ID,
                    "client_secret": settings.META_CLIENT_SECRET,
                    "fb_exchange_token": user_access_token,
                },
            )
            if exchange.status_code == 200 and exchange.json().get("access_token"):
                long_lived = exchange.json()["access_token"]

            pages_response = await client.get(
                f"{base}/me/accounts", params={"access_token": long_lived, "fields": "id,name,access_token"}
            )
            pages = (pages_response.json().get("data") or []) if pages_response.status_code == 200 else []
            pages = [p for p in pages if p.get("id") and p.get("access_token")]
            if not pages:
                raise AppException(
                    status_code=400,
                    code="META_NO_PAGES",
                    message="No Facebook Page with messaging access was found. Connect again and grant access to a Page.",
                )

            # The first Page is used; the others are listed (never their tokens) so a
            # Page picker can be added without re-running OAuth.
            page = pages[0]
            subscribed = await client.post(
                f"{base}/{page['id']}/subscribed_apps",
                params={"subscribed_fields": "messages,message_echoes", "access_token": page["access_token"]},
            )

        return {
            "access_token": page["access_token"],
            "external_account_id": str(page["id"]),
            "external_account_name": page.get("name"),
            "provider_metadata": {
                "pages": [{"id": str(p["id"]), "name": p.get("name")} for p in pages],
                "webhook_subscribed": subscribed.status_code < 400,
                "graph_version": settings.META_GRAPH_VERSION,
            },
        }

    # Meta sends media as typed attachments/messages with URLs that expire, so (like the
    # WhatsApp gateway) a media message becomes a readable placeholder plus any caption.
    _MESSAGING_ATTACHMENT_LABELS = {
        "image": "Image",
        "audio": "Voice message",
        "video": "Video",
        "file": "File",
        "location": "Location",
        "share": "Shared post",
        "story_mention": "Story mention",
        "ig_reel": "Reel",
    }
    _WHATSAPP_MEDIA_LABELS = {
        "image": "Image",
        "video": "Video",
        "audio": "Voice message",
        "document": "Document",
        "sticker": "Sticker",
        "location": "Location",
        "contacts": "Contact",
    }

    @staticmethod
    def _epoch_to_datetime(value: Any, *, milliseconds: bool) -> datetime | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if number <= 0:
            return None
        return datetime.fromtimestamp(number / 1000 if milliseconds else number, tz=timezone.utc)

    def normalize_webhook(self, payload: dict[str, Any]) -> NormalizedSocialMessage | None:
        events = self.normalize_webhook_events(payload)
        return events[0] if events else None

    def normalize_webhook_events(self, payload: dict[str, Any]) -> list[NormalizedSocialMessage]:
        """Every message event in a Meta webhook delivery (Messenger, Instagram or WhatsApp
        Cloud API). One delivery can carry several entries and several events; receipts,
        reads, postbacks and other non-message events are skipped, not errors - Meta
        expects a 200 for all of them."""
        flat = SocialProviderAdapter.normalize_webhook(self, payload)  # gateway/test flat shape
        if flat:
            return [flat]

        events: list[NormalizedSocialMessage] = []
        for entry in payload.get("entry") or []:
            if not isinstance(entry, dict):
                continue
            account_id = str(entry["id"]) if entry.get("id") else None

            # Messenger / Instagram
            for item in entry.get("messaging") or []:
                event = self._messaging_event(item, account_id)
                if event:
                    events.append(event)

            # WhatsApp Cloud API
            for change in entry.get("changes") or []:
                value = (change or {}).get("value") or {}
                phone_number_id = (value.get("metadata") or {}).get("phone_number_id") or account_id
                names = {
                    contact.get("wa_id"): (contact.get("profile") or {}).get("name")
                    for contact in value.get("contacts") or []
                    if isinstance(contact, dict)
                }
                for message in value.get("messages") or []:
                    event = self._whatsapp_event(message, phone_number_id, names, payload)
                    if event:
                        events.append(event)
        return events

    def _messaging_event(self, item: Any, account_id: str | None) -> NormalizedSocialMessage | None:
        if not isinstance(item, dict):
            return None
        message = item.get("message")
        if not isinstance(message, dict):
            return None  # delivery / read / postback / referral - nothing to store
        if message.get("is_self"):
            return None
        mid = message.get("mid")
        sender = (item.get("sender") or {}).get("id")
        recipient = (item.get("recipient") or {}).get("id")
        is_echo = bool(message.get("is_echo"))
        contact = recipient if is_echo else sender
        if not mid or not contact:
            return None

        text = (message.get("text") or "").strip()
        attachments = [a for a in (message.get("attachments") or []) if isinstance(a, dict)]
        media_url = None
        if attachments:
            label = self._MESSAGING_ATTACHMENT_LABELS.get(attachments[0].get("type"), "Attachment")
            placeholder = f"[{label}]"
            text = f"{placeholder} {text}".strip()
            media_url = (attachments[0].get("payload") or {}).get("url")
        if not text:
            return None

        return NormalizedSocialMessage(
            event_id=str(mid),
            contact_external_id=str(contact),
            content=text,
            media_url=media_url,
            timestamp=self._epoch_to_datetime(item.get("timestamp"), milliseconds=True),
            external_account_id=account_id,
            raw_payload=item,
            direction="outbound" if is_echo else "inbound",
        )

    def _whatsapp_event(
        self, message: Any, phone_number_id: str | None, names: dict, payload: dict[str, Any]
    ) -> NormalizedSocialMessage | None:
        if not isinstance(message, dict):
            return None
        message_id = message.get("id")
        sender = message.get("from")
        if not message_id or not sender:
            return None

        kind = message.get("type")
        if kind == "text":
            text = ((message.get("text") or {}).get("body") or "").strip()
        elif kind in ("button", "interactive"):
            reply = message.get("button") or message.get("interactive") or {}
            text = (
                reply.get("text")
                or (reply.get("button_reply") or {}).get("title")
                or (reply.get("list_reply") or {}).get("title")
                or ""
            ).strip()
        else:
            label = self._WHATSAPP_MEDIA_LABELS.get(kind)
            if not label:
                return None  # reactions, unsupported, system, ... nothing worth storing
            caption = ((message.get(kind) or {}).get("caption") or "").strip() if isinstance(message.get(kind), dict) else ""
            text = f"[{label}] {caption}".strip()
        if not text:
            return None

        return NormalizedSocialMessage(
            event_id=str(message_id),
            contact_external_id=str(sender),
            content=text,
            timestamp=self._epoch_to_datetime(message.get("timestamp"), milliseconds=False),
            external_account_id=str(phone_number_id) if phone_number_id else None,
            contact_name=names.get(sender),
            raw_payload=payload,
        )


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

    async def connect_cloud_api(self, user_access_token: str) -> dict[str, Any]:
        """Find what the official WhatsApp Business Platform actually needs after OAuth: the
        business's WhatsApp Business Account (WABA) and a phone number id (Pages, which the
        generic Meta lookup returns, are irrelevant here), then subscribe the WABA so Meta
        starts delivering its messages to our webhook."""
        base = graph_base()
        async with httpx.AsyncClient(timeout=20.0) as client:
            token = user_access_token
            exchange = await client.get(
                f"{base}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.META_CLIENT_ID,
                    "client_secret": settings.META_CLIENT_SECRET,
                    "fb_exchange_token": user_access_token,
                },
            )
            if exchange.status_code == 200 and exchange.json().get("access_token"):
                token = exchange.json()["access_token"]

            # Which WABA(s) did the user grant? debug_token lists them as the target_ids of the
            # whatsapp_business_* granular scopes.
            debug = await client.get(
                f"{base}/debug_token",
                params={"input_token": token, "access_token": f"{settings.META_CLIENT_ID}|{settings.META_CLIENT_SECRET}"},
            )
            scopes = ((debug.json().get("data") or {}).get("granular_scopes") or []) if debug.status_code == 200 else []
            waba_ids: list[str] = []
            for scope in scopes:
                if scope.get("scope") in ("whatsapp_business_management", "whatsapp_business_messaging"):
                    for target in scope.get("target_ids") or []:
                        if str(target) not in waba_ids:
                            waba_ids.append(str(target))
            if not waba_ids:
                raise AppException(
                    status_code=400,
                    code="META_NO_WABA",
                    message="No WhatsApp Business Account was granted. Connect again and select a WhatsApp Business Account.",
                )

            waba_id = waba_ids[0]
            phones_response = await client.get(
                f"{base}/{waba_id}/phone_numbers",
                params={"fields": "id,display_phone_number,verified_name", "access_token": token},
            )
            phones = (phones_response.json().get("data") or []) if phones_response.status_code == 200 else []
            if not phones:
                raise AppException(
                    status_code=400,
                    code="META_NO_PHONE_NUMBER",
                    message="That WhatsApp Business Account has no phone number yet. Add one in WhatsApp Manager, then connect again.",
                )
            phone = phones[0]

            subscribed = await client.post(f"{base}/{waba_id}/subscribed_apps", params={"access_token": token})

        return {
            "access_token": token,
            "external_account_id": str(phone["id"]),  # webhooks name the number by phone_number_id
            "external_account_name": phone.get("verified_name") or phone.get("display_phone_number"),
            "provider_metadata": {
                "waba_id": waba_id,
                "waba_ids": waba_ids,
                "phone_number_id": str(phone["id"]),
                "display_phone_number": phone.get("display_phone_number"),
                "webhook_subscribed": subscribed.status_code < 400,
                "graph_version": settings.META_GRAPH_VERSION,
            },
        }


class FacebookMessengerAdapter(MetaMessagingAdapter):
    platform = "facebook_messenger"


def instagram_graph_base() -> str:
    return f"https://graph.instagram.com/{settings.META_GRAPH_VERSION}"


class InstagramAdapter(MetaMessagingAdapter):
    platform = "instagram"

    async def connect_instagram(self, short_lived_token: str, token_data: dict[str, Any]) -> dict[str, Any]:
        """Instagram Login hands back a short-lived (1h) token. Exchange it for a 60-day one,
        look up the professional account (its id is what webhook entries carry), and
        subscribe the account to message webhooks."""
        async with httpx.AsyncClient(timeout=20.0) as client:
            exchange = await client.get(
                "https://graph.instagram.com/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": settings.INSTAGRAM_APP_SECRET,
                    "access_token": short_lived_token,
                },
            )
            if exchange.status_code != 200 or not exchange.json().get("access_token"):
                raise AppException(
                    status_code=502,
                    code="INSTAGRAM_TOKEN_EXCHANGE_FAILED",
                    message="Instagram did not return a long-lived token. Please connect again.",
                )
            long_lived = exchange.json()
            token = long_lived["access_token"]

            me = await client.get(
                f"{instagram_graph_base()}/me", params={"fields": "user_id,username,name", "access_token": token}
            )
            profile = me.json() if me.status_code == 200 else {}
            account_id = profile.get("user_id") or token_data.get("user_id")
            if not account_id:
                raise AppException(
                    status_code=502,
                    code="INSTAGRAM_ACCOUNT_LOOKUP_FAILED",
                    message="Could not identify the Instagram professional account. Please connect again.",
                )

            subscribed = await client.post(
                f"{instagram_graph_base()}/me/subscribed_apps",
                params={"subscribed_fields": "messages", "access_token": token},
            )

        return {
            "access_token": token,
            "expires_in": long_lived.get("expires_in"),
            "external_account_id": str(account_id),
            "external_account_name": profile.get("username") or profile.get("name"),
            "provider_metadata": {
                "username": profile.get("username"),
                "webhook_subscribed": subscribed.status_code < 400,
                "graph_version": settings.META_GRAPH_VERSION,
            },
        }

    async def refresh_token(self, access_token: str) -> dict[str, Any] | None:
        """Long-lived Instagram tokens last 60 days and can be refreshed once they are at
        least 24 hours old; a token that lapses can never be refreshed."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://graph.instagram.com/refresh_access_token",
                params={"grant_type": "ig_refresh_token", "access_token": access_token},
            )
        if response.status_code != 200 or not response.json().get("access_token"):
            return None
        return response.json()


class ThreadsAdapter(SocialProviderAdapter):
    platform = "threads"
    supports_webhooks = False
    supports_recent_sync = False
    unsupported_reason = "unsupported_by_provider"


ADAPTERS: dict[str, SocialProviderAdapter] = {
    "facebook_messenger": FacebookMessengerAdapter(),
    "instagram": InstagramAdapter(),
    "whatsapp": WhatsAppAdapter(),
    "telegram": TelegramAdapter(),
    "google_business": UnsupportedInboxAdapter("google_business"),
    "zoom": UnsupportedInboxAdapter("zoom"),
    "zoho": UnsupportedInboxAdapter("zoho"),
    "linkedin": UnsupportedInboxAdapter("linkedin", "unsupported_by_provider"),
    "twitter_x": UnsupportedInboxAdapter("twitter_x", "needs_provider_access"),
    "snapchat": SnapchatAdapter(),
    "threads": ThreadsAdapter(),
}


def get_social_provider_adapter(platform: str) -> SocialProviderAdapter:
    return ADAPTERS.get(platform, UnsupportedInboxAdapter(platform, "unsupported_by_provider"))
