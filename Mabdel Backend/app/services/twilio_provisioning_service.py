from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from functools import partial

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

TWILIO_BASE = "https://api.twilio.com/2010-04-01"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _master_auth() -> tuple[str, str]:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise AppException(
            status_code=503,
            code="TWILIO_NOT_CONFIGURED",
            message="Twilio master account is not configured on this server.",
        )
    return settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN


def _twilio_raise(resp: httpx.Response, context: str) -> None:
    if resp.status_code >= 400:
        try:
            msg = resp.json().get("message", resp.text)
        except Exception:
            msg = resp.text
        raise AppException(
            status_code=503,
            code="TWILIO_API_ERROR",
            message=f"Twilio error during {context}: {msg}",
        )


def _provision_sync(user_id: str, country: str) -> dict:
    sid, token = _master_auth()

    with httpx.Client(auth=(sid, token), timeout=30) as client:
        # 1. Create sub-account
        resp = client.post(
            f"{TWILIO_BASE}/Accounts.json",
            data={"FriendlyName": f"mabdel-{user_id}"},
        )
        _twilio_raise(resp, "sub-account creation")
        sub = resp.json()
        sub_sid = sub["sid"]
        sub_token = sub["auth_token"]

        sub_client = httpx.Client(auth=(sub_sid, sub_token), timeout=30)

        # 2. Find an available local number
        phone_number = None
        for number_type in ("Local", "TollFree"):
            try:
                r = sub_client.get(
                    f"{TWILIO_BASE}/Accounts/{sub_sid}/AvailablePhoneNumbers/{country}/{number_type}.json",
                    params={"VoiceEnabled": "true", "PageSize": 1},
                )
                if r.status_code == 200:
                    numbers = r.json().get("available_phone_numbers", [])
                    if numbers:
                        phone_number = numbers[0]["phone_number"]
                        break
            except Exception:
                continue

        if not phone_number:
            # Close sub-account before raising
            try:
                sub_client.post(
                    f"{TWILIO_BASE}/Accounts/{sub_sid}.json",
                    data={"Status": "closed"},
                )
            except Exception:
                pass
            sub_client.close()
            raise AppException(
                status_code=503,
                code="NO_NUMBER_AVAILABLE",
                message=f"No voice-enabled numbers available in country '{country}'.",
            )

        # 3. Purchase the number
        incoming_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/incoming"
        status_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/status"

        resp2 = sub_client.post(
            f"{TWILIO_BASE}/Accounts/{sub_sid}/IncomingPhoneNumbers.json",
            data={
                "PhoneNumber": phone_number,
                "VoiceUrl": incoming_url,
                "VoiceMethod": "POST",
                "StatusCallback": status_url,
                "StatusCallbackMethod": "POST",
            },
        )
        sub_client.close()
        _twilio_raise(resp2, "number purchase")
        purchased = resp2.json()

        return {
            "sub_account_sid": sub_sid,
            "sub_auth_token": sub_token,
            "phone_number": purchased["phone_number"],
        }


def _release_sync(sub_sid: str, sub_token_enc: str) -> None:
    try:
        sub_token = decrypt_value(sub_token_enc)
        with httpx.Client(auth=(sub_sid, sub_token), timeout=20) as client:
            # List and delete numbers
            r = client.get(f"{TWILIO_BASE}/Accounts/{sub_sid}/IncomingPhoneNumbers.json")
            if r.status_code == 200:
                for num in r.json().get("incoming_phone_numbers", []):
                    client.delete(
                        f"{TWILIO_BASE}/Accounts/{sub_sid}/IncomingPhoneNumbers/{num['sid']}.json"
                    )
            # Close the sub-account
            client.post(
                f"{TWILIO_BASE}/Accounts/{sub_sid}.json",
                data={"Status": "closed"},
            )
    except Exception as exc:
        logger.warning("Failed to cleanly release Twilio sub-account %s: %s", sub_sid, exc)


class TwilioProvisioningService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def provision_user(self, user_id: str) -> dict:
        user_oid = ObjectId(user_id)
        user = await self.db.users.find_one({"_id": user_oid})
        if not user:
            raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

        if user.get("twilio_setup_status") == "active":
            return {
                "twilio_phone_number": user.get("twilio_phone_number"),
                "twilio_setup_status": "active",
                "twilio_sub_account_sid": user.get("twilio_sub_account_sid"),
            }

        await self.db.users.update_one(
            {"_id": user_oid},
            {"$set": {"twilio_setup_status": "provisioning", "updated_at": _utc_now()}},
        )

        country = settings.TWILIO_NUMBER_COUNTRY
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None, partial(_provision_sync, user_id, country)
            )
        except AppException:
            await self.db.users.update_one(
                {"_id": user_oid},
                {"$set": {"twilio_setup_status": "failed", "updated_at": _utc_now()}},
            )
            raise
        except Exception as exc:
            await self.db.users.update_one(
                {"_id": user_oid},
                {"$set": {"twilio_setup_status": "failed", "updated_at": _utc_now()}},
            )
            logger.exception("Twilio provisioning failed for user %s", user_id)
            raise AppException(
                status_code=503,
                code="PROVISIONING_FAILED",
                message=f"Twilio provisioning failed: {exc}",
            ) from exc

        encrypted_token = encrypt_value(result["sub_auth_token"])
        await self.db.users.update_one(
            {"_id": user_oid},
            {
                "$set": {
                    "twilio_sub_account_sid": result["sub_account_sid"],
                    "twilio_sub_auth_token_enc": encrypted_token,
                    "twilio_phone_number": result["phone_number"],
                    "twilio_setup_status": "active",
                    "updated_at": _utc_now(),
                }
            },
        )

        return {
            "twilio_phone_number": result["phone_number"],
            "twilio_setup_status": "active",
            "twilio_sub_account_sid": result["sub_account_sid"],
        }

    async def release_user(self, user_id: str) -> None:
        user_oid = ObjectId(user_id)
        user = await self.db.users.find_one({"_id": user_oid})
        if not user:
            return

        sub_sid = user.get("twilio_sub_account_sid")
        sub_token_enc = user.get("twilio_sub_auth_token_enc")

        if sub_sid and sub_token_enc:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, partial(_release_sync, sub_sid, sub_token_enc))

        await self.db.users.update_one(
            {"_id": user_oid},
            {
                "$unset": {
                    "twilio_sub_account_sid": "",
                    "twilio_sub_auth_token_enc": "",
                    "twilio_phone_number": "",
                },
                "$set": {"twilio_setup_status": "not_provisioned", "updated_at": _utc_now()},
            },
        )

    async def save_custom_credentials(
        self,
        user_id: str,
        account_sid: str,
        auth_token: str,
        phone_number: str,
    ) -> dict:
        """
        Validates and saves the user's own Twilio credentials.
        Makes a test API call to confirm the credentials work before saving.
        """
        # Validate credentials by hitting the Twilio account endpoint
        try:
            with httpx.Client(auth=(account_sid, auth_token), timeout=15) as client:
                resp = client.get(f"{TWILIO_BASE}/Accounts/{account_sid}.json")
            if resp.status_code == 401:
                raise AppException(
                    status_code=400,
                    code="INVALID_TWILIO_CREDENTIALS",
                    message="Invalid Account SID or Auth Token. Please check your Twilio credentials.",
                )
            if resp.status_code >= 400:
                raise AppException(
                    status_code=400,
                    code="TWILIO_VALIDATION_FAILED",
                    message="Could not verify Twilio credentials. Please check and try again.",
                )
        except AppException:
            raise
        except Exception as exc:
            raise AppException(
                status_code=503,
                code="TWILIO_UNREACHABLE",
                message=f"Could not reach Twilio to validate credentials: {exc}",
            ) from exc

        # Format phone number
        pn = phone_number.strip()
        if not pn.startswith("+"):
            pn = "+" + pn

        encrypted_token = encrypt_value(auth_token)
        user_oid = ObjectId(user_id)
        await self.db.users.update_one(
            {"_id": user_oid},
            {
                "$set": {
                    "twilio_mode": "custom",
                    "twilio_custom_account_sid": account_sid.strip(),
                    "twilio_custom_auth_token_enc": encrypted_token,
                    "twilio_custom_phone_number": pn,
                    "updated_at": _utc_now(),
                }
            },
        )
        return {
            "twilio_mode": "custom",
            "twilio_custom_phone_number": pn,
            "twilio_custom_account_sid": account_sid.strip(),
        }

    async def remove_custom_credentials(self, user_id: str) -> None:
        user_oid = ObjectId(user_id)
        await self.db.users.update_one(
            {"_id": user_oid},
            {
                "$unset": {
                    "twilio_custom_account_sid": "",
                    "twilio_custom_auth_token_enc": "",
                    "twilio_custom_phone_number": "",
                },
                "$set": {"twilio_mode": "not_set", "updated_at": _utc_now()},
            },
        )

    async def get_status(self, user_id: str) -> dict:
        user_oid = ObjectId(user_id)
        user = await self.db.users.find_one({"_id": user_oid})
        if not user:
            raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")
        return {
            "twilio_setup_status": user.get("twilio_setup_status", "not_provisioned"),
            "twilio_phone_number": user.get("twilio_phone_number"),
            "twilio_sub_account_sid": user.get("twilio_sub_account_sid"),
            "twilio_mode": user.get("twilio_mode", "not_set"),
            "twilio_custom_phone_number": user.get("twilio_custom_phone_number"),
            "twilio_custom_account_sid": user.get("twilio_custom_account_sid"),
        }

    @staticmethod
    def get_user_phone_number(user: dict) -> str | None:
        mode = user.get("twilio_mode", "not_set")
        if mode == "custom":
            return user.get("twilio_custom_phone_number")
        return user.get("twilio_phone_number") or settings.TWILIO_PHONE_NUMBER

    @staticmethod
    def make_outbound_call_sync(
        user: dict,
        to_number: str,
        twiml_url: str,
    ) -> dict:
        """Makes an outbound call using the user's sub-account or master account."""
        sub_sid = user.get("twilio_sub_account_sid")
        sub_token_enc = user.get("twilio_sub_auth_token_enc")
        from_number = user.get("twilio_phone_number") or settings.TWILIO_PHONE_NUMBER

        if sub_sid and sub_token_enc:
            try:
                call_sid = sub_sid
                call_token = decrypt_value(sub_token_enc)
            except Exception:
                call_sid, call_token = _master_auth()
        else:
            call_sid, call_token = _master_auth()

        with httpx.Client(auth=(call_sid, call_token), timeout=20) as client:
            resp = client.post(
                f"{TWILIO_BASE}/Accounts/{call_sid}/Calls.json",
                data={
                    "To": to_number,
                    "From": from_number,
                    "Url": twiml_url,
                },
            )
            _twilio_raise(resp, "outbound call")
            return resp.json()
