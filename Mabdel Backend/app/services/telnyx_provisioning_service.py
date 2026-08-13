from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from functools import partial

import telnyx
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

# Telnyx orders numbers instantly for most countries, but polling briefly covers the
# occasional order that finishes just after the initial response.
_ORDER_POLL_ATTEMPTS = 5
_ORDER_POLL_DELAY_SECONDS = 1.5


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _master_client(api_key: str | None = None) -> telnyx.Client:
    key = api_key or settings.TELNYX_API_KEY
    if not key:
        raise AppException(
            status_code=503,
            code="TELNYX_NOT_CONFIGURED",
            message="Telnyx is not configured on this server.",
        )
    return telnyx.Client(api_key=key)


def _telnyx_raise(exc: telnyx.TelnyxError, context: str) -> None:
    raise AppException(
        status_code=503,
        code="TELNYX_API_ERROR",
        message=f"Telnyx error during {context}: {exc}",
    )


def _provision_sync(organization_id: str, country: str) -> dict:
    """Find and order a voice-enabled number, attached to our Call Control Application.

    One number per organization (business), not per user. Telnyx has no per-tenant
    "sub-account" the way Twilio does; every number is ordered under the one platform
    API key and tagged to the organization in our own database instead. Routing an
    inbound call to the right business happens by looking up the ``To`` number there.
    """
    client = _master_client()

    try:
        available = client.available_phone_numbers.list(
            filter={
                "country_code": country,
                "features": ["voice"],
                "limit": 1,
                "phone_number_type": "local",
            }
        )
    except telnyx.TelnyxError as exc:
        _telnyx_raise(exc, "number search")

    candidates = available.data or []
    if not candidates:
        try:
            available = client.available_phone_numbers.list(
                filter={"country_code": country, "features": ["voice"], "limit": 1, "phone_number_type": "toll_free"}
            )
            candidates = available.data or []
        except telnyx.TelnyxError:
            candidates = []

    if not candidates:
        raise AppException(
            status_code=503,
            code="NO_NUMBER_AVAILABLE",
            message=f"No voice-enabled numbers available in country '{country}'.",
        )

    phone_number = candidates[0].phone_number

    try:
        order = client.number_orders.create(
            phone_numbers=[{"phone_number": phone_number}],
            connection_id=settings.TELNYX_VOICE_APPLICATION_ID or telnyx.NOT_GIVEN,
            messaging_profile_id=settings.TELNYX_MESSAGING_PROFILE_ID or telnyx.NOT_GIVEN,
            customer_reference=f"mabdel-org-{organization_id}",
        )
    except telnyx.TelnyxError as exc:
        _telnyx_raise(exc, "number order")

    order_data = order.data
    order_id = order_data.id if order_data else None
    status_value = order_data.status if order_data else None

    attempts = 0
    while status_value == "pending" and attempts < _ORDER_POLL_ATTEMPTS and order_id:
        import time

        time.sleep(_ORDER_POLL_DELAY_SECONDS)
        try:
            refreshed = client.number_orders.retrieve(order_id)
            status_value = refreshed.data.status if refreshed.data else status_value
        except telnyx.TelnyxError:
            break
        attempts += 1

    if status_value == "failure":
        raise AppException(
            status_code=503,
            code="PROVISIONING_FAILED",
            message=f"Telnyx could not complete the order for {phone_number}.",
        )

    ordered_numbers = order_data.phone_numbers if order_data else None
    ordered_number_id = ordered_numbers[0].id if ordered_numbers else None

    return {
        "phone_number": phone_number,
        "number_order_id": order_id,
        "phone_number_id": ordered_number_id,
    }


def _release_sync(phone_number_id: str) -> None:
    try:
        client = _master_client()
        client.phone_numbers.delete(phone_number_id)
    except Exception as exc:
        logger.warning("Failed to release Telnyx number %s: %s", phone_number_id, exc)


class TelnyxProvisioningService:
    """One Telnyx number per organization (business), shared by every member who has
    the ``calls:manage`` permission (owner + manager by default; extendable to
    specific staff/assistants via a custom RBAC role)."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def provision_organization(self, organization_id: str, requested_by_user_id: str) -> dict:
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        if org and org.get("telnyx_setup_status") == "active":
            return self._status_payload(org)

        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {"telnyx_setup_status": "provisioning", "updated_at": _utc_now()},
                "$setOnInsert": {"organization_id": organization_id, "created_at": _utc_now()},
            },
            upsert=True,
        )

        country = settings.TELNYX_NUMBER_COUNTRY
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(None, partial(_provision_sync, organization_id, country))
        except AppException:
            await self._mark_failed(organization_id)
            raise
        except Exception as exc:
            await self._mark_failed(organization_id)
            logger.exception("Telnyx provisioning failed for organization %s", organization_id)
            raise AppException(
                status_code=503,
                code="PROVISIONING_FAILED",
                message=f"Telnyx provisioning failed: {exc}",
            ) from exc

        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {
                    "telnyx_phone_number": result["phone_number"],
                    "telnyx_phone_number_id": result.get("phone_number_id"),
                    "telnyx_number_order_id": result.get("number_order_id"),
                    "telnyx_setup_status": "active",
                    "provisioned_by_user_id": requested_by_user_id,
                    "updated_at": _utc_now(),
                }
            },
        )
        updated = await self.db.organizations.find_one({"organization_id": organization_id})
        return self._status_payload(updated)

    async def release_organization(self, organization_id: str) -> None:
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        if not org:
            return

        phone_number_id = org.get("telnyx_phone_number_id")
        if phone_number_id:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, partial(_release_sync, phone_number_id))

        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$unset": {
                    "telnyx_phone_number": "",
                    "telnyx_phone_number_id": "",
                    "telnyx_number_order_id": "",
                },
                "$set": {"telnyx_setup_status": "not_provisioned", "updated_at": _utc_now()},
            },
        )

    async def save_custom_credentials(
        self,
        organization_id: str,
        api_key: str,
        phone_number: str,
    ) -> dict:
        """Validates and saves the organization's own Telnyx API key.

        Makes a live call (listing messaging profiles) to confirm the key works
        before saving it — the same "test call before trusting it" pattern the
        Twilio BYO-credentials flow used.
        """
        try:
            client = telnyx.Client(api_key=api_key)
            client.messaging_profiles.list(page_size=1)
        except telnyx.AuthenticationError as exc:
            raise AppException(
                status_code=400,
                code="INVALID_TELNYX_CREDENTIALS",
                message="Invalid Telnyx API key. Please check your credentials.",
            ) from exc
        except telnyx.TelnyxError as exc:
            raise AppException(
                status_code=400,
                code="TELNYX_VALIDATION_FAILED",
                message="Could not verify Telnyx credentials. Please check and try again.",
            ) from exc
        except Exception as exc:
            raise AppException(
                status_code=503,
                code="TELNYX_UNREACHABLE",
                message=f"Could not reach Telnyx to validate credentials: {exc}",
            ) from exc

        pn = phone_number.strip()
        if not pn.startswith("+"):
            pn = "+" + pn

        encrypted_key = encrypt_value(api_key)
        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {
                    "telnyx_mode": "custom",
                    "telnyx_custom_api_key_enc": encrypted_key,
                    "telnyx_custom_phone_number": pn,
                    "updated_at": _utc_now(),
                },
                "$setOnInsert": {"organization_id": organization_id, "created_at": _utc_now()},
            },
            upsert=True,
        )
        return {"telnyx_mode": "custom", "telnyx_custom_phone_number": pn}

    async def remove_custom_credentials(self, organization_id: str) -> None:
        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$unset": {
                    "telnyx_custom_api_key_enc": "",
                    "telnyx_custom_phone_number": "",
                },
                "$set": {"telnyx_mode": "not_set", "updated_at": _utc_now()},
            },
        )

    async def get_status(self, organization_id: str) -> dict:
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        return self._status_payload(org)

    async def get_organization_for_user(self, user: dict) -> dict | None:
        organization_id = user.get("organization_id")
        if not organization_id:
            return None
        return await self.db.organizations.find_one({"organization_id": organization_id})

    @staticmethod
    def get_org_phone_number(org: dict | None) -> str | None:
        if not org:
            return settings.TELNYX_PHONE_NUMBER
        mode = org.get("telnyx_mode", "not_set")
        if mode == "custom":
            return org.get("telnyx_custom_phone_number")
        return org.get("telnyx_phone_number") or settings.TELNYX_PHONE_NUMBER

    @staticmethod
    def get_org_api_key(org: dict | None) -> str | None:
        if org and org.get("telnyx_mode") == "custom" and org.get("telnyx_custom_api_key_enc"):
            try:
                return decrypt_value(org["telnyx_custom_api_key_enc"])
            except Exception:
                return settings.TELNYX_API_KEY
        return settings.TELNYX_API_KEY

    async def backfill_organization_numbers(self) -> dict:
        """One-time migration: numbers provisioned under the old per-user scheme move
        to the organization they belong to. If an org already has a number (e.g. two
        legacy users in the same org both provisioned one before this migration ran),
        the first one found wins and the rest are released back to Telnyx instead of
        silently orphaning a paid number."""
        migrated = 0
        released = 0
        skipped_no_org = 0
        cursor = self.db.users.find(
            {"telnyx_phone_number": {"$exists": True, "$ne": None}},
            {"_id": 1, "organization_id": 1, "telnyx_phone_number": 1, "telnyx_phone_number_id": 1, "telnyx_number_order_id": 1, "telnyx_setup_status": 1},
        )
        async for legacy_user in cursor:
            user_id = str(legacy_user["_id"])
            organization_id = legacy_user.get("organization_id") or user_id
            existing_org = await self.db.organizations.find_one({"organization_id": organization_id})

            if existing_org and existing_org.get("telnyx_phone_number"):
                phone_number_id = legacy_user.get("telnyx_phone_number_id")
                if phone_number_id:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, partial(_release_sync, phone_number_id))
                    released += 1
            else:
                await self.db.organizations.update_one(
                    {"organization_id": organization_id},
                    {
                        "$set": {
                            "telnyx_phone_number": legacy_user["telnyx_phone_number"],
                            "telnyx_phone_number_id": legacy_user.get("telnyx_phone_number_id"),
                            "telnyx_number_order_id": legacy_user.get("telnyx_number_order_id"),
                            "telnyx_setup_status": legacy_user.get("telnyx_setup_status", "active"),
                            "provisioned_by_user_id": user_id,
                            "updated_at": _utc_now(),
                        },
                        "$setOnInsert": {"organization_id": organization_id, "created_at": _utc_now()},
                    },
                    upsert=True,
                )
                migrated += 1
                if not legacy_user.get("organization_id"):
                    skipped_no_org += 1

            await self.db.users.update_one(
                {"_id": legacy_user["_id"]},
                {
                    "$unset": {
                        "telnyx_phone_number": "",
                        "telnyx_phone_number_id": "",
                        "telnyx_number_order_id": "",
                        "telnyx_setup_status": "",
                    }
                },
            )

        custom_migrated = 0
        custom_cursor = self.db.users.find(
            {"telnyx_mode": "custom"},
            {"_id": 1, "organization_id": 1, "telnyx_custom_api_key_enc": 1, "telnyx_custom_phone_number": 1},
        )
        async for legacy_user in custom_cursor:
            user_id = str(legacy_user["_id"])
            organization_id = legacy_user.get("organization_id") or user_id
            await self.db.organizations.update_one(
                {"organization_id": organization_id},
                {
                    "$set": {
                        "telnyx_mode": "custom",
                        "telnyx_custom_api_key_enc": legacy_user.get("telnyx_custom_api_key_enc"),
                        "telnyx_custom_phone_number": legacy_user.get("telnyx_custom_phone_number"),
                        "updated_at": _utc_now(),
                    },
                    "$setOnInsert": {"organization_id": organization_id, "created_at": _utc_now()},
                },
                upsert=True,
            )
            await self.db.users.update_one(
                {"_id": legacy_user["_id"]},
                {"$unset": {"telnyx_mode": "", "telnyx_custom_api_key_enc": "", "telnyx_custom_phone_number": ""}},
            )
            custom_migrated += 1

        return {
            "platform_numbers_migrated": migrated,
            "platform_numbers_released_as_duplicate": released,
            "migrated_without_organization": skipped_no_org,
            "custom_credentials_migrated": custom_migrated,
        }

    async def _mark_failed(self, organization_id: str) -> None:
        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {"$set": {"telnyx_setup_status": "failed", "updated_at": _utc_now()}},
        )

    @staticmethod
    def _status_payload(org: dict | None) -> dict:
        return {
            "telnyx_setup_status": (org or {}).get("telnyx_setup_status", "not_provisioned"),
            "telnyx_phone_number": (org or {}).get("telnyx_phone_number"),
            "telnyx_mode": (org or {}).get("telnyx_mode", "not_set"),
            "telnyx_custom_phone_number": (org or {}).get("telnyx_custom_phone_number"),
        }
