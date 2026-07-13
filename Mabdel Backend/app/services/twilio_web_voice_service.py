from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException

TWILIO_BASE = "https://api.twilio.com/2010-04-01"
VOICE_RUNTIME_SETTINGS_TYPE = "twilio_web_voice_runtime_v1"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TwilioWebVoiceService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    @staticmethod
    def build_identity(user_id: str) -> str:
        return f"{settings.TWILIO_VOICE_IDENTITY_PREFIX}-{user_id}"

    @staticmethod
    def build_outbound_voice_url() -> str:
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/twilio/voice/outbound"

    @staticmethod
    def _master_auth() -> tuple[str, str]:
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            raise AppException(
                status_code=503,
                code="TWILIO_NOT_CONFIGURED",
                message="Twilio master account is not configured on this server.",
            )
        return settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN

    async def ensure_runtime(self) -> dict:
        voice_url = self.build_outbound_voice_url()
        runtime_doc = await self.db.settings.find_one({"type": VOICE_RUNTIME_SETTINGS_TYPE})

        if settings.TWILIO_VOICE_API_KEY_SID and settings.TWILIO_VOICE_API_KEY_SECRET and settings.TWILIO_VOICE_TWIML_APP_SID:
            await self._ensure_platform_number_webhook()
            return {
                "account_sid": settings.TWILIO_ACCOUNT_SID,
                "api_key_sid": settings.TWILIO_VOICE_API_KEY_SID,
                "api_key_secret": settings.TWILIO_VOICE_API_KEY_SECRET,
                "twiml_app_sid": settings.TWILIO_VOICE_TWIML_APP_SID,
                "voice_url": voice_url,
            }

        if runtime_doc:
            api_key_secret_enc = runtime_doc.get("api_key_secret_enc")
            if runtime_doc.get("voice_url") != voice_url and runtime_doc.get("twiml_app_sid"):
                await self._update_twiml_app(runtime_doc["twiml_app_sid"], voice_url)
                await self.db.settings.update_one(
                    {"_id": runtime_doc["_id"]},
                    {"$set": {"voice_url": voice_url, "updated_at": utc_now()}},
                )
            if runtime_doc.get("api_key_sid") and api_key_secret_enc and runtime_doc.get("twiml_app_sid"):
                await self._ensure_platform_number_webhook()
                return {
                    "account_sid": settings.TWILIO_ACCOUNT_SID,
                    "api_key_sid": runtime_doc["api_key_sid"],
                    "api_key_secret": decrypt_value(api_key_secret_enc),
                    "twiml_app_sid": runtime_doc["twiml_app_sid"],
                    "voice_url": voice_url,
                }

        twiml_app_sid = await self._create_twiml_app(voice_url)
        api_key_sid, api_key_secret = await self._create_api_key()
        await self.db.settings.update_one(
            {"type": VOICE_RUNTIME_SETTINGS_TYPE},
            {
                "$set": {
                    "type": VOICE_RUNTIME_SETTINGS_TYPE,
                    "account_sid": settings.TWILIO_ACCOUNT_SID,
                    "api_key_sid": api_key_sid,
                    "api_key_secret_enc": encrypt_value(api_key_secret),
                    "twiml_app_sid": twiml_app_sid,
                    "voice_url": voice_url,
                    "updated_at": utc_now(),
                }
            },
            upsert=True,
        )
        await self._ensure_platform_number_webhook()
        return {
            "account_sid": settings.TWILIO_ACCOUNT_SID,
            "api_key_sid": api_key_sid,
            "api_key_secret": api_key_secret,
            "twiml_app_sid": twiml_app_sid,
            "voice_url": voice_url,
        }

    async def create_access_token(self, user_id: str) -> dict:
        runtime = await self.ensure_runtime()
        identity = self.build_identity(user_id)
        expires_at = utc_now() + timedelta(seconds=settings.TWILIO_VOICE_TOKEN_EXPIRE_SECONDS)
        token = AccessToken(
            runtime["account_sid"],
            runtime["api_key_sid"],
            runtime["api_key_secret"],
            identity=identity,
            ttl=settings.TWILIO_VOICE_TOKEN_EXPIRE_SECONDS,
        )
        token.add_grant(
            VoiceGrant(
                outgoing_application_sid=runtime["twiml_app_sid"],
                incoming_allow=True,
            )
        )
        await self.set_registration(user_id=user_id, identity=identity, active=True)
        return {
            "token": token.to_jwt(),
            "identity": identity,
            "expires_at": expires_at.isoformat(),
            "phone_number": settings.TWILIO_PHONE_NUMBER,
        }

    async def set_registration(self, *, user_id: str, identity: str, active: bool) -> None:
        expires_at = utc_now() + timedelta(seconds=settings.TWILIO_VOICE_REGISTRATION_TTL_SECONDS)
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
            {
                "user_id": user_id,
                "active": True,
                "expires_at": {"$gt": utc_now()},
            }
        )

    async def get_latest_active_registration(self) -> dict | None:
        cursor = (
            self.db.voice_device_registrations.find(
                {"active": True, "expires_at": {"$gt": utc_now()}}
            )
            .sort("updated_at", -1)
            .limit(1)
        )
        registrations = await cursor.to_list(length=1)
        return registrations[0] if registrations else None

    @staticmethod
    def build_browser_status_callback_url(*, user_id: str, call_log_id: str) -> str:
        base = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/status"
        return f"{base}?{urlencode({'user_id': user_id, 'call_log_id': call_log_id})}"

    @staticmethod
    def build_browser_recording_callback_url(*, user_id: str) -> str:
        base = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/recording"
        return f"{base}?{urlencode({'user_id': user_id})}"

    async def _create_api_key(self) -> tuple[str, str]:
        sid, token = self._master_auth()
        async with httpx.AsyncClient(auth=(sid, token), timeout=20.0) as client:
            response = await client.post(
                f"{TWILIO_BASE}/Accounts/{sid}/Keys.json",
                data={"FriendlyName": "Mabdel Web Voice"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=503,
                code="TWILIO_API_KEY_CREATE_FAILED",
                message="Twilio Voice API key could not be created.",
                details=self._response_details(response),
            )
        payload = response.json()
        return payload["sid"], payload["secret"]

    async def _create_twiml_app(self, voice_url: str) -> str:
        sid, token = self._master_auth()
        async with httpx.AsyncClient(auth=(sid, token), timeout=20.0) as client:
            response = await client.post(
                f"{TWILIO_BASE}/Accounts/{sid}/Applications.json",
                data={
                    "FriendlyName": "Mabdel Web Voice",
                    "VoiceUrl": voice_url,
                    "VoiceMethod": "POST",
                },
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=503,
                code="TWILIO_TWIML_APP_CREATE_FAILED",
                message="Twilio Voice application could not be created.",
                details=self._response_details(response),
            )
        return response.json()["sid"]

    async def _update_twiml_app(self, twiml_app_sid: str, voice_url: str) -> None:
        sid, token = self._master_auth()
        async with httpx.AsyncClient(auth=(sid, token), timeout=20.0) as client:
            response = await client.post(
                f"{TWILIO_BASE}/Accounts/{sid}/Applications/{twiml_app_sid}.json",
                data={"VoiceUrl": voice_url, "VoiceMethod": "POST"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=503,
                code="TWILIO_TWIML_APP_UPDATE_FAILED",
                message="Twilio Voice application could not be updated.",
                details=self._response_details(response),
            )

    async def _ensure_platform_number_webhook(self) -> None:
        if not settings.TWILIO_PHONE_NUMBER:
            return
        sid, token = self._master_auth()
        incoming_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/incoming"
        status_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/status"
        async with httpx.AsyncClient(auth=(sid, token), timeout=20.0) as client:
            response = await client.get(
                f"{TWILIO_BASE}/Accounts/{sid}/IncomingPhoneNumbers.json",
                params={"PhoneNumber": settings.TWILIO_PHONE_NUMBER},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=503,
                code="TWILIO_NUMBER_LOOKUP_FAILED",
                message="Twilio phone number could not be looked up for web calling.",
                details=self._response_details(response),
            )

        numbers = response.json().get("incoming_phone_numbers", [])
        if not numbers:
            return

        number_sid = numbers[0]["sid"]
        async with httpx.AsyncClient(auth=(sid, token), timeout=20.0) as client:
            update_response = await client.post(
                f"{TWILIO_BASE}/Accounts/{sid}/IncomingPhoneNumbers/{number_sid}.json",
                data={
                    "VoiceUrl": incoming_url,
                    "VoiceMethod": "POST",
                    "StatusCallback": status_url,
                    "StatusCallbackMethod": "POST",
                },
            )
        if update_response.status_code >= 400:
            raise AppException(
                status_code=503,
                code="TWILIO_NUMBER_UPDATE_FAILED",
                message="Twilio phone number webhook could not be updated for web calling.",
                details=self._response_details(update_response),
            )

    @staticmethod
    def _response_details(response: httpx.Response) -> dict:
        try:
            return response.json()
        except ValueError:
            return {"body": response.text}
