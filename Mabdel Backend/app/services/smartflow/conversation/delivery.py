from __future__ import annotations

import logging
import html as html_lib
from bson import ObjectId
import httpx
from pymongo import ReturnDocument
from datetime import timedelta
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.realtime import conversation_realtime_hub
from app.services.email_service import EmailService
from app.utils.helpers import utc_now

logger = logging.getLogger(__name__)


class ConversationDeliveryMixin:
    # ------------------------------------------------------------------
    # Outbound message delivery
    # ------------------------------------------------------------------

    async def _deliver_outbound(
        self, user_id: str, platform: str, contact_id: str | None, content: str, errors: list[str] | None = None,
        receipt: dict | None = None,
        conversation_id: str | None = None,
    ) -> bool:
        """Send message to the actual platform. Returns True if delivered, False if failed/skipped.
        When a provider explains a failure, the reason is appended to ``errors``."""
        errors = errors if errors is not None else []
        if platform in {"ai", "internal"}:
            return True  # no external delivery needed

        if platform == "sms":
            return await self._deliver_sms(user_id, contact_id, content, errors, receipt, conversation_id)

        if platform == "email":
            delivered = await self._deliver_email(user_id, contact_id, content, conversation_id)
            if not delivered:
                errors.append("The email could not be sent - check that your business email domain is verified.")
            return delivered

        contact_external_id = await self._get_contact_external_id(user_id, platform, contact_id)
        if not contact_external_id:
            errors.append(f"This contact has no {self._platform_label(platform)} address to reply to.")
            return False

        # The channel is connected once per organization; whoever connected it, any
        # teammate replying from the shared inbox goes out through it.
        integration = await self.db.social_integrations.find_one(
            {"user_id": user_id, "platform": platform, "status": "connected"}
        ) or await self.db.social_integrations.find_one(
            {"user_id": {"$in": await self._resolve_team_user_ids(user_id)}, "platform": platform, "status": "connected"}
        )
        if not integration:
            errors.append(f"{self._platform_label(platform)} is not connected - connect it in Integrations.")
            return False

        from app.core.crypto import decrypt_value
        access_token = decrypt_value(integration["access_token_encrypted"]) if integration.get("access_token_encrypted") else None

        try:
            if platform == "facebook_messenger":
                return await self._deliver_meta_messenger(integration, access_token, contact_external_id, content, errors)
            elif platform == "instagram":
                return await self._deliver_instagram(integration, access_token, contact_external_id, content, errors)
            elif platform == "whatsapp":
                return await self._deliver_whatsapp(integration, access_token, contact_external_id, content, errors, receipt)
            elif platform == "telegram":
                delivered = await self._deliver_telegram(access_token, contact_external_id, content)
                if not delivered:
                    errors.append("Telegram rejected the message.")
                return delivered
            else:
                errors.append(f"Replying on {self._platform_label(platform)} from GoCustify isn't supported yet.")
                return False
        except httpx.HTTPError:
            errors.append(f"Couldn't reach {self._platform_label(platform)} - try again in a moment.")
            return False

    async def _deliver_sms(
        self, user_id: str, contact_id: str | None, content: str, errors: list[str], receipt: dict | None,
        conversation_id: str | None = None,
    ) -> bool:
        """Reply by SMS from the business's own Telnyx number."""
        from app.services.call_service import CallService
        from app.services.telnyx_provisioning_service import TelnyxProvisioningService

        to_number = await self._get_contact_external_id(user_id, "sms", contact_id)
        if not to_number and contact_id and ObjectId.is_valid(contact_id):
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id)}, {"phone": 1})
            to_number = (contact or {}).get("phone")
        if not to_number and conversation_id:
            conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
            to_number = conversation.get("external_phone")
        if not to_number:
            errors.append("This contact has no phone number to text.")
            return False
        organization_id = await self._resolve_organization_id(user_id)
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        from_number = TelnyxProvisioningService.get_org_phone_number(org) if org else None
        if not from_number:
            errors.append("Your business has no SMS number yet - set one up under AI Calling.")
            return False
        try:
            response = await CallService().send_sms(to_number=to_number, message=content, from_number=from_number)
        except AppException as exc:
            errors.append(f"SMS could not be sent: {exc.message}")
            return False
        provider_id = ((response or {}).get("data") or {}).get("id") or (response or {}).get("id")
        if provider_id and receipt is not None:
            receipt["provider_message_id"] = str(provider_id)
        return True

    async def _deliver_email(self, user_id: str, contact_id: str | None, content: str, conversation_id: str | None = None) -> bool:
        """Reply to an email thread from the owner's verified business domain."""
        if not contact_id or not ObjectId.is_valid(contact_id):
            return False
        contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
        if not contact:
            return False

        target = contact.get("email")
        if not target:
            for identity in contact.get("identities", []):
                if identity.get("platform") == "email":
                    target = identity.get("external_id")
                    break
        if not target:
            return False

        from app.services.email_domain import EmailDomainService

        # Reply as the thread: same subject, same address the customer wrote to, and the
        # In-Reply-To/References headers mail clients use to group a conversation.
        last_inbound = None
        references: list[str] = []
        if conversation_id:
            async for earlier in self.db.messages.find(
                {"conversation_id": conversation_id, "platform": "email"}
            ).sort("timestamp", -1).limit(20):
                meta = earlier.get("provider_metadata") or {}
                if earlier.get("direction") == "inbound" and last_inbound is None:
                    last_inbound = earlier
                if meta.get("message_id"):
                    references.insert(0, meta["message_id"])
        last_meta = (last_inbound or {}).get("provider_metadata") or {}
        written_to = str(last_meta.get("email_to") or "")
        prefix = written_to.split("@")[0] if "@" in written_to else None

        sender = await EmailDomainService(self.db).resolve_sender(user_id, prefix)
        if not sender:
            # Without a verified domain, replies would come from the platform
            # address and break the thread — surface as failed instead.
            logger.warning("No verified business email domain for user %s; email reply not sent.", user_id)
            return False

        original_subject = ((last_inbound or {}).get("subject") or "").strip()
        if original_subject:
            subject = original_subject if original_subject.lower().startswith("re:") else f"Re: {original_subject}"
        else:
            subject = f"Re: {contact.get('name') or 'your message'}"
        headers = {}
        if last_meta.get("message_id"):
            headers["In-Reply-To"] = last_meta["message_id"]
            headers["References"] = " ".join(dict.fromkeys(references[-10:] or [last_meta["message_id"]]))
        try:
            await EmailService().send_business_email(
                email=target,
                subject=subject,
                text=content,
                html=f"<p>{html_lib.escape(content).replace(chr(10), '<br/>')}</p>",
                from_email=sender["email"],
                from_name=sender.get("name"),
                reply_to=sender["email"],
                headers=headers or None,
                sender_provider=sender.get("provider"),
                sender_user_id=user_id,
                db=self.db,
            )
        except Exception:
            logger.exception("Email reply delivery failed for user %s", user_id)
            return False
        return True

    @staticmethod
    def _graph_failure_reason(resp: httpx.Response) -> str:
        """A readable reason for a rejected Meta send, so the user isn't left guessing why
        a reply shows as failed."""
        try:
            error = (resp.json() or {}).get("error") or {}
        except Exception:
            error = {}
        code = error.get("code")
        subcode = error.get("error_subcode")
        message = str(error.get("message") or "")
        if code in (10, 131047) or subcode in (2018278, 1545041, 2534022) or "window" in message.lower() or "re-engage" in message.lower():
            return "The 24-hour reply window has closed - the customer has to message first."
        if code in (102, 190) or error.get("type") == "OAuthException" and "token" in message.lower():
            return "The Meta connection expired - reconnect it in Integrations."
        return f"Meta rejected the message: {message[:200] or resp.status_code}"

    async def _deliver_meta_messenger(
        self, integration: dict, access_token: str | None, recipient_id: str, content: str, errors: list[str]
    ) -> bool:
        page_id = integration.get("external_account_id")
        if not access_token or not page_id:
            errors.append("Messenger is not fully connected - reconnect it in Integrations.")
            return False
        # Send API: POST /<PAGE_ID>/messages with a *Page* access token and an explicit
        # messaging_type (RESPONSE = a reply inside the 24-hour window).
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/{page_id}/messages",
                json={"recipient": {"id": recipient_id}, "messaging_type": "RESPONSE", "message": {"text": content}},
                params={"access_token": access_token},
            )
        if resp.status_code >= 400:
            errors.append(self._graph_failure_reason(resp))
            return False
        return True

    async def _fresh_instagram_token(self, integration: dict, access_token: str | None) -> str | None:
        """Instagram tokens live 60 days. Refresh one that is close to expiry (and at least a
        day old - the earliest Instagram allows) at send time, so a connected account keeps
        working without anyone re-authorising it."""
        expires_at = integration.get("access_token_expires_at")
        if not access_token or not expires_at:
            return access_token
        now = utc_now()
        if expires_at.tzinfo is None:
            now = now.replace(tzinfo=None)
        if expires_at - now > timedelta(days=10):
            return access_token
        try:
            from app.core.crypto import encrypt_value
            from app.services.social_provider_adapters import get_social_provider_adapter

            refreshed = await get_social_provider_adapter("instagram").refresh_token(access_token)
            if not refreshed:
                return access_token
            new_expiry = utc_now() + timedelta(seconds=int(refreshed.get("expires_in") or 5183944))
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {"$set": {"access_token_encrypted": encrypt_value(refreshed["access_token"]), "access_token_expires_at": new_expiry, "updated_at": utc_now()}},
            )
            return refreshed["access_token"]
        except Exception:
            logger.warning("Instagram token refresh failed", exc_info=True)
            return access_token

    async def _deliver_instagram(
        self, integration: dict, access_token: str | None, recipient_id: str, content: str, errors: list[str]
    ) -> bool:
        account_id = integration.get("external_account_id")
        if not access_token or not account_id:
            errors.append("Instagram is not fully connected - reconnect it in Integrations.")
            return False
        access_token = await self._fresh_instagram_token(integration, access_token)
        # Instagram Login: POST graph.instagram.com/<VERSION>/<IG_ID>/messages with the
        # Instagram user token and the recipient's Instagram-scoped id.
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://graph.instagram.com/{settings.META_GRAPH_VERSION}/{account_id}/messages",
                json={"recipient": {"id": recipient_id}, "message": {"text": content}},
                params={"access_token": access_token},
            )
        if resp.status_code >= 400:
            errors.append(self._graph_failure_reason(resp))
            return False
        return True

    async def _deliver_whatsapp(
        self, integration: dict, access_token: str | None, recipient_id: str, content: str, errors: list[str] | None = None,
        receipt: dict | None = None,
    ) -> bool:
        errors = errors if errors is not None else []
        # Official Meta WhatsApp Business API: integrations connected via Meta OAuth
        # carry an access token; QR-gateway integrations never do.
        phone_number_id = (integration.get("provider_metadata") or {}).get("phone_number_id") or integration.get("external_account_id")
        if access_token and phone_number_id:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/{phone_number_id}/messages",
                    json={
                        "messaging_product": "whatsapp",
                        "to": recipient_id,
                        "type": "text",
                        "text": {"body": content},
                    },
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if resp.status_code >= 400:
                errors.append(self._graph_failure_reason(resp))
                return False
            return True

        organization_id = integration.get("organization_id")
        if not organization_id:
            logger.warning("WhatsApp integration has no organization_id; cannot resolve a gateway session for %s", recipient_id)
            errors.append("WhatsApp is not linked right now - reconnect it in Integrations.")
            return False
        if not settings.WHATSAPP_GATEWAY_URL:
            logger.warning("WhatsApp gateway URL not configured; cannot send message to %s", recipient_id)
            errors.append("WhatsApp sending is not configured on the server.")
            return False

        headers = {}
        if settings.WHATSAPP_GATEWAY_INTERNAL_SECRET:
            headers["X-Gateway-Secret"] = settings.WHATSAPP_GATEWAY_INTERNAL_SECRET

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.WHATSAPP_GATEWAY_URL.rstrip('/')}/sessions/{organization_id}/send-message",
                json={"to": recipient_id, "message": content},
                headers=headers,
            )
        if resp.status_code < 400:
            try:
                sent_id = (resp.json() or {}).get("messageId")
            except ValueError:
                sent_id = None
            if sent_id and receipt is not None:
                # WhatsApp echoes our own send back through the gateway; this id lets
                # the webhook recognise it instead of storing the message twice.
                receipt["provider_message_id"] = sent_id
        if resp.status_code == 503:
            errors.append("WhatsApp is not linked right now - reconnect it in Integrations.")
        elif resp.status_code == 429:
            errors.append("Sending too fast on WhatsApp - wait a moment and retry.")
        elif resp.status_code >= 400:
            errors.append("WhatsApp could not send the message.")
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
        if not contact_id or not ObjectId.is_valid(contact_id):
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
        errors: list[str] = []
        # Contacts and the channel connection belong to the conversation's owner, not
        # to the teammate who happened to write the reply.
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id)}) if ObjectId.is_valid(conversation_id) else None
        owner_id = (conversation or {}).get("user_id") or user_id
        receipt: dict = {}
        try:
            delivered = await self._deliver_outbound(owner_id, platform, contact_id, content, errors, receipt, conversation_id)
        except Exception:
            logger.exception("Outbound %s delivery crashed", platform)
            delivered = False
        if delivered and receipt.get("provider_message_id") and ObjectId.is_valid(message_id):
            await self.db.messages.update_one(
                {"_id": ObjectId(message_id)}, {"$set": {"provider_message_id": receipt["provider_message_id"]}}
            )
        if delivered or not ObjectId.is_valid(message_id):
            return

        updated = await self.db.messages.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$set": {"status": "failed", "delivery_error": errors[0] if errors else "The message could not be delivered."}},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            return

        await conversation_realtime_hub.publish_per_viewer(
            conversation_id,
            "message.updated",
            lambda viewer_id: self._serialize_message(updated, viewer_user_id=viewer_id or user_id),
        )
        if conversation:
            await self._publish_to_conversation_audience(conversation, extra_user_ids=[user_id])
