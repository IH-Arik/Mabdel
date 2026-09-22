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


# ── Signup plumbing end-to-end ──────────────────────────────────────────────


def test_signup_records_the_picked_tier_and_subscribe_status(client, mock_db):
    response = client.post(
        "/api/v1/auth/subscription-signup",
        json={
            "full_name": "Tier Owner",
            "original_email": "tier.owner@example.com",
            "business_name": "Tier Test Biz",
            "business_address": "1 Test St",
            "owner_dob": "1990-01-01",
            "phone_no": "+15551230000",
            "business_type": "Testing",
            "plan": "subscribe",
            "tier": "growth",
        },
    )

    assert response.status_code == 201
    user = asyncio.run(mock_db.users.find_one({"original_email": "tier.owner@example.com"}))
    assert user["subscription_tier"] == "growth"
    assert user["subscription_status"] == "active"
    assert user["trial_ends_at"] is None


def test_signup_records_trial_status_with_trial_ends_at(client, mock_db):
    response = client.post(
        "/api/v1/auth/subscription-signup",
        json={
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
    )

    assert response.status_code == 201
    user = asyncio.run(mock_db.users.find_one({"original_email": "trial.owner@example.com"}))
    assert user["subscription_tier"] == "pro"
    assert user["subscription_status"] == "trial"
    assert user["trial_ends_at"] is not None
    assert user["trial_ends_at"] - datetime.utcnow() > timedelta(days=6)


def test_signup_with_unrecognized_tier_does_not_422_and_stores_none(client, mock_db):
    response = client.post(
        "/api/v1/auth/subscription-signup",
        json={
            "full_name": "Bad Tier Owner",
            "original_email": "bad.tier@example.com",
            "business_name": "Bad Tier Biz",
            "business_address": "1 Test St",
            "owner_dob": "1990-01-01",
            "phone_no": "+15551230002",
            "business_type": "Testing",
            "plan": "subscribe",
            "tier": "enterprise-deluxe",
        },
    )

    assert response.status_code == 201
    user = asyncio.run(mock_db.users.find_one({"original_email": "bad.tier@example.com"}))
    assert user["subscription_tier"] is None
