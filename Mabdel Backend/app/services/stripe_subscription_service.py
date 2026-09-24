from __future__ import annotations

import logging
from datetime import datetime, timezone

import stripe
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.dashboard_schemas import OwnerCreateRequest

logger = logging.getLogger(__name__)

_TIER_PRICE_ENV = {
    "starter": "STRIPE_PRICE_STARTER",
    "growth": "STRIPE_PRICE_GROWTH",
    "pro": "STRIPE_PRICE_PRO",
}

# Maps Stripe's own subscription lifecycle states onto the two strings the
# baseline resolver (_resolve_subscription_state in app/dependencies.py)
# already treats as "active" — anything else stored as-is locks the account
# out via that same resolver with zero changes needed there.
_ACTIVE_STRIPE_STATUSES = {"trialing": "trial", "active": "active"}


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


def _price_id_for_tier(tier: str) -> str:
    env_name = _TIER_PRICE_ENV.get(tier)
    price_id = getattr(settings, env_name, None) if env_name else None
    if not price_id:
        raise AppException(
            status_code=503,
            code="STRIPE_NOT_CONFIGURED",
            message=f"No Stripe price is configured for the '{tier}' plan yet.",
        )
    return price_id


def create_subscription_checkout_session(payload: OwnerCreateRequest) -> str:
    """Builds a Stripe Checkout Session for a new subscription signup and returns
    its hosted URL. Nothing is written to our own database here — the account is
    only ever provisioned once payment actually succeeds, by
    provision_owner_from_checkout_session below, driven off the resulting
    checkout.session.completed webhook. This avoids leaving an orphaned account
    behind for every visitor who starts checkout and abandons it."""

    tier = (payload.tier or "").strip().lower()
    if tier not in _TIER_PRICE_ENV:
        raise AppException(
            status_code=400,
            code="INVALID_TIER",
            message="Please pick a valid plan (Starter, Growth, or Pro) before continuing to payment.",
        )

    price_id = _price_id_for_tier(tier)
    plan = "subscribe" if payload.plan == "subscribe" else "trial"

    subscription_data = {"trial_period_days": 7} if plan == "trial" else {}

    # Stripe Checkout Session metadata values must each be a string, <=500 chars.
    metadata = {
        "type": "subscription_signup",
        "full_name": payload.full_name or "",
        "original_email": payload.original_email,
        "business_name": payload.business_name or "",
        "business_address": payload.business_address or "",
        "owner_dob": payload.owner_dob or "",
        "phone_no": payload.phone_no or "",
        "business_type": payload.business_type or "",
        "plan": plan,
        "tier": tier,
    }

    client = _client()
    try:
        session = client.checkout.sessions.create(
            params={
                "mode": "subscription",
                "line_items": [{"price": price_id, "quantity": 1}],
                "customer_email": payload.original_email,
                "subscription_data": subscription_data,
                "metadata": metadata,
                "success_url": f"{settings.PUBLIC_FRONTEND_URL}/subscription?checkout=success",
                "cancel_url": f"{settings.PUBLIC_FRONTEND_URL}/subscription?checkout=cancelled",
            }
        )
    except stripe.StripeError as exc:
        _stripe_raise(exc, "subscription checkout session creation")

    return session.url


async def provision_owner_from_checkout_session(session: dict, db: AsyncIOMotorDatabase) -> None:
    """Called from the checkout.session.completed webhook (metadata.type ==
    "subscription_signup"). Creates the owner account, org, RBAC role and
    global chat — the same steps app/api/v1/auth_routes.py's subscription_signup
    used to run synchronously before payment even existed — now gated on Stripe
    having actually confirmed the subscription."""

    metadata = session.get("metadata") or {}
    if metadata.get("type") != "subscription_signup":
        return

    subscription_id = session.get("subscription")
    customer_id = session.get("customer")

    if subscription_id:
        existing = await db.users.find_one({"stripe_subscription_id": subscription_id})
        if existing:
            logger.info("subscription-signup webhook: subscription %s already provisioned, skipping", subscription_id)
            return

    original_email = metadata.get("original_email")
    business_name = metadata.get("business_name") or ""
    tier = metadata.get("tier") or None

    # Stripe's own Subscription object is the source of truth for status/trial_end
    # rather than trusting the "plan" we stashed in metadata at checkout-creation
    # time (the trial could have been skipped, or the account could already be
    # past its trial by the time this webhook is processed).
    subscription_status = "trial" if metadata.get("plan") == "trial" else "active"
    trial_ends_at = None
    if subscription_id:
        try:
            subscription = _client().subscriptions.retrieve(subscription_id)
        except stripe.StripeError:
            subscription = None
        if subscription is not None:
            subscription_status = _ACTIVE_STRIPE_STATUSES.get(subscription.status, subscription.status)
            if subscription.trial_end:
                trial_ends_at = datetime.fromtimestamp(subscription.trial_end, tz=timezone.utc)

    from app.services.dashboard.credential_generator import generate_login_email, generate_secure_password
    from app.core.security import hash_password
    from app.repositories.dashboard.rbac_repository import RBACRepository
    from app.services.smartflow.smartflow_orchestrator import SmartFlowService
    from app.services.email_service import EmailService

    while True:
        generated_login_email = generate_login_email(business_name, "owner")
        existing = await db.users.find_one({"email": generated_login_email})
        if not existing:
            break

    generated_password = generate_secure_password()
    hashed_pw = hash_password(generated_password)
    now = _utc_now()

    user_doc = {
        "email": generated_login_email,
        "original_email": original_email,
        "password_hash": hashed_pw,
        "full_name": metadata.get("full_name") or "",
        "created_by": "system",
        "is_subordinate_account": False,
        "business_name": business_name,
        "business_address": metadata.get("business_address") or None,
        "owner_dob": metadata.get("owner_dob") or None,
        "phone_no": metadata.get("phone_no") or None,
        "business_type": metadata.get("business_type") or None,
        "role": "owner",
        "primary_role": "owner",
        "roles": ["owner"],
        "is_verified": True,
        "is_active": True,
        "subscription_tier": tier,
        "subscription_status": subscription_status,
        "trial_ends_at": trial_ends_at,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.users.insert_one(user_doc)
    new_user_id = str(result.inserted_id)

    await db.users.update_one({"_id": result.inserted_id}, {"$set": {"organization_id": new_user_id}})

    repo = RBACRepository(db)
    role_doc = await repo.get_role_by_slug("owner")
    if role_doc:
        await repo.assign_role(
            user_id=new_user_id,
            role_id=str(role_doc["_id"]),
            role_slug="owner",
            assigned_by="system",
            organization_id=new_user_id,
        )

    smartflow = SmartFlowService(db)
    await smartflow.ensure_global_chat(
        organization_id=new_user_id,
        business_name=business_name,
        owner_id=new_user_id,
    )

    try:
        await EmailService().send_subordinate_credentials_email(
            email=original_email,
            login_email=generated_login_email,
            password=generated_password,
            role="owner",
        )
    except Exception:
        logger.exception(
            "subscription-signup webhook: account %s created but credentials email to %s failed",
            new_user_id, original_email,
        )


async def sync_subscription_status(subscription: dict, db: AsyncIOMotorDatabase) -> None:
    """Called from customer.subscription.updated / customer.subscription.deleted.
    Keeps an already-provisioned account's subscription_status in sync with
    Stripe, so the existing require_subscription/require_plan_feature gating
    (unchanged) locks out a cancelled or payment-failed account automatically."""

    subscription_id = subscription.get("id")
    if not subscription_id:
        return

    user = await db.users.find_one({"stripe_subscription_id": subscription_id})
    if not user:
        # Out-of-order delivery: the checkout.session.completed webhook that
        # provisions this account hasn't landed yet. Nothing to sync onto.
        return

    status = subscription.get("status") or "canceled"
    mapped_status = _ACTIVE_STRIPE_STATUSES.get(status, status)

    trial_end = subscription.get("trial_end")
    trial_ends_at = datetime.fromtimestamp(trial_end, tz=timezone.utc) if trial_end else None

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"subscription_status": mapped_status, "trial_ends_at": trial_ends_at, "updated_at": _utc_now()}},
    )
