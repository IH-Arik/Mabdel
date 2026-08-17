from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import telnyx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

VOICE_RUNTIME_SETTINGS_TYPE = "telnyx_web_voice_runtime_v1"
# Telnyx JWTs are valid 24h; we hand the browser a fresh one well before that so a
# background tab never gets caught mid-call with an expired socket.
TOKEN_TTL_SECONDS = 24 * 60 * 60
TOKEN_REFRESH_MARGIN_SECONDS = 4 * 60 * 60
REGISTRATION_TTL_SECONDS = 180


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TelnyxWebVoiceService:
    """Browser (WebRTC) calling on Telnyx.

    Unlike Twilio's model (a TwiML App webhook the platform must host, hit on every
    outbound browser call), Telnyx's On-Demand Credentials dial PSTN numbers directly
    from the browser — the backend only issues short-lived login tokens and never sees
    an outbound call until Telnyx's webhook reports it, the same webhook Phase 1 already
    built for phone-number calls (app.api.v1.endpoints.calls.telnyx_call_webhook).
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    def _client(self) -> telnyx.Client:
        if not settings.TELNYX_API_KEY:
            raise AppException(status_code=503, code="TELNYX_NOT_CONFIGURED", message="Telnyx is not configured on this server.")
        return telnyx.Client(api_key=settings.TELNYX_API_KEY)

    async def ensure_connection(self) -> str:
        """Find-or-create the one shared Credential Connection every user's on-demand
        credential is issued under. Its webhook_event_url is the same unified endpoint
        phone-number calls use, so browser call events land in the same call_logs flow."""
        runtime_doc = await self.db.settings.find_one({"type": VOICE_RUNTIME_SETTINGS_TYPE})
        webhook_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/webhook"

        if runtime_doc and runtime_doc.get("connection_id"):
            if runtime_doc.get("webhook_url") != webhook_url:
                await self._update_connection_webhook(runtime_doc["connection_id"], webhook_url)
                await self.db.settings.update_one(
                    {"_id": runtime_doc["_id"]},
                    {"$set": {"webhook_url": webhook_url, "updated_at": utc_now()}},
                )
            return runtime_doc["connection_id"]

        connection_id = await self._create_connection(webhook_url)
        await self.db.settings.update_one(
            {"type": VOICE_RUNTIME_SETTINGS_TYPE},
            {
                "$set": {
                    "type": VOICE_RUNTIME_SETTINGS_TYPE,
                    "connection_id": connection_id,
                    "webhook_url": webhook_url,
                    "updated_at": utc_now(),
                }
            },
            upsert=True,
        )
        return connection_id

    async def ensure_user_credential(self, user_id: str) -> dict:
        """Find-or-create this user's on-demand credential (their SIP identity)."""
        user_oid = ObjectId(user_id)
        user = await self.db.users.find_one({"_id": user_oid})
        if not user:
            raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

        if user.get("telnyx_credential_id") and user.get("telnyx_sip_username"):
            return {
                "credential_id": user["telnyx_credential_id"],
                "sip_username": user["telnyx_sip_username"],
            }

        connection_id = await self.ensure_connection()
        client = self._client()
        try:
            response = client.telephony_credentials.create(
                connection_id=connection_id,
                name=f"mabdel-web-{user_id}",
            )
        except telnyx.TelnyxError as exc:
            raise AppException(
                status_code=503,
                code="TELNYX_CREDENTIAL_CREATE_FAILED",
                message=f"Telnyx web voice credential could not be created: {exc}",
            ) from exc

        credential = response.data
        credential_id = credential.id if credential else None
        sip_username = credential.sip_username if credential else None
        if not credential_id or not sip_username:
            raise AppException(
                status_code=503,
                code="TELNYX_CREDENTIAL_CREATE_FAILED",
                message="Telnyx did not return a usable web voice credential.",
            )

        await self.db.users.update_one(
            {"_id": user_oid},
            {"$set": {"telnyx_credential_id": credential_id, "telnyx_sip_username": sip_username, "updated_at": utc_now()}},
        )
        return {"credential_id": credential_id, "sip_username": sip_username}

    async def create_access_token(self, user_id: str) -> dict:
        credential = await self.ensure_user_credential(user_id)
        client = self._client()
        try:
            token = client.telephony_credentials.create_token(credential["credential_id"])
        except telnyx.TelnyxError as exc:
            raise AppException(
                status_code=503,
                code="TELNYX_TOKEN_CREATE_FAILED",
                message=f"Telnyx web voice token could not be created: {exc}",
            ) from exc

        user_oid = ObjectId(user_id)
        user = await self.db.users.find_one({"_id": user_oid})
        if not user:
            raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

        from app.services.telnyx_provisioning_service import TelnyxProvisioningService
        prov_service = TelnyxProvisioningService(self.db)
        org = await prov_service.get_organization_for_user(user)
        resolved_phone_number = prov_service.get_org_phone_number(org) or settings.TELNYX_PHONE_NUMBER
        print(f"[DEBUG_TOKEN] user_id: {user_id}, org_id: {user.get('organization_id')}, resolved_phone_number: {resolved_phone_number}")

        identity = credential["sip_username"]
        expires_at = utc_now() + timedelta(seconds=TOKEN_TTL_SECONDS)
        await self.set_registration(user_id=user_id, identity=identity, active=True)
        return {
            "token": token,
            "identity": identity,
            "expires_at": expires_at.isoformat(),
            "refresh_after_seconds": TOKEN_TTL_SECONDS - TOKEN_REFRESH_MARGIN_SECONDS,
            "phone_number": resolved_phone_number,
        }

    async def set_registration(self, *, user_id: str, identity: str, active: bool) -> None:
        expires_at = utc_now() + timedelta(seconds=REGISTRATION_TTL_SECONDS)
        await self.db.voice_device_registrations.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "identity": identity,
                    "active": active,
                    "expires_at": expires_at if active else utc_now(),
                    "updated_at": utc_now(),
                }
            },
            upsert=True,
        )

    async def get_active_registration(self, user_id: str) -> dict | None:
        return await self.db.voice_device_registrations.find_one(
            {"user_id": user_id, "active": True, "expires_at": {"$gt": utc_now()}}
        )

    async def get_latest_active_registration(self) -> dict | None:
        cursor = (
            self.db.voice_device_registrations.find({"active": True, "expires_at": {"$gt": utc_now()}})
            .sort("updated_at", -1)
            .limit(1)
        )
        registrations = await cursor.to_list(length=1)
        return registrations[0] if registrations else None

    async def get_latest_active_registration_for_users(self, user_ids: list[str]) -> dict | None:
        """The most recently active browser session among a set of users — used to
        find *anyone* on the team currently live in the dialer for an org-wide number,
        not just one specific person."""
        if not user_ids:
            return None
        cursor = (
            self.db.voice_device_registrations.find(
                {"user_id": {"$in": user_ids}, "active": True, "expires_at": {"$gt": utc_now()}}
            )
            .sort("updated_at", -1)
            .limit(1)
        )
        registrations = await cursor.to_list(length=1)
        return registrations[0] if registrations else None

    async def _create_connection(self, webhook_url: str) -> str:
        client = self._client()
        try:
            response = client.credential_connections.create(
                connection_name=f"mabdel-web-voice-{int(utc_now().timestamp())}",
                user_name=f"mabdelweb{int(utc_now().timestamp())}",
                password=_generate_connection_password(),
                webhook_event_url=webhook_url,
                sip_uri_calling_preference="disabled",
            )
        except telnyx.TelnyxError as exc:
            raise AppException(
                status_code=503,
                code="TELNYX_CONNECTION_CREATE_FAILED",
                message=f"Telnyx web voice connection could not be created: {exc}",
            ) from exc

        connection_id = response.data.id if response.data else None
        if not connection_id:
            raise AppException(
                status_code=503,
                code="TELNYX_CONNECTION_CREATE_FAILED",
                message="Telnyx did not return a usable connection id.",
            )
        return connection_id

    async def _update_connection_webhook(self, connection_id: str, webhook_url: str) -> None:
        client = self._client()
        try:
            client.credential_connections.update(connection_id, webhook_event_url=webhook_url)
        except telnyx.TelnyxError as exc:
            logger.warning("Could not update Telnyx web voice connection webhook: %s", exc)


def _generate_connection_password() -> str:
    import secrets

    return secrets.token_urlsafe(24)
