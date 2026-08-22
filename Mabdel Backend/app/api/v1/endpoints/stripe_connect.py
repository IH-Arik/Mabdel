from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException
from app.dependencies import get_mongo_database, require_permission
from app.services.stripe_connect_service import StripeConnectService
from app.utils.responses import success_response

router = APIRouter(prefix="/stripe/connect", tags=["Stripe Connect"])


def get_stripe_connect_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> StripeConnectService:
    return StripeConnectService(db)


def _require_organization_id(user: dict) -> str:
    organization_id = user.get("organization_id")
    if not organization_id:
        raise AppException(
            status_code=422,
            code="NO_ORGANIZATION",
            message="Your account isn't part of an organization yet.",
        )
    return organization_id


@router.get("/status")
async def get_stripe_connect_status(
    current_user: dict = Depends(require_permission("invoices", "view")),
    service: StripeConnectService = Depends(get_stripe_connect_service),
) -> dict:
    """Returns the organization's Stripe Connect onboarding status — one connected
    account per business, shared by the whole team's invoices."""
    organization_id = _require_organization_id(current_user)
    result = await service.get_status(organization_id)
    return success_response(data=result, message="Stripe Connect status fetched.")


@router.post("/onboard")
async def start_stripe_connect_onboarding(
    current_user: dict = Depends(require_permission("invoices", "edit")),
    service: StripeConnectService = Depends(get_stripe_connect_service),
) -> dict:
    """Creates (if needed) the organization's Stripe Express account and returns a
    fresh Stripe-hosted onboarding link to finish/resume KYC."""
    organization_id = _require_organization_id(current_user)
    result = await service.start_onboarding(organization_id, email=current_user["email"])
    return success_response(data=result, message="Stripe Connect onboarding link created.")
