from __future__ import annotations

import hmac
import logging
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
from .calendar_service import CalendarService
from .conversation_service import ConversationService
from .google_calendar_service import GoogleCalendarService
from .microsoft_calendar_service import MicrosoftCalendarService
from .zoom_calendar_service import ZoomCalendarService

logger = logging.getLogger(__name__)


class IntegrationService(SmartFlowBase):
    def __init__(self, db: AsyncIOMotorDatabase, conversation_service: ConversationService | None = None) -> None:
        super().__init__(db)
        # Local import: app.services.email_domain's package __init__ pulls in
        # inbound_service.py, which imports SmartFlowService — importing it at
        # module load time here would be circular (smartflow -> email_domain ->
        # smartflow_service -> smartflow). Same precedent as
        # SmartFlowBase._resolve_bulk_sender's local EmailDomainService import.
        from app.services.email_domain.zoho_mail_service import ZohoMailService
        from app.services.email_domain.microsoft_mail_service import MicrosoftMailService

        self.conversation_service = conversation_service or ConversationService(db)
        self.google_calendar_service = GoogleCalendarService(db)
        self.zoom_calendar_service = ZoomCalendarService(db)
        self.microsoft_calendar_service = MicrosoftCalendarService(db)
        self.calendar_service = CalendarService(db)
        self.zoho_mail_service = ZohoMailService(db)
        self.microsoft_mail_service = MicrosoftMailService(db)

    async def list_integrations(self, user_id: str) -> list[dict]:
        team_ids = await self._resolve_team_user_ids(user_id)
        docs = await self.db.social_integrations.find({"user_id": {"$in": team_ids}}).sort("platform", 1).to_list(length=200)
        return [self._serialize_integration(doc) for doc in docs]

    # How often a connected WhatsApp session is re-checked against the gateway when the
    # catalog loads. Without this every page load made a gateway round trip (the page
    # computes the catalog several times per load).
    _WHATSAPP_GATEWAY_RECHECK_SECONDS = 60
    _GATEWAY_BEST_EFFORT_TIMEOUT = 3.0

    async def _sync_pending_whatsapp(self, user_id: str) -> None:
        """A QR pairing is only recorded as connected when something asks the gateway
        (the connect modal's poll). If that modal was closed or the poll missed the
        moment, the card would stay on "Connect" although the phone is linked, so
        refresh a pending session whenever the catalog is loaded. Also restarts a
        connected session the gateway lost (e.g. after a deploy)."""
        try:
            organization_id = await self._resolve_organization_id(user_id)
            if not organization_id:
                return
            doc = await self.db.social_integrations.find_one(
                {"organization_id": organization_id, "platform": "whatsapp", "whatsapp_secret_token": {"$exists": True}}
            )
            if not doc:
                return
            if not ObjectId.is_valid(str(doc.get("user_id"))):
                await self.db.social_integrations.update_one({"_id": doc["_id"]}, {"$set": {"user_id": user_id}})
            if doc.get("status") == "pending_qr":
                await self.get_whatsapp_connect_status(user_id, timeout=self._GATEWAY_BEST_EFFORT_TIMEOUT)
            elif doc.get("status") == "connected" and doc.get("whatsapp_secret_token"):
                now = utc_now()
                checked_at = doc.get("gateway_checked_at")
                if checked_at is not None and checked_at.tzinfo is None:
                    now = now.replace(tzinfo=None)
                if checked_at is not None and (now - checked_at).total_seconds() < self._WHATSAPP_GATEWAY_RECHECK_SECONDS:
                    return
                await self.db.social_integrations.update_one({"_id": doc["_id"]}, {"$set": {"gateway_checked_at": now}})
                await self._restore_whatsapp_session_if_lost(organization_id, doc["whatsapp_secret_token"])
        except Exception:
            pass  # best-effort; the catalog must load even if the gateway is down

    async def _restore_whatsapp_session_if_lost(self, organization_id: str, webhook_secret: str) -> None:
        """The gateway keeps sessions in memory and re-opens paired ones on boot, but
        a session paired before boot-restore existed has no saved webhook secret and
        stays dark after a deploy restart. We still hold the secret, so if the gateway
        reports no live session for a connected integration, start it again - the
        paired credentials are on the gateway's volume, so no new QR is needed."""
        base = settings.WHATSAPP_GATEWAY_URL.rstrip("/")
        async with httpx.AsyncClient(timeout=self._GATEWAY_BEST_EFFORT_TIMEOUT) as client:
            state = (await client.get(f"{base}/sessions/{organization_id}/qr", headers=self._whatsapp_gateway_headers())).json()
            if state.get("status") == "disconnected":
                await client.post(
                    f"{base}/sessions/{organization_id}/start",
                    json={"webhook_secret": webhook_secret},
                    headers=self._whatsapp_gateway_headers(),
                )

    async def get_integration_catalog(self, user_id: str) -> list[dict]:
        await self._sync_pending_whatsapp(user_id)
        team_ids = await self._resolve_team_user_ids(user_id)
        docs = await self.db.social_integrations.find({"user_id": {"$in": team_ids}}).to_list(length=200)
        # If multiple teammates connected the same platform, prefer the caller's own
        # connection in the catalog view, then fall back to the first teammate's.
        # A live connection always wins over a stale disconnected doc (WhatsApp can
        # leave one behind when an org switches between QR and the official API).
        docs.sort(key=lambda d: (0 if d.get("status") == "connected" else 1, 0 if d.get("user_id") == user_id else 1))
        existing = {doc["platform"]: doc for doc in reversed(docs)}
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
        integration = await self._find_team_integration(user_id, platform, {"status": "connected"})
        if not integration:
            raise AppException(status_code=404, code="INTEGRATION_NOT_FOUND", message="Integration not found.")
        if platform in {"google_business", "zoom", "microsoft"}:
            provider_settings = await self.calendar_service.get_calendar_provider_settings(user_id)
            if provider_settings["primary_calendar_provider"] != platform:
                # Another provider is the primary synced calendar for this user; this
                # one stays connected solely to mint real meeting links on demand, no
                # inbound event pull (see CalendarService.get_calendar_provider_settings).
                return {"platform": platform, "sync_status": "meet_link_only", "imported_count": 0}
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {"$set": {"sync_status": "syncing", "updated_at": utc_now()}},
            )
            if platform == "google_business":
                return await self.google_calendar_service.sync_events(user_id, integration)
            if platform == "microsoft":
                return await self.microsoft_calendar_service.sync_events(user_id, integration)
            return await self.zoom_calendar_service.sync_events(user_id, integration)
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
            logger.warning("Telegram setWebhook failed: status=%s body=%s", response.status_code, response.text[:500])
            raise AppException(
                status_code=502,
                code="TELEGRAM_WEBHOOK_SETUP_FAILED",
                message="Telegram webhook setup failed.",
                details={"status_code": response.status_code},
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

    @staticmethod
    def _whatsapp_gateway_headers() -> dict:
        headers = {}
        if settings.WHATSAPP_GATEWAY_INTERNAL_SECRET:
            headers["X-Gateway-Secret"] = settings.WHATSAPP_GATEWAY_INTERNAL_SECRET
        return headers

    async def _require_organization_id(self, user_id: str) -> str:
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id:
            raise AppException(status_code=422, code="NO_ORGANIZATION", message="Your account isn't part of an organization yet.")
        return organization_id

    async def _team_whatsapp_docs(self, user_id: str, organization_id: str | None) -> list[dict]:
        """Every WhatsApp record this organization holds. The organization has ONE
        WhatsApp connection (QR gateway or official API); older records can be
        spread across teammates, so look at the whole team, not just the caller."""
        team_ids = await self._resolve_team_user_ids(user_id)
        conditions: list[dict] = [{"user_id": {"$in": team_ids}}]
        if organization_id:
            conditions.append({"organization_id": organization_id})
        return await self.db.social_integrations.find({"platform": "whatsapp", "$or": conditions}).to_list(length=50)

    @staticmethod
    def _disconnected_whatsapp_fields() -> dict:
        return {
            "status": "disconnected",
            "external_account_id": None,
            "access_token_encrypted": None,
            "refresh_token_encrypted": None,
            "sync_status": "idle",
            "last_error": None,
            "updated_at": utc_now(),
        }

    async def _gateway_post(self, organization_id: str, action: str, payload: dict | None = None, timeout: float = 10.0) -> httpx.Response:
        async with httpx.AsyncClient(timeout=timeout) as client:
            return await client.post(
                f"{settings.WHATSAPP_GATEWAY_URL.rstrip('/')}/sessions/{organization_id}/{action}",
                json=payload,
                headers=self._whatsapp_gateway_headers(),
            )

    async def start_whatsapp_connect(self, user_id: str) -> dict:
        """One WhatsApp connection per organization (same pattern as one Stripe Connect
        account / one Telnyx number per organization). The QR session is keyed by
        organization_id in the gateway; the integration record keeps ONE row for the
        whole team so switching between QR and the official API reuses it (a second
        row would violate the unique (user_id, platform) index)."""
        organization_id = await self._require_organization_id(user_id)

        docs = await self._team_whatsapp_docs(user_id, organization_id)
        existing = next((d for d in docs if d.get("organization_id") == organization_id and d.get("whatsapp_secret_token")), None)
        existing = existing or (docs[0] if docs else None)
        webhook_secret = (existing or {}).get("whatsapp_secret_token") or secrets.token_urlsafe(18)

        try:
            response = await self._gateway_post(organization_id, "start", {"webhook_secret": webhook_secret}, timeout=15.0)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("WhatsApp gateway start failed for org %s: %s", organization_id, exc)
            raise AppException(
                status_code=503, code="WHATSAPP_GATEWAY_UNREACHABLE", message="Could not reach the WhatsApp gateway. Please try again shortly."
            ) from exc

        gateway_state = response.json()
        now = utc_now()

        # organization_id is not a user id (real orgs use UUIDs), but every read path
        # keys off social_integrations.user_id being a real user. Keep the original
        # connector as owner; repair records that carry the organization id there.
        existing_owner = (existing or {}).get("user_id")
        owner_user_id = existing_owner if existing_owner and ObjectId.is_valid(str(existing_owner)) else user_id

        # Going QR retires any official-API connection (drop its tokens) and any stray
        # duplicate rows other teammates may hold.
        stale_ids = [d["_id"] for d in docs if existing is None or d["_id"] != existing["_id"]]
        if stale_ids:
            await self.db.social_integrations.update_many({"_id": {"$in": stale_ids}}, {"$set": self._disconnected_whatsapp_fields()})

        doc_filter = {"_id": existing["_id"]} if existing else {"organization_id": organization_id, "platform": "whatsapp"}
        stored = await self.db.social_integrations.find_one_and_update(
            doc_filter,
            {
                "$set": {
                    "user_id": owner_user_id,
                    "platform": "whatsapp",
                    "organization_id": organization_id,
                    "whatsapp_secret_token": webhook_secret,
                    "status": "connected" if gateway_state.get("status") == "connected" else "pending_qr",
                    "external_account_id": gateway_state.get("linked_number"),
                    "access_token_encrypted": None,
                    "refresh_token_encrypted": None,
                    "provider_metadata": {},
                    "webhook_status": "configured",
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return {
            "status": gateway_state.get("status", "pending_qr"),
            "qr_data_url": gateway_state.get("qr_data_url"),
            "linked_number": gateway_state.get("linked_number"),
            "integration": self._serialize_integration(stored),
        }

    async def get_whatsapp_connect_status(self, user_id: str, timeout: float = 10.0) -> dict:
        organization_id = await self._require_organization_id(user_id)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    f"{settings.WHATSAPP_GATEWAY_URL.rstrip('/')}/sessions/{organization_id}/qr",
                    headers=self._whatsapp_gateway_headers(),
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("WhatsApp gateway status failed for org %s: %s", organization_id, exc)
            raise AppException(
                status_code=503, code="WHATSAPP_GATEWAY_UNREACHABLE", message="Could not reach the WhatsApp gateway. Please try again shortly."
            ) from exc

        gateway_state = response.json()
        if gateway_state.get("status") == "connected":
            await self.db.social_integrations.update_one(
                {"organization_id": organization_id, "platform": "whatsapp"},
                {
                    "$set": {
                        "status": "connected",
                        "external_account_id": gateway_state.get("linked_number"),
                        "connected_at": utc_now(),
                        "updated_at": utc_now(),
                    }
                },
            )
        return {
            "status": gateway_state.get("status", "disconnected"),
            "qr_data_url": gateway_state.get("qr_data_url"),
            "linked_number": gateway_state.get("linked_number"),
        }

    async def _retire_whatsapp_qr_for_official_api(self, connected_id: ObjectId, user_id: str) -> None:
        """An organization has one WhatsApp connection. After the official API connects,
        tear down any QR gateway session and drop its QR-only fields from the row that
        was just connected (the upsert can land on the old QR row), without ever
        disconnecting that row."""
        organization_id = await self._resolve_organization_id(user_id)
        docs = await self._team_whatsapp_docs(user_id, organization_id)
        if any(d.get("whatsapp_secret_token") for d in docs) and organization_id:
            try:
                await self._gateway_post(organization_id, "disconnect", timeout=self._GATEWAY_BEST_EFFORT_TIMEOUT)
            except httpx.HTTPError:
                pass  # best-effort
        await self.db.social_integrations.update_one(
            {"_id": connected_id}, {"$unset": {"organization_id": "", "whatsapp_secret_token": "", "gateway_checked_at": ""}}
        )
        others = [d["_id"] for d in docs if d["_id"] != connected_id]
        if others:
            await self.db.social_integrations.update_many({"_id": {"$in": others}}, {"$set": self._disconnected_whatsapp_fields()})

    async def disconnect_whatsapp(self, user_id: str) -> dict:
        """Disconnects the organization's WhatsApp connection, whichever kind it is
        (QR gateway session and/or official API), for any teammate with manage rights."""
        organization_id = await self._resolve_organization_id(user_id)
        docs = await self._team_whatsapp_docs(user_id, organization_id)
        if not docs:
            raise AppException(status_code=404, code="INTEGRATION_NOT_FOUND", message="Integration not found.")

        qr_doc = next((d for d in docs if d.get("whatsapp_secret_token")), None)
        if qr_doc:
            try:
                await self._gateway_post(qr_doc.get("organization_id") or organization_id, "disconnect", timeout=10.0)
            except httpx.HTTPError:
                pass  # best-effort - the integration record is marked disconnected regardless

        await self.db.social_integrations.update_many(
            {"_id": {"$in": [d["_id"] for d in docs]}}, {"$set": self._disconnected_whatsapp_fields()}
        )
        updated = await self.db.social_integrations.find_one({"_id": docs[0]["_id"]})
        return self._sanitize_integration(updated)

    async def _find_team_integration(self, user_id: str, platform: str, extra: dict | None = None) -> dict | None:
        """The caller's own connection first, else a teammate's. The catalog shows
        connections org-wide, so disconnect/sync must reach them too - otherwise a
        teammate sees "Connected" and gets a 404 on Disconnect."""
        query = {"platform": platform, **(extra or {})}
        own = await self.db.social_integrations.find_one({"user_id": user_id, **query})
        if own:
            return own
        team_ids = await self._resolve_team_user_ids(user_id)
        return await self.db.social_integrations.find_one({"user_id": {"$in": team_ids}, **query})

    async def disconnect_integration(self, user_id: str, platform: str) -> dict:
        target = await self._find_team_integration(user_id, platform)
        if not target:
            raise AppException(status_code=404, code="INTEGRATION_NOT_FOUND", message="Integration not found.")
        updated = await self.db.social_integrations.find_one_and_update(
            {"_id": target["_id"]},
            {
                "$set": {
                    "status": "disconnected",
                    "access_token_encrypted": None,
                    "refresh_token_encrypted": None,
                    "access_token_expires_at": None,
                    "sync_status": "idle",
                    "last_error": None,
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
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
        # Claim the state atomically (single use). Deleting only after a successful
        # exchange left it replayable, and two concurrent callbacks could both pass.
        code = code[:-2] if code.endswith("#_") else code
        state_doc = await self.db.oauth_states.find_one_and_delete({"state": state})
        expires_at = state_doc.get("expires_at") if state_doc else None
        now = utc_now()
        if expires_at is not None and expires_at.tzinfo is None:
            # Mongo returns BSON datetimes as naive UTC
            now = now.replace(tzinfo=None)
        if not state_doc or expires_at is None or expires_at < now:
            raise AppException(status_code=400, code="OAUTH_STATE_INVALID", message="OAuth state is invalid or expired.")
        platform = state_doc["platform"]

        provider = self._oauth_provider(platform)
        token_payload = {
            "redirect_uri": provider["redirect_uri"],
            "code": code,
        }
        # Zoom requires the client credentials in an HTTP Basic Auth header, not the
        # request body (verified against Zoom's own OAuth docs) — every other
        # provider here takes them in the body instead.
        basic_auth = None
        if provider.get("token_auth") == "basic":
            basic_auth = httpx.BasicAuth(provider["client_id"], provider["client_secret"])
        else:
            token_payload["client_id"] = provider["client_id"]
            token_payload["client_secret"] = provider["client_secret"]
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
                auth=basic_auth,
                headers={"Accept": "application/json"},
            )
        if token_response.status_code >= 400:
            logger.warning("OAuth token exchange failed for %s: status=%s body=%s", platform, token_response.status_code, token_response.text[:300])
            raise AppException(
                status_code=502,
                code="OAUTH_TOKEN_EXCHANGE_FAILED",
                message="OAuth token exchange failed.",
                details={"platform": platform, "provider_status": token_response.status_code},
            )
        token_data = token_response.json()
        # Instagram Login documents the token response as { data: [ {access_token, user_id, ...} ] };
        # other providers (and older Instagram responses) return it flat. Accept both.
        if isinstance(token_data.get("data"), list) and token_data["data"]:
            token_data = {**token_data, **token_data["data"][0]}
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(status_code=502, code="OAUTH_ACCESS_TOKEN_MISSING", message="Provider did not return an access token.")

        account_metadata = {}
        provider_metadata = {}
        if platform == "google_business":
            google_context = await self.google_calendar_service.fetch_account_context(access_token)
            userinfo = google_context["userinfo"]
            default_calendar = google_context.get("default_calendar") or {}
            account_metadata = {
                "external_account_id": userinfo.get("email") or userinfo.get("id"),
                "external_account_name": userinfo.get("name") or userinfo.get("email") or "Google Calendar",
            }
            provider_metadata = {
                "calendar_provider": "google_calendar",
                "google_user_email": userinfo.get("email"),
                "google_user_id": userinfo.get("id"),
                "default_calendar_id": default_calendar.get("id") or "primary",
                "default_calendar_name": default_calendar.get("summary") or "Primary",
                "timezone": default_calendar.get("timeZone") or userinfo.get("locale") or "UTC",
                "calendar_count": len(google_context.get("calendars") or []),
                "available_calendars": [
                    {
                        "id": item.get("id"),
                        "summary": item.get("summary"),
                        "primary": bool(item.get("primary")),
                        "access_role": item.get("accessRole"),
                        "time_zone": item.get("timeZone"),
                    }
                    for item in (google_context.get("calendars") or [])
                ],
            }
        elif platform == "zoom":
            zoom_user = await self.zoom_calendar_service.fetch_account_context(access_token)
            account_metadata = {
                "external_account_id": zoom_user.get("email") or zoom_user.get("id"),
                "external_account_name": zoom_user.get("email") or "Zoom Calendar",
            }
            provider_metadata = {
                "calendar_provider": "zoom_calendar",
                "zoom_user_id": zoom_user.get("id"),
                "zoom_user_email": zoom_user.get("email"),
                "zoom_account_id": zoom_user.get("account_id"),
                "timezone": zoom_user.get("timezone") or "UTC",
            }
        elif platform == "zoho":
            zoho_account = await self.zoho_mail_service.fetch_account_context(access_token)
            account_metadata = {
                "external_account_id": zoho_account.get("email") or zoho_account.get("account_id"),
                "external_account_name": zoho_account.get("email") or "Zoho Mail",
            }
            provider_metadata = {
                "account_id": zoho_account.get("account_id"),
                "email": zoho_account.get("email"),
                "display_name": zoho_account.get("display_name"),
            }
        elif platform == "microsoft":
            # One Azure AD app registration/consent covers both bulk email sending
            # and Outlook Calendar sync, so this single OAuth completion stores one
            # provider_metadata shape read by both MicrosoftMailService (email,
            # display_name) and MicrosoftCalendarService (calendar_provider,
            # timezone) — mirroring Zoho's mail-only branch above plus Zoom/Google's
            # calendar_provider marker below.
            microsoft_account = await self.microsoft_mail_service.fetch_account_context(access_token)
            account_metadata = {
                "external_account_id": microsoft_account.get("email"),
                "external_account_name": microsoft_account.get("email") or "Microsoft 365",
            }
            provider_metadata = {
                "email": microsoft_account.get("email"),
                "display_name": microsoft_account.get("display_name"),
                "calendar_provider": "microsoft_calendar",
                "timezone": "UTC",
            }
        elif platform == "instagram":
            account = await get_social_provider_adapter(platform).connect_instagram(access_token, token_data)
            access_token = account["access_token"]
            token_data["expires_in"] = account["expires_in"] or token_data.get("expires_in")
            account_metadata = {
                "external_account_id": account["external_account_id"],
                "external_account_name": account["external_account_name"],
            }
            provider_metadata = account["provider_metadata"]
        elif platform == "whatsapp":
            cloud = await get_social_provider_adapter(platform).connect_cloud_api(access_token)
            access_token = cloud["access_token"]
            account_metadata = {
                "external_account_id": cloud["external_account_id"],
                "external_account_name": cloud["external_account_name"],
            }
            provider_metadata = cloud["provider_metadata"]
        elif platform == "facebook_messenger":
            page = await get_social_provider_adapter(platform).connect_messenger(access_token)
            # The Send API needs the Page token, not the user token OAuth returned.
            access_token = page["access_token"]
            account_metadata = {
                "external_account_id": page["external_account_id"],
                "external_account_name": page["external_account_name"],
            }
            provider_metadata = page["provider_metadata"]
        else:
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
                "provider_metadata": provider_metadata,
            },
        )
        await self.db.social_integrations.update_one(
            {"_id": ObjectId(integration["id"])},
            {
                "$set": {
                    "oauth_state_completed_at": utc_now(),
                    "token_expires_in": token_data.get("expires_in"),
                    "access_token_expires_at": utc_now() + timedelta(seconds=int(token_data.get("expires_in") or 3600)),
                    "granted_scopes": token_data.get("scope"),
                }
            },
        )
        if platform == "whatsapp":
            await self._retire_whatsapp_qr_for_official_api(ObjectId(integration["id"]), state_doc["user_id"])
        if platform in {"google_business", "zoom", "microsoft"}:
            # sync_integration itself now checks get_calendar_provider_settings to
            # decide full pull-sync vs. meet-link-only — no connect-time flag needed.
            await self.sync_integration(state_doc["user_id"], platform)
        else:
            adapter = get_social_provider_adapter(platform)
            if adapter.supports_recent_sync:
                await self.sync_integration(state_doc["user_id"], platform)
        return {
            "connected": True,
            "platform": platform,
            "integration": self._sanitize_integration(await self.db.social_integrations.find_one({"_id": ObjectId(integration["id"])})),
        }

    async def _record_inbound_message(self, user_id: str, platform: str, payload: dict, *, is_history_import: bool) -> dict | None:
        """Core contact/conversation/message write shared by a single live webhook
        delivery and a bulk history-import batch. Returns None on a duplicate event."""
        existing = await self.db.processed_webhooks.find_one(
            {
                "platform": platform,
                "event_id": payload["event_id"],
                "user_id": user_id,
            }
        )
        if existing:
            return None
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
            return None

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

        direction = payload.get("direction") if payload.get("direction") in ("inbound", "outbound") else "inbound"
        message = await self.conversation_service.create_message(
            user_id,
            {
                "conversation_id": str(conversation["_id"]),
                "contact_id": str(contact["_id"]),
                "platform": platform,
                "direction": direction,
                "content": payload["content"],
                "media_url": payload.get("media_url"),
                "timestamp": payload.get("timestamp"),
                "is_history_import": is_history_import,
                "reply_to_message_id": None,
                "forward_from_message_id": None,
                "provider_event_id": payload["event_id"],
                "provider_message_id": payload["event_id"],
                "external_account_id": payload.get("external_account_id"),
            },
        )
        # A history import backfills the past - notifying the owner about dozens of
        # old messages (and self-sent ones, which were never notify-worthy at all)
        # would just spam them. Only a live inbound message is worth a notification.
        if not is_history_import and direction == "inbound":
            await self.create_notification(
                user_id=user_id,
                notification_type="message",
                title=f"New {platform} message",
                body=payload["content"],
            )
        return message

    async def handle_inbound_webhook(self, user_id: str, platform: str, payload: dict) -> dict:
        payload = self.normalize_webhook_payload(platform, payload)
        message = await self._record_inbound_message(user_id, platform, payload, is_history_import=False)
        if message is None:
            return {"status": "ignored", "reason": "duplicate_event"}
        await self.db.social_integrations.update_one(
            {"user_id": user_id, "platform": platform},
            {"$set": {"last_webhook_at": utc_now(), "webhook_status": "active", "updated_at": utc_now()}},
        )
        return {"status": "processed", "message": message}

    async def handle_meta_webhook(self, platform: str, payload: dict) -> dict:
        """One Meta delivery (Messenger, Instagram, or WhatsApp Cloud API): possibly several
        entries/events, each belonging to whichever connected account its entry id names.
        Events for accounts we don't know, duplicates, and non-message events are counted
        as ignored - the caller answers 200 regardless, as Meta requires."""
        events = get_social_provider_adapter(platform).normalize_webhook_events(payload)
        processed = 0
        ignored = 0
        for event in events:
            integration = None
            if event.external_account_id:
                integration = await self.db.social_integrations.find_one(
                    {"platform": platform, "status": "connected", "external_account_id": str(event.external_account_id)}
                )
            if not integration:
                ignored += 1
                continue
            user_id = await self._real_integration_owner_id(integration)
            message = await self._record_inbound_message(user_id, platform, event.to_payload(), is_history_import=False)
            if message is None:
                ignored += 1
                continue
            processed += 1
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {"$set": {"last_webhook_at": utc_now(), "webhook_status": "active", "updated_at": utc_now()}},
            )
            if platform == "facebook_messenger" and event.direction == "inbound":
                await self._enrich_messenger_contact_name(user_id, integration, event.contact_external_id)
        return {"status": "processed", "processed": processed, "ignored": ignored}

    async def _enrich_messenger_contact_name(self, user_id: str, integration: dict, psid: str) -> None:
        """Messenger events carry only a page-scoped id, so a new contact would be stuck as
        "Facebook Contact". Look the person's name up once (Page token, best-effort) and only
        while the contact still has the placeholder name - a name the owner set is never
        overwritten, and a Graph failure never affects message delivery."""
        try:
            placeholder = f"{self._platform_label('facebook_messenger')} Contact"
            contact = await self.db.contacts.find_one(
                {
                    "user_id": user_id,
                    "name": placeholder,
                    "identities": {"$elemMatch": {"platform": "facebook_messenger", "external_id": psid}},
                }
            )
            token = self._decrypt_integration_token(integration)
            if not contact or not token:
                return
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(
                    f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/{psid}",
                    params={"fields": "name", "access_token": token},
                )
            name = (response.json().get("name") or "").strip() if response.status_code == 200 else ""
            if not name:
                return
            await self.db.contacts.update_one({"_id": contact["_id"]}, {"$set": {"name": name, "updated_at": utc_now()}})
            await self.db.conversations.update_many(
                {"user_id": user_id, "contact_id": str(contact["_id"]), "platform": "facebook_messenger", "title": placeholder},
                {"$set": {"title": name}},
            )
        except Exception:
            logger.warning("Messenger contact name lookup failed for %s", psid, exc_info=True)

    _HISTORY_CONNECTED_CHECK_EVERY = 25

    async def handle_inbound_webhook_batch(self, user_id: str, platform: str, messages: list[dict]) -> dict:
        """Bulk variant for a WhatsApp history-sync import: same per-message handling
        as a live webhook, just without notifications/unread bumps and tolerant of
        a single bad entry in an otherwise-good batch."""
        imported = 0
        skipped = 0
        for index, raw in enumerate(messages):
            # A history batch can take minutes to store; a disconnect mid-import must
            # stop it, not keep filling the inbox the user just cut off.
            if index and index % self._HISTORY_CONNECTED_CHECK_EVERY == 0 and not await self.db.social_integrations.find_one(
                {"user_id": user_id, "platform": platform, "status": "connected"}, {"_id": 1}
            ):
                skipped += len(messages) - index
                break
            try:
                payload = self.normalize_webhook_payload(platform, raw)
            except AppException:
                skipped += 1
                continue
            message = await self._record_inbound_message(user_id, platform, payload, is_history_import=True)
            if message is None:
                skipped += 1
            else:
                imported += 1
        if imported:
            await self.db.social_integrations.update_one(
                {"user_id": user_id, "platform": platform},
                {"$set": {"webhook_status": "active", "updated_at": utc_now()}},
            )
        return {"status": "processed", "imported": imported, "skipped": skipped}

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
    def _secrets_match(provided: str | None, expected: str) -> bool:
        return bool(provided) and hmac.compare_digest(str(provided).encode(), expected.encode())

    @staticmethod
    def _require_webhook_auth_configured() -> None:
        """Webhook auth must fail closed. An empty secret used to mean "accept
        everything", which let anyone inject messages for any tenant via ?user_id=.
        Only local development may run without one."""
        if settings.ENVIRONMENT.lower() != "development":
            raise AppException(status_code=401, code="WEBHOOK_UNAUTHORIZED", message="Webhook authentication is not configured.")

    @staticmethod
    def validate_webhook_secret(secret: str | None) -> None:
        configured = settings.WEBHOOK_SHARED_SECRET
        if not configured:
            IntegrationService._require_webhook_auth_configured()
            return
        if not IntegrationService._secrets_match(secret, configured):
            raise AppException(status_code=401, code="WEBHOOK_UNAUTHORIZED", message="Webhook secret is invalid.")

    async def validate_platform_webhook_secret(self, user_id: str, platform: str, secret: str | None) -> None:
        secret_field = {"telegram": "telegram_secret_token", "whatsapp": "whatsapp_secret_token"}.get(platform)
        if not secret_field:
            self.validate_webhook_secret(secret)
            return

        integration = await self.db.social_integrations.find_one({"user_id": user_id, "platform": platform})
        expected = (integration or {}).get(secret_field)

        if platform == "whatsapp":
            # A whatsapp integration with no stored secret was never connected through
            # start_whatsapp_connect - never fall through to the global shared secret,
            # that would resurrect the guessable-user_id gap.
            if not expected or not self._secrets_match(secret, expected):
                raise AppException(status_code=401, code="WEBHOOK_UNAUTHORIZED", message="Webhook secret is invalid.")
            return

        expected = expected or settings.WEBHOOK_SHARED_SECRET
        if not expected:
            self._require_webhook_auth_configured()
            return
        if not self._secrets_match(secret, expected):
            raise AppException(status_code=401, code="WEBHOOK_UNAUTHORIZED", message="Webhook secret is invalid.")

    async def _real_integration_owner_id(self, integration: dict) -> str:
        """WhatsApp records written by an earlier version carry the organization id
        (a UUID in real data) as user_id. Everything downstream - contacts,
        conversations, push notifications - needs a real user, so repair the record
        the first time an inbound message resolves through it, rather than waiting
        for someone to open the Integrations page."""
        owner_id = str(integration["user_id"])
        if ObjectId.is_valid(owner_id) or not integration.get("organization_id"):
            return owner_id
        member = await self.db.users.find_one({"organization_id": integration["organization_id"], "role": "owner"}, {"_id": 1})
        member = member or await self.db.users.find_one({"organization_id": integration["organization_id"]}, {"_id": 1})
        if not member:
            return owner_id
        owner_id = str(member["_id"])
        await self.db.social_integrations.update_one({"_id": integration["_id"]}, {"$set": {"user_id": owner_id}})
        return owner_id

    async def resolve_webhook_user_id(self, platform: str, payload: dict, secret: str | None = None) -> str:
        secret_field = {"telegram": "telegram_secret_token", "whatsapp": "whatsapp_secret_token"}.get(platform)
        if secret_field and secret:
            integration = await self.db.social_integrations.find_one(
                {"platform": platform, "status": "connected", secret_field: secret}
            )
            if integration:
                return await self._real_integration_owner_id(integration)

        normalized = get_social_provider_adapter(platform).normalize_webhook(payload)
        external_account_id = normalized.external_account_id if normalized else None
        if external_account_id:
            integration = await self.db.social_integrations.find_one(
                {"platform": platform, "status": "connected", "external_account_id": str(external_account_id)}
            )
            if integration:
                return await self._real_integration_owner_id(integration)

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
