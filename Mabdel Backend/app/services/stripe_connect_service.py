from __future__ import annotations

from datetime import datetime, timezone

import stripe
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.exceptions import AppException


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _client() -> stripe.StripeClient:
    if not settings.STRIPE_SECRET_KEY:
        raise AppException(
            status_code=503,
            code="STRIPE_NOT_CONFIGURED",
            message="Stripe is not configured on this server.",
        )
    return stripe.StripeClient(settings.STRIPE_SECRET_KEY)


def _stripe_raise(exc: stripe.StripeError, context: str) -> None:
    raise AppException(
        status_code=503,
        code="STRIPE_API_ERROR",
        message=f"Stripe error during {context}: {exc.user_message or exc}",
    ) from exc


class StripeConnectService:
    """One Stripe Express account per organization (business), shared by every member
    who has the ``invoices:manage``-equivalent permission — mirrors the one-Telnyx-
    number-per-organization pattern in ``TelnyxProvisioningService``."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def start_onboarding(self, organization_id: str, email: str) -> dict:
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        account_id = (org or {}).get("stripe_account_id")
        client = _client()

        if not account_id:
            try:
                account = client.accounts.create(
                    params={
                        "type": "express",
                        "email": email,
                        "capabilities": {
                            "card_payments": {"requested": True},
                            "transfers": {"requested": True},
                        },
                    }
                )
            except stripe.StripeError as exc:
                _stripe_raise(exc, "account creation")
            account_id = account.id
            await self.db.organizations.update_one(
                {"organization_id": organization_id},
                {
                    "$set": {"stripe_account_id": account_id, "updated_at": _utc_now()},
                    "$setOnInsert": {"organization_id": organization_id, "created_at": _utc_now()},
                },
                upsert=True,
            )

        try:
            account_link = client.account_links.create(
                params={
                    "account": account_id,
                    "refresh_url": f"{settings.PUBLIC_FRONTEND_URL}/invoices?stripe=refresh",
                    "return_url": f"{settings.PUBLIC_FRONTEND_URL}/invoices?stripe=return",
                    "type": "account_onboarding",
                }
            )
        except stripe.StripeError as exc:
            _stripe_raise(exc, "account link creation")

        return {"onboarding_url": account_link.url}

    async def get_status(self, organization_id: str) -> dict:
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        account_id = (org or {}).get("stripe_account_id")
        if not account_id:
            return self._status_payload(org)

        try:
            account = _client().accounts.retrieve(account_id)
        except stripe.StripeError:
            return self._status_payload(org)

        update = {
            "stripe_details_submitted": bool(account.details_submitted),
            "stripe_charges_enabled": bool(account.charges_enabled),
            "stripe_payouts_enabled": bool(account.payouts_enabled),
            "updated_at": _utc_now(),
        }
        await self.db.organizations.update_one({"organization_id": organization_id}, {"$set": update})
        return self._status_payload({**(org or {}), **update})

    async def get_account_id(self, organization_id: str) -> str | None:
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        return (org or {}).get("stripe_account_id")

    @staticmethod
    def _status_payload(org: dict | None) -> dict:
        return {
            "stripe_account_id": (org or {}).get("stripe_account_id"),
            "stripe_details_submitted": bool((org or {}).get("stripe_details_submitted", False)),
            "stripe_charges_enabled": bool((org or {}).get("stripe_charges_enabled", False)),
            "stripe_payouts_enabled": bool((org or {}).get("stripe_payouts_enabled", False)),
        }
