from __future__ import annotations

import asyncio
import html as html_lib
import logging
import re
from datetime import date, datetime, timezone
from math import ceil

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.email_service import EmailService
from app.utils.helpers import serialize_mongo_document, utc_now

logger = logging.getLogger(__name__)


class BulkMessagingMixin:
    async def _resolve_bulk_sender(self, user_id: str, payload: dict) -> dict | None:
        """Resolve the From identity for an email blast.

        Returns None for SMS, or when the organization has no verified business
        domain yet — callers then fall back to the platform sender.
        """
        if payload.get("channel", "email") != "email":
            return None
        from app.services.email_domain import EmailDomainService

        return await EmailDomainService(self.db).resolve_sender(user_id, payload.get("from_prefix"))

    async def _resolve_org_sms_from_number(self, user_id: str) -> str | None:
        """Without this, every business's bulk SMS sent from one single global
        settings.TELNYX_PHONE_NUMBER regardless of which org's own number was actually
        provisioned/messaging-enabled -- send_sms's own settings.TELNYX_PHONE_NUMBER
        fallback only covers the platform default, not a business's own number (same
        resolution the voice call path already does via TelnyxWebVoiceService)."""
        from app.services.telnyx_provisioning_service import TelnyxProvisioningService

        organization_id = await self._resolve_organization_id(user_id)
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        return TelnyxProvisioningService.get_org_phone_number(org)

    @staticmethod
    def _delivery_error_text(exc: Exception) -> str:
        """AppException.__str__ only yields the generic message we wrote (e.g. "Telnyx
        could not send the SMS."), silently dropping the ``details`` payload that
        carries the provider's *actual* reason. A failed broadcast then showed the
        business nothing they could act on — the real cause (a rejected sender, a
        capability the number doesn't have, a malformed recipient) was only ever
        visible by reproducing the send by hand."""
        message = str(exc)
        details = getattr(exc, "details", None)
        provider_error = details.get("error") if isinstance(details, dict) else None
        if provider_error and str(provider_error) not in message:
            return f"{message} {provider_error}"
        return message

    @staticmethod
    def _fill_bulk_variables(text: str, recipient: dict, today_label: str) -> str:
        """{name}, {phone} and {date} - the composer promises them, so fill them per recipient."""
        raw = recipient.get("source") in {"raw_email", "raw_phone"}
        values = {
            "name": ("" if raw else (recipient.get("name") or "").strip()) or "there",
            "phone": recipient.get("phone") or "",
            "date": today_label,
        }
        return re.sub(r"\{(name|phone|date)\}", lambda match: values[match.group(1).lower()], text or "", flags=re.IGNORECASE)

    async def _bulk_today_label(self, user_id: str) -> str:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        zone_name = "America/Chicago"  # the zone the whole app displays
        try:
            organization_id = await self._resolve_organization_id(user_id)
            org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
            zone_name = ((org or {}).get("business_hours") or {}).get("timezone") or zone_name
            zone = ZoneInfo(zone_name)
        except (ZoneInfoNotFoundError, ValueError):
            zone = ZoneInfo("America/Chicago")
        return datetime.now(zone).strftime("%b %d, %Y")

    async def _dispatch_bulk_message(self, document: dict, recipients: list[dict] | None = None) -> dict:
        now = utc_now()
        # Recipients already recorded in document["deliveries"] (e.g. from a crashed
        # prior attempt resumed by recover_stranded_bulk_messages) must never be
        # resent - a process restart mid-batch used to lose this list entirely
        # because nothing was persisted until the very end (B09).
        already_sent_targets = {d["target"] for d in document.get("deliveries", []) if d.get("target")}
        pending_recipients = [
            recipient for recipient in (recipients if recipients is not None else document.get("recipients", []))
            if (recipient.get("email") if document["channel"] == "email" else recipient.get("phone")) not in already_sent_targets
        ]
        # Re-resolve at send time so scheduled blasts pick up a domain that
        # finished verifying after the message was drafted.
        sender = None
        sms_from_number = None
        if document.get("channel") == "email":
            try:
                sender = await self._resolve_bulk_sender(document["user_id"], document)
            except Exception:
                logger.warning("Could not resolve business sender for bulk message", exc_info=True)
            if not sender and document.get("from_email"):
                sender = {"email": document["from_email"], "name": document.get("from_name")}
        elif document.get("channel") == "sms":
            try:
                sms_from_number = await self._resolve_org_sms_from_number(document["user_id"])
            except Exception:
                logger.warning("Could not resolve business SMS from-number for bulk message", exc_info=True)
        today_label = await self._bulk_today_label(document["user_id"])
        semaphore = asyncio.Semaphore(8)  # a few at a time: hundreds of recipients must not take minutes

        async def deliver(recipient: dict) -> dict:
            target = recipient.get("email") if document["channel"] == "email" else recipient.get("phone")
            if not target:
                return {
                    "target": "",
                    "contact_id": recipient.get("id"),
                    "name": recipient.get("name"),
                    "status": "failed",
                    "error": "Recipient does not have a valid delivery target.",
                    "sent_at": None,
                }
            content = self._fill_bulk_variables(document["content"], recipient, today_label)
            status, error = "sent", None
            async with semaphore:
                try:
                    if document["channel"] == "email":
                        text_body = content
                        html_body = f"<p>{html_lib.escape(content).replace(chr(10), '<br>')}</p>"
                        attachments = document.get("attachments") or []
                        if attachments:
                            text_body += "\n\nAttachments:\n" + "\n".join(
                                f"- {attachment.get('label') or attachment.get('url')}: {attachment.get('url')}"
                                for attachment in attachments
                            )
                            html_body += "<p><strong>Attachments:</strong></p><ul>" + "".join(
                                f'<li><a href="{html_lib.escape(attachment.get("url") or "")}">{html_lib.escape(attachment.get("label") or attachment.get("url") or "")}</a></li>'
                                for attachment in attachments
                            ) + "</ul>"
                        await EmailService().send_business_email(
                            email=target,
                            subject=self._fill_bulk_variables(document.get("subject") or "GoCustify bulk message", recipient, today_label),
                            text=text_body,
                            html=html_body,
                            from_email=(sender or {}).get("email"),
                            from_name=(sender or {}).get("name"),
                            reply_to=(sender or {}).get("email"),
                            sender_provider=(sender or {}).get("provider"),
                            sender_user_id=document["user_id"],
                            db=self.db,
                        )
                    elif document["channel"] == "sms":
                        await self.call_service.send_sms(to_number=target, message=content, from_number=sms_from_number)
                    else:
                        status, error = "failed", f"Unsupported bulk channel: {document['channel']}"
                except Exception as exc:
                    status, error = "failed", self._delivery_error_text(exc)
            outcome = {
                "target": target,
                "contact_id": recipient.get("id"),
                "name": recipient.get("name"),
                "status": status,
                "error": error,
                "sent_at": now if status == "sent" else None,
            }
            # Persisted per-recipient, immediately - not batched into one final
            # write - so a mid-batch crash leaves a true record of who was already
            # messaged instead of losing the whole campaign's progress (B09).
            await self.db.bulk_messages.update_one(
                {"_id": document["_id"]},
                {
                    "$push": {"deliveries": outcome},
                    "$inc": {"sent_count" if status == "sent" else "failed_count": 1},
                    "$set": {"updated_at": utc_now()},
                },
            )
            return outcome

        await asyncio.gather(*(deliver(recipient) for recipient in pending_recipients))

        final_document = await self.db.bulk_messages.find_one({"_id": document["_id"]})
        sent_count = final_document.get("sent_count", 0)
        failed_count = final_document.get("failed_count", 0)

        final_status = "sent"
        if sent_count and failed_count:
            final_status = "partial_failed"
        elif failed_count and not sent_count:
            final_status = "failed"

        updated = await self.db.bulk_messages.find_one_and_update(
            {"_id": document["_id"]},
            {
                "$set": {
                    "status": final_status,
                    "sent_at": now if sent_count else None,
                    "updated_at": now,
                    "from_email": (sender or {}).get("email"),
                    "from_name": (sender or {}).get("name"),
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
            if channel == "email":
                target = (entry.get("email") or "").strip().lower()
                normalized_target = target
                entry["email"] = target or None
            else:
                target = self._normalize_phone_value(entry.get("phone"))
                normalized_target = target
                entry["phone"] = target or None
            if not normalized_target:
                if raw_key:
                    invalid_entries.append(raw_key)
                return
            if channel == "sms" and not self._is_valid_phone(normalized_target):
                invalid_entries.append(raw_key or normalized_target)
                return
            if normalized_target in seen_targets:
                duplicate_entries.append(raw_key or normalized_target)
                return
            seen_targets.add(normalized_target)
            recipients.append(entry)

        for raw_input in payload.get("recipient_emails", []):
            if not isinstance(raw_input, str):
                continue
            normalized = raw_input.strip()
            if not normalized:
                continue
            raw_seen_key = normalized.lower() if channel == "email" else self._normalize_phone_value(normalized)
            if not raw_seen_key:
                invalid_entries.append(normalized)
                continue
            if raw_seen_key in seen_raw_inputs:
                duplicate_entries.append(normalized)
                continue
            if channel == "email":
                normalized_email = normalized.lower()
                seen_raw_inputs.add(raw_seen_key)
                if not self._is_valid_email(normalized_email):
                    invalid_entries.append(normalized)
                    continue
                add_recipient(
                    {
                        "id": None,
                        "name": normalized_email,
                        "email": normalized_email,
                        "phone": None,
                        "avatar_url": None,
                        "initials": self._contact_initials(normalized_email),
                        "source": "raw_email",
                    },
                    raw_key=normalized_email,
                )
                continue

            normalized_phone = self._normalize_phone_value(normalized)
            seen_raw_inputs.add(raw_seen_key)
            if not self._is_valid_phone(normalized_phone):
                invalid_entries.append(normalized)
                continue
            add_recipient(
                {
                    "id": None,
                    "name": normalized_phone,
                    "email": None,
                    "phone": normalized_phone,
                    "avatar_url": None,
                    "initials": self._contact_initials(normalized_phone),
                    "source": "raw_phone",
                },
                raw_key=normalized_phone,
            )

        team_ids = await self._resolve_team_user_ids(user_id) if (payload.get("contact_ids") or payload.get("group_ids")) else [user_id]
        for contact_id in list(dict.fromkeys(payload.get("contact_ids", []))):
            if not ObjectId.is_valid(contact_id):
                unavailable_contact_ids.append(contact_id)
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": {"$in": team_ids}})
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
            group = await self.db.groups.find_one({"_id": ObjectId(group_id), "$or": [{"user_id": user_id}, {"member_ids": user_id}]})
            if not group:
                unavailable_group_ids.append(group_id)
                continue
            for member_id in group.get("member_ids", []):
                if not ObjectId.is_valid(member_id):
                    continue
                contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": {"$in": team_ids}})
                if contact:
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
                    continue
                # A group member isn't always a CRM contact - a colleague/team member
                # can be added to a group directly (same as _serialize_group_members
                # already handles for the group chat UI). Without this fallback, a
                # team-member group member was silently dropped from the recipient
                # list - no error, just fewer recipients than the group actually has.
                colleague = await self.db.users.find_one({"_id": ObjectId(member_id)})
                if not colleague or str(colleague["_id"]) not in team_ids:
                    continue
                colleague_name = colleague.get("full_name") or colleague.get("email")
                colleague_phone = colleague.get("phone_no") or colleague.get("phone_number")
                add_recipient(
                    {
                        "id": str(colleague["_id"]),
                        "name": colleague_name,
                        "email": colleague.get("email"),
                        "phone": colleague_phone,
                        "avatar_url": colleague.get("avatar_url"),
                        "initials": self._contact_initials(colleague_name),
                        "source": "group_member",
                    },
                    raw_key=(colleague.get("email") if channel == "email" else colleague_phone) or member_id,
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
            single, multi = (160, 153) if content.isascii() else (70, 67)
            return 1 if len(content) <= single else ceil(len(content) / multi)
        return 1

    @staticmethod
    def _is_valid_email(value: str) -> bool:
        return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))

    @staticmethod
    def _normalize_phone_value(value: str | None) -> str:
        if not isinstance(value, str):
            return ""
        cleaned = re.sub(r"[^\d+]", "", value.strip())
        if cleaned.count("+") > 1:
            return ""
        if "+" in cleaned and not cleaned.startswith("+"):
            return ""
        if cleaned.startswith("00"):
            cleaned = f"+{cleaned[2:]}"
        if cleaned and not cleaned.startswith("+"):
            cleaned = f"+{cleaned}"
        return cleaned

    def _is_valid_phone(self, value: str) -> bool:
        normalized = self._normalize_phone_value(value)
        return bool(re.fullmatch(r"\+[1-9]\d{7,14}", normalized))

