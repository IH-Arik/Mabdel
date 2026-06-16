from __future__ import annotations

import secrets
from datetime import timedelta
from urllib.parse import urlencode

from bson import ObjectId
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import encrypt_value
from app.core.exceptions import AppException
from app.services.social_provider_adapters import get_social_provider_adapter
from app.utils.helpers import utc_now

from ._base import SmartFlowBase
from .conversation_service import ConversationService


class IntegrationService(SmartFlowBase):
    def __init__(self, db: AsyncIOMotorDatabase, conversation_service: ConversationService | None = None) -> None:
        super().__init__(db)
        self.conversation_service = conversation_service or ConversationService(db)

    async def list_integrations(self, user_id: str) -> list[dict]:
        docs = await self.db.social_integrations.find({"user_id": user_id}).sort("platform", 1).to_list(length=20)
        return [self._serialize_integration(doc) for doc in docs]

    async def get_integration_catalog(self, user_id: str) -> list[dict]:
        docs = await self.db.social_integrations.find({"user_id": user_id}).to_list(length=50)
        existing = {doc["platform"]: doc for doc in docs}
        items: list[dict] = []
        for metadata in self._integration_catalog_metadata():
            platform = metadata["platform"]
            doc = existing.get(platform)
            if doc:
                items.append(self._serialize_integration(doc, metadata))
            else:
                items.append(
                    {
                        "platform": platform,
                        "platform_label": metadata["platform_label"],
                        "description": metadata["description"],
                        "icon_key": metadata["icon_key"],
                        "brand_color": metadata["brand_color"],
                        "status": "disconnected" if metadata["is_configured"] else "misconfigured",
                        "connected": False,
                        "health_status": "disconnected" if metadata["is_configured"] else "misconfigured",
                        "cta_label": "Connect" if metadata["is_configured"] else "Unavailable",
                        "is_available": metadata["is_available"],
                        "is_configured": metadata["is_configured"],
                        "auth_mode": metadata["auth_mode"],
                        "external_account_id": None,
                        "external_account_name": None,
                        "sync_status": "idle" if metadata["is_configured"] else "error",
                        "last_sync_at": None,
                        "last_error": None if metadata["is_configured"] else "Provider credentials are not configured.",
                        "message_sync_enabled": bool(get_social_provider_adapter(platform).supports_webhooks),
                        "webhook_status": "not_configured",
                        "connected_at": None,
                        "last_webhook_at": None,
                    }
                )
        return items

    async def get_integration_status(self, user_id: str) -> dict:
        integrations = await self.get_integration_catalog(user_id)
        connected = [item for item in integrations if item.get("connected")]
        needs_attention = [
            item
            for item in integrations
            if item.get("connected") and item.get("health_status") in {"needs_reauth", "misconfigured", "error"}
        ]
        return {
            "items": integrations,
            "summary": {
                "connected_count": len(connected),
                "needs_attention_count": len(needs_attention),
                "message_sync_enabled_count": sum(1 for item in connected if item.get("message_sync_enabled")),
            },
        }

    async def upsert_integration(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        adapter = get_social_provider_adapter(payload["platform"])
        update = {
            "user_id": user_id,
            "platform": payload["platform"],
            "status": "connected",
            "external_account_id": payload.get("external_account_id"),
            "external_account_name": payload.get("external_account_name"),
            "provider_metadata": payload.get("provider_metadata") or {},
            "access_token_encrypted": encrypt_value(payload["access_token"]),
            "refresh_token_encrypted": encrypt_value(payload["refresh_token"]) if payload.get("refresh_token") else None,
            "sync_status": "idle",
            "message_sync_enabled": bool(adapter.supports_webhooks or adapter.supports_recent_sync),
            "webhook_status": "configured" if adapter.supports_webhooks else "not_configured",
            "last_error": None,
            "connected_at": now,
            "updated_at": now,
        }
        result = await self.db.social_integrations.find_one_and_update(
            {"user_id": user_id, "platform": payload["platform"]},
            {"$set": update, "$setOnInsert": {"created_at": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return self._sanitize_integration(result)

    async def sync_integration(self, user_id: str, platform: str) -> dict:
        integration = await self.db.social_integrations.find_one({"user_id": user_id, "platform": platform, "status": "connected"})
        if not integration:
            raise AppException(status_code=404, code="INTEGRATION_NOT_FOUND", message="Integration not found.")
        adapter = get_social_provider_adapter(platform)
        now = utc_now()
        if not adapter.supports_recent_sync:
            status_value = adapter.unsupported_reason
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": status_value,
                        "last_error": "Recent message sync is not available for this provider with the current API access.",
                        "updated_at": now,
                    }
                },
            )
            return {
                "platform": platform,
                "sync_status": status_value,
                "imported_count": 0,
                "message_sync_enabled": bool(adapter.supports_webhooks),
                "last_error": "Recent message sync is not available for this provider with the current API access.",
            }

        await self.db.social_integrations.update_one({"_id": integration["_id"]}, {"$set": {"sync_status": "syncing", "updated_at": now}})
        try:
            messages = await adapter.fetch_recent_messages(integration, self._decrypt_integration_token(integration))
            imported_count = 0
            for item in messages:
                result = await self.handle_inbound_webhook(user_id, platform, item.to_payload())
                if result.get("status") == "processed":
                    imported_count += 1
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {"$set": {"sync_status": "synced", "last_sync_at": utc_now(), "last_error": None, "updated_at": utc_now()}},
            )
            return {"platform": platform, "sync_status": "synced", "imported_count": imported_count, "message_sync_enabled": True}
        except AppException as exc:
            details = getattr(exc, "details", None) or {}
            sync_status = details.get("sync_status") or "error"
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": sync_status,
                        "last_error": exc.message if hasattr(exc, "message") else "Recent message sync failed.",
                        "updated_at": utc_now(),
                    }
                },
            )
            return {
                "platform": platform,
                "sync_status": sync_status,
                "imported_count": 0,
                "message_sync_enabled": bool(adapter.supports_recent_sync or adapter.supports_webhooks),
                "last_error": exc.message if hasattr(exc, "message") else "Recent message sync failed.",
            }

    async def connect_telegram_manual(self, user_id: str, payload: dict) -> dict:
        bot_token = payload["bot_token"].strip()
        secret_token = (payload.get("secret_token") or secrets.token_urlsafe(18)).strip()
        webhook_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}/api/v1/smartflow/integrations/telegram/webhook"

        telegram_url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                telegram_url,
                data={"url": webhook_url, "secret_token": secret_token},
                headers={"Accept": "application/json"},
            )

        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="TELEGRAM_WEBHOOK_SETUP_FAILED",
                message="Telegram webhook setup failed.",
                details={"status_code": response.status_code, "response": response.text[:500]},
            )

        payload_data = response.json()
        if not payload_data.get("ok"):
            raise AppException(
                status_code=502,
                code="TELEGRAM_WEBHOOK_SETUP_FAILED",
                message="Telegram webhook setup failed.",
                details={"response": payload_data},
            )

        await self.upsert_integration(
            user_id,
            {
                "platform": "telegram",
                "access_token": bot_token,
                "refresh_token": None,
                "external_account_id": payload.get("bot_username"),
            },
        )
        now = utc_now()
        stored = await self.db.social_integrations.find_one_and_update(
            {"user_id": user_id, "platform": "telegram"},
            {
                "$set": {
                    "telegram_secret_token": secret_token,
                    "telegram_webhook_url": webhook_url,
                    "telegram_webhook_registered_at": now,
                    "telegram_last_setup_ok": True,
                    "webhook_status": "configured",
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not stored:
            raise AppException(status_code=500, code="INTEGRATION_PERSISTENCE_FAILED", message="Telegram integration could not be stored.")

        return {
            "connected": True,
            "platform": "telegram",
            "webhook_url": webhook_url,
            "secret_token": secret_token,
            "integration": self._serialize_integration(stored),
        }

    async def connect_whatsapp_manual(self, user_id: str, payload: dict) -> dict:
        phone_number = payload["phone_number"].strip()
        gateway_url = (payload.get("whatsapp_gateway_url") or "http://localhost:3001").strip()

        await self.upsert_integration(
            user_id,
            {
                "platform": "whatsapp",
                "access_token": "openwa_manual_bypass",
                "refresh_token": None,
                "external_account_id": phone_number,
            },
        )
        now = utc_now()
        stored = await self.db.social_integrations.find_one_and_update(
            {"user_id": user_id, "platform": "whatsapp"},
            {
                "$set": {
                    "whatsapp_gateway_url": gateway_url,
                    "webhook_status": "configured",
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not stored:
            raise AppException(status_code=500, code="INTEGRATION_PERSISTENCE_FAILED", message="WhatsApp integration could not be stored.")

        return {
            "connected": True,
            "platform": "whatsapp",
            "integration": self._serialize_integration(stored),
        }

    async def disconnect_integration(self, user_id: str, platform: str) -> dict:
        updated = await self.db.social_integrations.find_one_and_update(
            {"user_id": user_id, "platform": platform},
            {
                "$set": {
                    "status": "disconnected",
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise AppException(status_code=404, code="INTEGRATION_NOT_FOUND", message="Integration not found.")
        return self._sanitize_integration(updated)

    async def start_integration_oauth(self, user_id: str, platform: str) -> dict:
        provider = self._oauth_provider(platform)
        state = secrets.token_urlsafe(24)
        expires_at = utc_now() + timedelta(minutes=settings.OAUTH_STATE_EXPIRE_MINUTES)
        state_payload = {
            "user_id": user_id,
            "platform": platform,
            "provider": provider["provider"],
            "state": state,
            "expires_at": expires_at,
            "created_at": utc_now(),
        }
        params = {
            "client_id": provider["client_id"],
            "redirect_uri": provider["redirect_uri"],
            "response_type": "code",
            "scope": " ".join(provider["scopes"]),
            "state": state,
        }
        if provider["provider"] == "twitter":
            code_verifier = secrets.token_urlsafe(48)
            state_payload["code_verifier"] = code_verifier
            params.update(self._twitter_pkce_authorize_params(code_verifier))
        await self.db.oauth_states.insert_one(
            state_payload
        )
        if provider.get("extra_authorize_params"):
            params.update(provider["extra_authorize_params"])
        return {
            "platform": platform,
            "provider": provider["provider"],
            "auth_url": f'{provider["authorize_url"]}?{urlencode(params)}',
            "state": state,
            "expires_at": expires_at,
        }

    async def complete_integration_oauth(self, platform: str, code: str, state: str) -> dict:
        state_doc = await self.db.oauth_states.find_one({"platform": platform, "state": state})
        if not state_doc or state_doc.get("expires_at") < utc_now():
            raise AppException(status_code=400, code="OAUTH_STATE_INVALID", message="OAuth state is invalid or expired.")

        provider = self._oauth_provider(platform)
        token_payload = {
            "client_id": provider["client_id"],
            "client_secret": provider["client_secret"],
            "redirect_uri": provider["redirect_uri"],
            "code": code,
        }
        token_payload.update(provider["token_payload"])
        if provider["provider"] == "twitter":
            code_verifier = state_doc.get("code_verifier")
            if not code_verifier:
                raise AppException(status_code=400, code="OAUTH_STATE_INVALID", message="OAuth state is missing PKCE verifier.")
            token_payload["code_verifier"] = code_verifier
        async with httpx.AsyncClient(timeout=30.0) as client:
            token_response = await client.post(
                provider["token_url"],
                data=token_payload,
                headers={"Accept": "application/json"},
            )
        if token_response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="OAUTH_TOKEN_EXCHANGE_FAILED",
                message="OAuth token exchange failed.",
                details={"platform": platform, "provider_status": token_response.status_code, "response": token_response.text[:300]},
            )
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(status_code=502, code="OAUTH_ACCESS_TOKEN_MISSING", message="Provider did not return an access token.")

        adapter = get_social_provider_adapter(platform)
        account_metadata = await adapter.fetch_account_metadata(access_token, token_data)
        integration = await self.upsert_integration(
            state_doc["user_id"],
            {
                "platform": platform,
                "access_token": access_token,
                "refresh_token": token_data.get("refresh_token"),
                "external_account_id": account_metadata.get("external_account_id") or token_data.get("scope") or token_data.get("token_type"),
                "external_account_name": account_metadata.get("external_account_name"),
            },
        )
        await self.db.social_integrations.update_one(
            {"_id": ObjectId(integration["id"])},
            {
                "$set": {
                    "oauth_state_completed_at": utc_now(),
                    "token_expires_in": token_data.get("expires_in"),
                    "granted_scopes": token_data.get("scope"),
                }
            },
        )
        await self.db.oauth_states.delete_one({"_id": state_doc["_id"]})
        if adapter.supports_recent_sync:
            await self.sync_integration(state_doc["user_id"], platform)
        return {
            "connected": True,
            "platform": platform,
            "integration": self._sanitize_integration(await self.db.social_integrations.find_one({"_id": ObjectId(integration["id"])})),
        }

    async def handle_inbound_webhook(self, user_id: str, platform: str, payload: dict) -> dict:
        payload = self.normalize_webhook_payload(platform, payload)
        existing = await self.db.processed_webhooks.find_one(
            {
                "platform": platform,
                "event_id": payload["event_id"],
                "user_id": user_id,
            }
        )
        if existing:
            return {"status": "ignored", "reason": "duplicate_event"}
        try:
            await self.db.processed_webhooks.insert_one(
                {
                    "platform": platform,
                    "event_id": payload["event_id"],
                    "user_id": user_id,
                    "raw_payload": payload.get("raw_payload"),
                    "created_at": utc_now(),
                }
            )
        except Exception:
            return {"status": "ignored", "reason": "duplicate_event"}

        contact = await self.db.contacts.find_one(
            {
                "user_id": user_id,
                "identities": {
                    "$elemMatch": {"platform": platform, "external_id": payload["contact_external_id"]},
                },
            }
        )
        if not contact:
            contact = {
                "user_id": user_id,
                "name": payload.get("contact_name") or f"{self._platform_label(platform)} Contact",
                "email": None,
                "phone": None,
                "avatar_url": None,
                "identities": [{"platform": platform, "external_id": payload["contact_external_id"], "handle": None}],
                "presence": "offline",
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }
            insert = await self.db.contacts.insert_one(contact)
            contact["_id"] = insert.inserted_id

        conversation = await self.db.conversations.find_one(
            {"user_id": user_id, "contact_id": str(contact["_id"]), "platform": platform}
        )
        if not conversation:
            conversation = {
            "user_id": user_id,
            "title": contact["name"],
                "contact_id": str(contact["_id"]),
                "type": "direct",
                "platform": platform,
                "member_ids": [user_id],
                "archived": False,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }
            insert = await self.db.conversations.insert_one(conversation)
            conversation["_id"] = insert.inserted_id

        message = await self.conversation_service.create_message(
            user_id,
            {
                "conversation_id": str(conversation["_id"]),
                "contact_id": str(contact["_id"]),
                "platform": platform,
                "direction": "inbound",
                "content": payload["content"],
                "media_url": payload.get("media_url"),
                "reply_to_message_id": None,
                "forward_from_message_id": None,
                "provider_event_id": payload["event_id"],
                "provider_message_id": payload["event_id"],
                "external_account_id": payload.get("external_account_id"),
            },
        )
        await self.create_notification(
            user_id=user_id,
            notification_type="message",
            title=f"New {platform} message",
            body=payload["content"],
        )
        await self.db.social_integrations.update_one(
            {"user_id": user_id, "platform": platform},
            {"$set": {"last_webhook_at": utc_now(), "webhook_status": "active", "updated_at": utc_now()}},
        )
        return {"status": "processed", "message": message}

    def normalize_webhook_payload(self, platform: str, payload: dict) -> dict:
        normalized = get_social_provider_adapter(platform).normalize_webhook(payload)
        if normalized:
            return normalized.to_payload()

        raise AppException(
            status_code=400,
            code="WEBHOOK_PAYLOAD_INVALID",
            message="Webhook payload could not be normalized.",
            details={"platform": platform},
        )

    @staticmethod
    def validate_webhook_secret(secret: str | None) -> None:
        configured = settings.WEBHOOK_SHARED_SECRET
        if configured and secret != configured:
            raise AppException(status_code=401, code="WEBHOOK_UNAUTHORIZED", message="Webhook secret is invalid.")

    async def validate_platform_webhook_secret(self, user_id: str, platform: str, secret: str | None) -> None:
        if platform != "telegram":
            self.validate_webhook_secret(secret)
            return

        integration = await self.db.social_integrations.find_one({"user_id": user_id, "platform": "telegram"})
        expected = (integration or {}).get("telegram_secret_token") or settings.WEBHOOK_SHARED_SECRET
        if expected and secret != expected:
            raise AppException(status_code=401, code="WEBHOOK_UNAUTHORIZED", message="Webhook secret is invalid.")

    async def resolve_webhook_user_id(self, platform: str, payload: dict, secret: str | None = None) -> str:
        if platform == "telegram" and secret:
            integration = await self.db.social_integrations.find_one(
                {"platform": "telegram", "status": "connected", "telegram_secret_token": secret}
            )
            if integration:
                return integration["user_id"]

        normalized = get_social_provider_adapter(platform).normalize_webhook(payload)
        external_account_id = normalized.external_account_id if normalized else None
        if external_account_id:
            integration = await self.db.social_integrations.find_one(
                {"platform": platform, "status": "connected", "external_account_id": str(external_account_id)}
            )
            if integration:
                return integration["user_id"]

        raise AppException(
            status_code=400,
            code="WEBHOOK_INTEGRATION_UNRESOLVED",
            message="Webhook could not be matched to a connected integration.",
            details={"platform": platform},
        )

    @staticmethod
    def validate_meta_webhook_challenge(mode: str | None, verify_token: str | None) -> None:
        if mode != "subscribe" or not settings.META_WEBHOOK_VERIFY_TOKEN or verify_token != settings.META_WEBHOOK_VERIFY_TOKEN:
            raise AppException(status_code=401, code="WEBHOOK_VERIFICATION_FAILED", message="Webhook verification failed.")
