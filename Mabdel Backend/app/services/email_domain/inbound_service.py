"""Ingest inbound email from Resend into Unified Conversations.

Resend delivers an ``email.received`` webhook for every message sent to a
verified domain (catch-all: any local part). We resolve the recipient domain
back to its organization, upsert a contact for the sender, and drop the message
into the same ``platform="email"`` conversation stream the inbox already
renders — so a reply to ``market@dentist.gocustify.com`` shows up next to the
WhatsApp and Telegram threads with no extra client work.

Important: the webhook payload carries **metadata only** — no body, headers or
attachment content. The body is fetched with ``GET /emails/receiving/{id}`` and
each attachment's ``download_url`` is a short-lived signed link, so we download
and re-store attachments in our own media storage instead of linking to it.
"""

from __future__ import annotations

import asyncio
import logging
import re
from email.utils import parseaddr

import httpx
import resend

from app.core.config import settings
from app.services.smartflow_service import SmartFlowService
from app.utils.helpers import utc_now

from .email_domain_service import EmailDomainService

logger = logging.getLogger(__name__)

# Guard rails for untrusted inbound mail.
MAX_INBOUND_ATTACHMENTS = 10

_HTML_TAG_RE = re.compile(r"<[^>]+>")
# Trim quoted history so the inbox shows the actual reply, not the whole thread.
_REPLY_SPLIT_RE = re.compile(
    r"\n\s*(?:>{1,}\s|-{2,}\s*Original Message\s*-{2,}|On .{0,120}\bwrote:)",
    re.IGNORECASE,
)
MAX_INBOUND_CONTENT = 10000


class InboundEmailService:
    def __init__(self, db) -> None:
        self.db = db
        self.domains = EmailDomainService(db)
        self.smartflow = SmartFlowService(db)

    async def handle_event(self, event: dict) -> dict:
        event_type = (event.get("type") or "").strip().lower()
        if event_type != "email.received":
            return {"status": "ignored", "reason": "unsupported_event_type"}

        data = event.get("data") or {}
        parsed = self._parse_payload(data)
        if not parsed["from_email"]:
            return {"status": "ignored", "reason": "missing_sender"}

        record = await self._resolve_recipient_domain(parsed["to_addresses"])
        if not record:
            return {"status": "ignored", "reason": "unknown_recipient_domain"}

        owner_id = record["user_id"]
        event_id = parsed["event_id"]

        if await self._is_duplicate(owner_id, event_id):
            return {"status": "ignored", "reason": "duplicate_event"}

        # The webhook has no body, so pull the full message before building content.
        full = await self._fetch_received_email(parsed["event_id"])
        if full:
            parsed = self._merge_full_email(parsed, full)

        contact = await self._upsert_contact(owner_id, parsed["from_email"], parsed["from_name"])
        conversation = await self._upsert_conversation(owner_id, contact, parsed["from_email"])

        attachments = await self._store_attachments(owner_id, parsed["event_id"], parsed["attachments"])
        content = parsed["content"] or "(no content)"
        message = await self.smartflow.create_message(
            owner_id,
            {
                "conversation_id": str(conversation["_id"]),
                "contact_id": str(contact["_id"]),
                "platform": "email",
                "direction": "inbound",
                "content": content,
                "media_url": None,
                "attachments": attachments,
                "reply_to_message_id": None,
                "forward_from_message_id": None,
                "provider_event_id": event_id,
                "provider_message_id": parsed["provider_message_id"] or event_id,
                "external_account_id": parsed["recipient"],
            },
        )

        await self.smartflow.create_notification(
            user_id=owner_id,
            notification_type="message",
            title=parsed["subject"] or f"New email from {parsed['from_email']}",
            body=content[:200],
        )
        return {"status": "processed", "message": message}

    # ── full message retrieval ────────────────────────────────────────────

    async def _fetch_received_email(self, email_id: str) -> dict | None:
        """Pull body/headers/attachment metadata, which the webhook omits."""
        if not email_id or not settings.RESEND_API_KEY:
            return None
        try:
            return await asyncio.to_thread(self._fetch_received_email_sync, email_id)
        except Exception:
            # Fall back to whatever the webhook gave us rather than losing the mail.
            logger.warning("Could not fetch received email %s from Resend", email_id, exc_info=True)
            return None

    @staticmethod
    def _fetch_received_email_sync(email_id: str) -> dict:
        resend.api_key = settings.RESEND_API_KEY
        return resend.EmailsReceiving.get(email_id)

    def _merge_full_email(self, parsed: dict, full: dict) -> dict:
        """Overlay the fetched message onto the webhook-derived fields."""
        merged = dict(parsed)
        subject = (full.get("subject") or parsed["subject"] or "").strip()
        merged["subject"] = subject
        merged["content"] = self._extract_content(full, subject) or parsed["content"]
        merged["attachments"] = self._extract_attachments(full.get("attachments"))
        merged["provider_message_id"] = str(full.get("message_id") or parsed["provider_message_id"] or "") or None

        if not merged["from_email"]:
            _, from_email = parseaddr(self._first_str(full.get("from")))
            merged["from_email"] = (from_email or "").strip().lower()
        return merged

    async def _store_attachments(self, owner_id: str, email_id: str, attachments: list[dict]) -> list[dict]:
        """Re-host attachments — Resend's download_url expires."""
        if not attachments or not settings.RESEND_API_KEY:
            return []

        stored: list[dict] = []
        for attachment in attachments[:MAX_INBOUND_ATTACHMENTS]:
            attachment_id = attachment.get("provider_attachment_id")
            if not attachment_id:
                continue
            try:
                details = await asyncio.to_thread(
                    self._fetch_attachment_sync, email_id, attachment_id
                )
                download_url = details.get("download_url")
                if not download_url:
                    continue
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                    response = await client.get(download_url)
                    response.raise_for_status()
                    payload = response.content

                saved = self.smartflow.media_storage.store_file(
                    owner_id=owner_id,
                    folder="inbound_email_attachments",
                    file_bytes=payload,
                    content_type=details.get("content_type") or attachment.get("mime_type"),
                    filename=details.get("filename") or attachment.get("file_name"),
                    label="Email attachment",
                )
            except Exception:
                # One bad attachment must not drop the whole message.
                logger.warning(
                    "Could not store inbound attachment %s of email %s",
                    attachment_id,
                    email_id,
                    exc_info=True,
                )
                continue

            stored.append(
                {
                    "type": self.smartflow._guess_attachment_type(saved.url, saved.content_type),
                    "url": saved.url,
                    "file_name": details.get("filename") or attachment.get("file_name") or "attachment",
                    "mime_type": saved.content_type,
                    "file_size_bytes": saved.size_bytes,
                    "thumbnail_url": None,
                }
            )
        return stored

    @staticmethod
    def _fetch_attachment_sync(email_id: str, attachment_id: str) -> dict:
        resend.api_key = settings.RESEND_API_KEY
        return resend.EmailsReceiving.Attachments.get(email_id, attachment_id)

    # ── routing ───────────────────────────────────────────────────────────

    async def _resolve_recipient_domain(self, to_addresses: list[str]) -> dict | None:
        """Match any recipient against the verified domains we host."""
        for address in to_addresses:
            domain = address.rsplit("@", 1)[-1].strip().lower()
            if not domain:
                continue
            record = await self.domains.resolve_domain_record(domain)
            if record and record.get("inbound_enabled", True):
                return {**record, "user_id": record["user_id"], "matched_address": address}
        return None

    async def _is_duplicate(self, owner_id: str, event_id: str) -> bool:
        existing = await self.db.processed_webhooks.find_one(
            {"platform": "email", "event_id": event_id, "user_id": owner_id}
        )
        if existing:
            return True
        try:
            await self.db.processed_webhooks.insert_one(
                {
                    "platform": "email",
                    "event_id": event_id,
                    "user_id": owner_id,
                    "created_at": utc_now(),
                }
            )
        except Exception:
            return True
        return False

    # ── contact / conversation upsert ─────────────────────────────────────

    async def _upsert_contact(self, owner_id: str, from_email: str, from_name: str | None) -> dict:
        contact = await self.db.contacts.find_one(
            {"user_id": owner_id, "email": from_email}
        )
        if contact:
            return contact

        contact = await self.db.contacts.find_one(
            {
                "user_id": owner_id,
                "identities": {"$elemMatch": {"platform": "email", "external_id": from_email}},
            }
        )
        if contact:
            return contact

        now = utc_now()
        contact = {
            "user_id": owner_id,
            "name": from_name or from_email.split("@")[0],
            "email": from_email,
            "phone": None,
            "avatar_url": None,
            "identities": [{"platform": "email", "external_id": from_email, "handle": from_email}],
            "presence": "offline",
            "created_at": now,
            "updated_at": now,
        }
        insert = await self.db.contacts.insert_one(contact)
        contact["_id"] = insert.inserted_id
        return contact

    async def _upsert_conversation(self, owner_id: str, contact: dict, from_email: str) -> dict:
        conversation = await self.db.conversations.find_one(
            {"user_id": owner_id, "contact_id": str(contact["_id"]), "platform": "email"}
        )
        if conversation:
            return conversation

        now = utc_now()
        conversation = {
            "user_id": owner_id,
            "title": contact.get("name") or from_email,
            "contact_id": str(contact["_id"]),
            "type": "direct",
            "platform": "email",
            "member_ids": [owner_id],
            "archived": False,
            "created_at": now,
            "updated_at": now,
        }
        insert = await self.db.conversations.insert_one(conversation)
        conversation["_id"] = insert.inserted_id
        return conversation

    # ── payload parsing ───────────────────────────────────────────────────

    def _parse_payload(self, data: dict) -> dict:
        from_name, from_email = parseaddr(self._first_str(data.get("from")))
        to_addresses = self._extract_addresses(data.get("to"))
        # Resend has used both `email_id` and `id` across API revisions.
        event_id = str(
            data.get("email_id")
            or data.get("id")
            or data.get("message_id")
            or f"{from_email}:{data.get('created_at') or utc_now().isoformat()}"
        )
        subject = (data.get("subject") or "").strip()
        content = self._extract_content(data, subject)

        return {
            "event_id": event_id,
            "provider_message_id": str(data.get("message_id") or data.get("email_id") or "") or None,
            "from_email": (from_email or "").strip().lower(),
            "from_name": (from_name or "").strip() or None,
            "to_addresses": to_addresses,
            "recipient": to_addresses[0] if to_addresses else None,
            "subject": subject,
            "content": content,
            "attachments": self._extract_attachments(data.get("attachments")),
        }

    def _extract_content(self, data: dict, subject: str) -> str:
        body = (data.get("text") or "").strip()
        if not body and data.get("html"):
            body = self._html_to_text(data["html"])
        body = _REPLY_SPLIT_RE.split(body, maxsplit=1)[0].strip() if body else ""
        if subject and body:
            return f"{subject}\n\n{body}"[:MAX_INBOUND_CONTENT]
        return (body or subject)[:MAX_INBOUND_CONTENT]

    @staticmethod
    def _html_to_text(html: str) -> str:
        import html as html_lib  # noqa: PLC0415

        text = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
        text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>", "\n", text)
        text = _HTML_TAG_RE.sub(" ", text)
        text = html_lib.unescape(text)
        text = re.sub(r"[ \t\r\f\v]+", " ", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    @staticmethod
    def _first_str(value) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, list) and value:
            first = value[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return first.get("address") or first.get("email") or ""
        if isinstance(value, dict):
            return value.get("address") or value.get("email") or ""
        return ""

    @classmethod
    def _extract_addresses(cls, value) -> list[str]:
        raw: list[str] = []
        if isinstance(value, str):
            raw = [part for part in value.split(",")]
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str):
                    raw.extend(item.split(","))
                elif isinstance(item, dict):
                    candidate = item.get("address") or item.get("email")
                    if candidate:
                        raw.append(candidate)
        elif isinstance(value, dict):
            candidate = value.get("address") or value.get("email")
            if candidate:
                raw.append(candidate)

        addresses = []
        for entry in raw:
            _, email = parseaddr(entry.strip())
            email = (email or "").strip().lower()
            if email and email not in addresses:
                addresses.append(email)
        return addresses

    @staticmethod
    def _extract_attachments(value) -> list[dict]:
        """Collect attachment *references*. Content is downloaded separately."""
        if not isinstance(value, list):
            return []
        attachments = []
        for item in value:
            if not isinstance(item, dict):
                continue
            attachment_id = item.get("id")
            if not attachment_id:
                continue
            attachments.append(
                {
                    "provider_attachment_id": str(attachment_id),
                    "file_name": item.get("filename") or item.get("name") or "attachment",
                    "mime_type": item.get("content_type") or item.get("contentType"),
                    "file_size_bytes": item.get("size"),
                }
            )
        return attachments
