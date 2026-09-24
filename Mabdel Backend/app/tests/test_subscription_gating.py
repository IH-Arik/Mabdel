from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from app.dependencies import _resolve_subscription_state
from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "gating@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Gating Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify_response.status_code == 200

    grant_owner_role(mock_db, email)

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def _set_subscription_fields(mock_db, email: str, fields: dict) -> None:
    asyncio.run(mock_db.users.update_one({"email": email}, {"$set": fields}))


# ── Pure resolver logic (no HTTP) ──────────────────────────────────────────


def test_resolver_new_style_active_account_with_tier():
    state = _resolve_subscription_state({"subscription_tier": "growth", "subscription_status": "active"})
    assert state.is_active is True
    assert state.tier == "growth"


def test_resolver_new_style_trial_respects_trial_ends_at():
    future = datetime.utcnow() + timedelta(days=3)
    past = datetime.utcnow() - timedelta(days=1)
    still_trialing = _resolve_subscription_state(
        {"subscription_tier": "pro", "subscription_status": "trial", "trial_ends_at": future}
    )
    expired_trial = _resolve_subscription_state(
        {"subscription_tier": "pro", "subscription_status": "trial", "trial_ends_at": past}
    )
    assert still_trialing.is_active is True
    assert expired_trial.is_active is False


def test_resolver_grandfathers_old_shape_live_signup_account():
    """Every account created by subscription_signup *before* this change only has
    subscription_plan/subscription_expiration - no subscription_tier or
    subscription_status. It must stay active and tier=None (unrestricted) so
    nothing currently working for a real customer breaks."""
    future = datetime.utcnow() + timedelta(days=10)
    state = _resolve_subscription_state({"subscription_plan": "Monthly", "subscription_expiration": future})
    assert state.is_active is True
    assert state.tier is None


def test_resolver_old_shape_account_locks_out_after_expiration():
    past = datetime.utcnow() - timedelta(days=1)
    state = _resolve_subscription_state({"subscription_plan": "7-Day Trial", "subscription_expiration": past})
    assert state.is_active is False
    assert state.tier is None


def test_resolver_bare_account_with_no_subscription_fields_is_let_through():
    assert _resolve_subscription_state({}).is_active is True


# ── Real HTTP: baseline require_subscription ───────────────────────────────


def _create_event_payload() -> dict:
    return {
        "title": "Test meeting",
        "starts_at": "2027-01-01T10:00:00Z",
        "ends_at": "2027-01-01T11:00:00Z",
    }


def test_expired_account_is_locked_out_of_baseline_gated_endpoint(client, mock_db):
    headers = _auth_headers(client, mock_db, email="expired@example.com")
    _set_subscription_fields(mock_db, "expired@example.com", {"subscription_status": "none"})

    response = client.post("/api/v1/smartflow/calendar/events", headers=headers, json=_create_event_payload())

    assert response.status_code == 402
    assert response.json()["error"]["code"] == "SUBSCRIPTION_EXPIRED"


def test_active_account_passes_baseline_gated_endpoint(client, mock_db):
    headers = _auth_headers(client, mock_db, email="active-baseline@example.com")
    _set_subscription_fields(mock_db, "active-baseline@example.com", {"subscription_status": "active"})

    response = client.post("/api/v1/smartflow/calendar/events", headers=headers, json=_create_event_payload())

    assert response.status_code == 201


# ── Real HTTP: tier-gated endpoints (bulk messaging = growth+) ────────────


def test_starter_tier_is_blocked_from_a_growth_gated_endpoint(client, mock_db):
    headers = _auth_headers(client, mock_db, email="starter@example.com")
    _set_subscription_fields(
        mock_db, "starter@example.com", {"subscription_status": "active", "subscription_tier": "starter"}
    )

    response = client.post(
        "/api/v1/smartflow/bulk-messages/improve-content",
        headers=headers,
        json={"content": "hello"},
    )

    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "PLAN_UPGRADE_REQUIRED"
    assert body["error"]["details"]["current_tier"] == "starter"
    assert body["error"]["details"]["required_tier"] == "growth"


def test_growth_tier_passes_a_growth_gated_endpoint(client, mock_db, monkeypatch):
    from app.services.gocustify_ai_service import GoCustifyAIService

    async def fake_improve(self, text):
        return "improved", 5

    monkeypatch.setattr(GoCustifyAIService, "improve_text", lambda self, text: ("improved", 5))

    headers = _auth_headers(client, mock_db, email="growth@example.com")
    _set_subscription_fields(
        mock_db, "growth@example.com", {"subscription_status": "active", "subscription_tier": "growth"}
    )

    response = client.post(
        "/api/v1/smartflow/bulk-messages/improve-content",
        headers=headers,
        json={"content": "hello"},
    )

    assert response.status_code == 200


def test_grandfathered_old_shape_account_passes_a_growth_gated_endpoint(client, mock_db, monkeypatch):
    """An account with no subscription_tier at all (every pre-existing live
    customer) must not be newly locked out of anything it could already do."""
    from app.services.gocustify_ai_service import GoCustifyAIService

    monkeypatch.setattr(GoCustifyAIService, "improve_text", lambda self, text: ("improved", 5))

    headers = _auth_headers(client, mock_db, email="grandfathered@example.com")
    future = datetime.utcnow() + timedelta(days=10)
    _set_subscription_fields(
        mock_db,
        "grandfathered@example.com",
        {"subscription_plan": "Monthly", "subscription_expiration": future, "subscription_status": None, "subscription_tier": None},
    )

    response = client.post(
        "/api/v1/smartflow/bulk-messages/improve-content",
        headers=headers,
        json={"content": "hello"},
    )

    assert response.status_code == 200


# ── Signup: builds a Stripe Checkout Session, defers account creation ──────
#
# subscription_signup no longer creates a user directly - it only builds a
# Stripe Checkout Session and returns its URL. The account is only ever
# provisioned once payment succeeds, via the checkout.session.completed
# webhook (provision_owner_from_checkout_session, tested separately below and
# in test_auth.py). This avoids leaving an orphaned account behind for every
# visitor who starts checkout and abandons it.


class _FakeCheckoutSession:
    url = "https://checkout.stripe.com/c/pay/fake_session"


def _patch_stripe_client(monkeypatch):
    fake_client = type(
        "FakeStripeClient",
        (),
        {"checkout": type("C", (), {"sessions": type("S", (), {"create": staticmethod(lambda params: _FakeCheckoutSession())})()})()},
    )()
    monkeypatch.setattr("app.services.stripe_subscription_service._client", lambda: fake_client)
    monkeypatch.setattr("app.core.config.settings.STRIPE_PRICE_STARTER", "price_test_starter")
    monkeypatch.setattr("app.core.config.settings.STRIPE_PRICE_GROWTH", "price_test_growth")
    monkeypatch.setattr("app.core.config.settings.STRIPE_PRICE_PRO", "price_test_pro")


def _signup_payload(**overrides) -> dict:
    payload = {
        "full_name": "Tier Owner",
        "original_email": "tier.owner@example.com",
        "business_name": "Tier Test Biz",
        "business_address": "1 Test St",
        "owner_dob": "1990-01-01",
        "phone_no": "+15551230000",
        "business_type": "Testing",
        "plan": "subscribe",
        "tier": "growth",
    }
    payload.update(overrides)
    return payload


def test_signup_with_valid_tier_returns_a_checkout_url_and_creates_no_user_yet(client, mock_db, monkeypatch):
    _patch_stripe_client(monkeypatch)

    response = client.post("/api/v1/auth/subscription-signup", json=_signup_payload())

    assert response.status_code == 201
    assert response.json()["data"]["checkout_url"] == _FakeCheckoutSession.url
    user = asyncio.run(mock_db.users.find_one({"original_email": "tier.owner@example.com"}))
    assert user is None


def test_signup_with_missing_tier_is_rejected_before_any_stripe_call(client, mock_db, monkeypatch):
    calls = {"made": False}

    def fail_if_called():
        calls["made"] = True
        raise AssertionError("Stripe client should not be constructed for an invalid tier")

    monkeypatch.setattr("app.services.stripe_subscription_service._client", fail_if_called)

    response = client.post("/api/v1/auth/subscription-signup", json=_signup_payload(tier=None))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TIER"
    assert calls["made"] is False


def test_signup_with_unrecognized_tier_is_rejected(client, mock_db, monkeypatch):
    _patch_stripe_client(monkeypatch)

    response = client.post("/api/v1/auth/subscription-signup", json=_signup_payload(tier="enterprise-deluxe"))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TIER"


# ── Webhook provisioning: checkout.session.completed → real account ───────


def _fake_subscription_client(status: str, trial_end: int | None):
    fake_subscription = type("Sub", (), {"status": status, "trial_end": trial_end})()
    return type(
        "C",
        (),
        {"subscriptions": type("S", (), {"retrieve": staticmethod(lambda _id: fake_subscription)})()},
    )()


def _disable_webhook_signature_verification(monkeypatch):
    import app.api.dashboard.webhooks as webhooks_module

    monkeypatch.setattr(webhooks_module.settings, "STRIPE_WEBHOOK_SECRET", None)


def test_checkout_completed_webhook_provisions_active_subscribe_account(client, mock_db, monkeypatch):
    _disable_webhook_signature_verification(monkeypatch)
    monkeypatch.setattr(
        "app.services.stripe_subscription_service._client",
        lambda: _fake_subscription_client("active", None),
    )

    session = {
        "customer": "cus_growth_1",
        "subscription": "sub_growth_1",
        "metadata": {
            "type": "subscription_signup",
            "full_name": "Webhook Owner",
            "original_email": "webhook.owner@example.com",
            "business_name": "Webhook Test Biz",
            "business_address": "1 Test St",
            "owner_dob": "1990-01-01",
            "phone_no": "+15551230000",
            "business_type": "Testing",
            "plan": "subscribe",
            "tier": "growth",
        },
    }

    response = client.post("/api/v1/dashboard/webhooks/stripe", json={"type": "checkout.session.completed", "data": {"object": session}})
    assert response.status_code == 200

    user = asyncio.run(mock_db.users.find_one({"original_email": "webhook.owner@example.com"}))
    assert user["subscription_tier"] == "growth"
    assert user["subscription_status"] == "active"
    assert user["trial_ends_at"] is None
    assert user["stripe_customer_id"] == "cus_growth_1"
    assert user["stripe_subscription_id"] == "sub_growth_1"


def test_checkout_completed_webhook_provisions_trial_with_trial_ends_at(client, mock_db, monkeypatch):
    _disable_webhook_signature_verification(monkeypatch)
    future_ts = int((datetime.utcnow() + timedelta(days=7)).timestamp())
    monkeypatch.setattr(
        "app.services.stripe_subscription_service._client",
        lambda: _fake_subscription_client("trialing", future_ts),
    )

    session = {
        "customer": "cus_pro_1",
        "subscription": "sub_pro_1",
        "metadata": {
            "type": "subscription_signup",
            "full_name": "Trial Owner",
            "original_email": "trial.owner@example.com",
            "business_name": "Trial Test Biz",
            "business_address": "1 Test St",
            "owner_dob": "1990-01-01",
            "phone_no": "+15551230001",
            "business_type": "Testing",
            "plan": "trial",
            "tier": "pro",
        },
    }

    response = client.post("/api/v1/dashboard/webhooks/stripe", json={"type": "checkout.session.completed", "data": {"object": session}})
    assert response.status_code == 200

    user = asyncio.run(mock_db.users.find_one({"original_email": "trial.owner@example.com"}))
    assert user["subscription_tier"] == "pro"
    assert user["subscription_status"] == "trial"
    assert user["trial_ends_at"] is not None
    assert user["trial_ends_at"].replace(tzinfo=None) - datetime.utcnow() > timedelta(days=6)


def test_trial_checkout_webhook_works_with_a_real_stripe_signature(client, mock_db, monkeypatch):
    """The trial-path analogue of test_payment_link_webhook_works_with_a_real_stripe_signature
    (app/tests/test_stripe_connect.py). Every other trial webhook test here disables real
    signature verification via _disable_webhook_signature_verification, which is exactly the
    gap that let the stripe.Event.to_dict() bug (see app/api/dashboard/webhooks.py) go
    uncaught for weeks in production. This one takes the real signature-verified branch with
    a correctly HMAC-signed payload, built the way Stripe itself signs webhook requests."""
    import hashlib
    import hmac
    import json
    import time

    import app.api.dashboard.webhooks as webhooks_module

    webhook_secret = "whsec_test_fake_secret"
    monkeypatch.setattr(webhooks_module.settings, "STRIPE_WEBHOOK_SECRET", webhook_secret)

    future_ts = int((datetime.utcnow() + timedelta(days=7)).timestamp())
    monkeypatch.setattr(
        "app.services.stripe_subscription_service._client",
        lambda: _fake_subscription_client("trialing", future_ts),
    )

    session = {
        "customer": "cus_signed_trial_1",
        "subscription": "sub_signed_trial_1",
        "metadata": {
            "type": "subscription_signup",
            "full_name": "Signed Trial Owner",
            "original_email": "signed.trial.owner@example.com",
            "business_name": "Signed Trial Test Biz",
            "business_address": "1 Test St",
            "owner_dob": "1990-01-01",
            "phone_no": "+15551230003",
            "business_type": "Testing",
            "plan": "trial",
            "tier": "starter",
        },
    }
    payload = json.dumps({"type": "checkout.session.completed", "data": {"object": session}}).encode()
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.".encode() + payload
    signature = hmac.new(webhook_secret.encode(), signed_payload, hashlib.sha256).hexdigest()

    response = client.post(
        "/api/v1/dashboard/webhooks/stripe",
        content=payload,
        headers={"content-type": "application/json", "stripe-signature": f"t={timestamp},v1={signature}"},
    )
    assert response.status_code == 200, response.text

    user = asyncio.run(mock_db.users.find_one({"original_email": "signed.trial.owner@example.com"}))
    assert user["subscription_status"] == "trial"
    assert user["subscription_tier"] == "starter"
    assert user["trial_ends_at"] is not None
    assert user["trial_ends_at"].replace(tzinfo=None) - datetime.utcnow() > timedelta(days=6)


def test_checkout_completed_webhook_is_idempotent_on_redelivery(client, mock_db, monkeypatch):
    _disable_webhook_signature_verification(monkeypatch)
    monkeypatch.setattr(
        "app.services.stripe_subscription_service._client",
        lambda: _fake_subscription_client("active", None),
    )

    session = {
        "customer": "cus_dup_1",
        "subscription": "sub_dup_1",
        "metadata": {
            "type": "subscription_signup",
            "full_name": "Dup Owner",
            "original_email": "dup.owner@example.com",
            "business_name": "Dup Test Biz",
            "business_address": "1 Test St",
            "owner_dob": "1990-01-01",
            "phone_no": "+15551230002",
            "business_type": "Testing",
            "plan": "subscribe",
            "tier": "starter",
        },
    }
    event = {"type": "checkout.session.completed", "data": {"object": session}}

    client.post("/api/v1/dashboard/webhooks/stripe", json=event)
    client.post("/api/v1/dashboard/webhooks/stripe", json=event)

    count = asyncio.run(mock_db.users.count_documents({"stripe_subscription_id": "sub_dup_1"}))
    assert count == 1


def test_subscription_deleted_webhook_locks_out_an_active_account(client, mock_db, monkeypatch):
    _disable_webhook_signature_verification(monkeypatch)
    headers = _auth_headers(client, mock_db, email="cancel-me@example.com")
    _set_subscription_fields(
        mock_db,
        "cancel-me@example.com",
        {"subscription_status": "active", "subscription_tier": "growth", "stripe_subscription_id": "sub_cancel_1"},
    )

    response = client.post(
        "/api/v1/dashboard/webhooks/stripe",
        json={"type": "customer.subscription.deleted", "data": {"object": {"id": "sub_cancel_1", "status": "canceled"}}},
    )
    assert response.status_code == 200

    gated_response = client.post(
        "/api/v1/smartflow/calendar/events", headers=headers, json=_create_event_payload()
    )
    assert gated_response.status_code == 402
    assert gated_response.json()["error"]["code"] == "SUBSCRIPTION_EXPIRED"
