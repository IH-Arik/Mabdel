from __future__ import annotations

import asyncio
from datetime import timedelta

import pytest
from bson import ObjectId

from app.core.exceptions import AppException
from app.utils.helpers import utc_now


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


def _auth_headers(client, mock_db, email: str = "bulk@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Bulk User", "email": email, "password": "SecurePass2024!"},
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


def _create_contact(client, headers: dict[str, str], *, name: str, email: str, phone: str = "+8801700000000") -> str:
    response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": name, "email": email, "phone": phone},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def test_bulk_recipient_validation_flow(client, mock_db):
    headers = _auth_headers(client, mock_db)
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    sarah_id = _create_contact(client, headers, name="Sarah Miller", email="sarah@example.com")

    group_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={"name": "Leadership", "member_ids": [alex_id, sarah_id]},
    )
    assert group_response.status_code == 201
    group_id = group_response.json()["data"]["id"]

    response = client.post(
        "/api/v1/smartflow/bulk-messages/recipients/validate",
        headers=headers,
        json={
            "channel": "email",
            "recipient_emails": ["team@company.com", "wrong-email@", "team@company.com"],
            "contact_ids": [alex_id],
            "group_ids": [group_id],
        },
    )
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["valid_count"] == 3
    assert payload["invalid_count"] == 1
    assert payload["duplicate_count"] >= 1
    assert "wrong-email@" in payload["invalid_entries"]


def test_bulk_message_create_schedule_send_and_list_flow(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="bulk-send@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    sarah_id = _create_contact(client, headers, name="Sarah Miller", email="sarah@example.com")

    # Without this, the bulk-send path (_base.py's _dispatch_bulk_message) calls a
    # bare EmailService() that falls through to a real Resend API call whenever
    # RESEND_API_KEY happens to be set in the environment — Resend's sandbox key then
    # rejects @example.com-style test addresses, non-deterministically turning some
    # deliveries into failures depending on which domains it happens to reject that
    # day. Faked here (via monkeypatch, so it's undone after this test — a bare class
    # assignment leaked into test_zoho_mail.py's real-routing test the first time this
    # was tried) since this codepath isn't behind the DI seam
    # conftest.FakeEmailService/get_email_service override already covers.
    from app.services.email_service import EmailService

    async def fake_send_business_email(self, **kwargs) -> None:
        return None

    monkeypatch.setattr(EmailService, "send_business_email", fake_send_business_email)

    create_response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "email",
            "recipient_emails": ["team@company.com"],
            "contact_ids": [alex_id, sarah_id],
            "subject": "Quarterly update",
            "content": "Hello team, here is the quarterly update.",
            "attachments": [{"label": "Deck", "url": "https://files.example.com/deck.pdf"}],
            "send_now": True,
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()["data"]
    assert created["status"] == "sent"
    assert created["sent_count"] == 3
    assert created["failed_count"] == 0
    assert created["deliveries"][0]["status"] == "sent"

    detail_response = client.get(f"/api/v1/smartflow/bulk-messages/{created['id']}", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["attachments"][0]["label"] == "Deck"

    list_response = client.get("/api/v1/smartflow/bulk-messages?status=sent", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"][0]["id"] == created["id"]


def test_bulk_message_draft_update_schedule_and_cancel_flow(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-draft@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    schedule_time = (utc_now() + timedelta(days=1)).isoformat()

    create_response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "email",
            "contact_ids": [alex_id],
            "subject": "Draft update",
            "content": "Initial draft content",
            "send_now": False,
        },
    )
    assert create_response.status_code == 201
    bulk_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["status"] == "draft"

    update_response = client.patch(
        f"/api/v1/smartflow/bulk-messages/{bulk_id}",
        headers=headers,
        json={
            "content": "Updated content for later delivery",
            "scheduled_at": schedule_time,
            "timezone": "Asia/Dhaka",
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()["data"]
    assert updated["status"] == "scheduled"
    assert updated["timezone"] == "Asia/Dhaka"

    cancel_response = client.post(f"/api/v1/smartflow/bulk-messages/{bulk_id}/cancel", headers=headers)
    assert cancel_response.status_code == 200
    assert cancel_response.json()["data"]["status"] == "cancelled"


def test_bulk_sms_send_uses_phone_recipients(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-sms@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com", phone="+8801711111111")

    from app.services.call_service import CallService

    async def fake_send_sms(self, *, to_number: str, message: str, from_number: str | None = None) -> dict:
        return {"sid": "SM_TEST", "to": to_number, "body": message}

    CallService.send_sms = fake_send_sms

    response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "sms",
            "contact_ids": [alex_id],
            "content": "SMS update for client sync.",
            "send_now": True,
        },
    )
    assert response.status_code == 201
    payload = response.json()["data"]
    assert payload["status"] == "sent"
    assert payload["segment_count"] == 1
    assert payload["deliveries"][0]["target"] == "+8801711111111"


def test_bulk_sms_uses_the_organizations_own_telnyx_number(client, mock_db, monkeypatch):
    """Before this fix, send_sms always used the single global
    settings.TELNYX_PHONE_NUMBER regardless of which business triggered the bulk
    send. A business with its own provisioned number must send from THAT number,
    not the platform default -- otherwise Telnyx rejects the send for any business
    whose actual verified/messaging-enabled number differs from the global one."""
    headers = _auth_headers(client, mock_db, email="bulk-sms-org@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com", phone="+8801711111111")

    async def _give_this_business_its_own_number() -> None:
        user = await mock_db.users.find_one({"email": "bulk-sms-org@example.com"})
        organization_id = str(user["_id"])
        await mock_db.users.update_one({"_id": user["_id"]}, {"$set": {"organization_id": organization_id}})
        await mock_db.organizations.update_one(
            {"organization_id": organization_id},
            {"$set": {"telnyx_phone_number": "+19995550100"}},
            upsert=True,
        )

    asyncio.run(_give_this_business_its_own_number())

    from app.services.call_service import CallService

    captured: dict[str, str | None] = {}

    async def fake_send_sms(self, *, to_number: str, message: str, from_number: str | None = None) -> dict:
        captured["from_number"] = from_number
        return {"sid": "SM_TEST", "to": to_number, "body": message}

    monkeypatch.setattr(CallService, "send_sms", fake_send_sms)

    response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={"channel": "sms", "contact_ids": [alex_id], "content": "Org number test", "send_now": True},
    )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["status"] == "sent"
    assert captured["from_number"] == "+19995550100", (
        f"expected the org's own provisioned number, got {captured.get('from_number')!r}"
    )


def test_failed_sms_delivery_reports_the_providers_real_reason(client, mock_db, monkeypatch):
    """A failed broadcast showed the business only our own generic wrapper message
    ("Telnyx could not send the SMS."), because AppException.__str__ drops the
    `details` payload carrying the provider's actual reason. Without that reason
    (a rejected sender, a capability the number lacks, ...) a failure is
    undiagnosable from the UI — the cause was only findable by reproducing the send
    by hand."""
    headers = _auth_headers(client, mock_db, email="bulk-sms-err@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com", phone="+8801711111111")

    from app.services.call_service import CallService

    async def failing_send_sms(self, *, to_number: str, message: str, from_number: str | None = None) -> dict:
        raise AppException(
            status_code=502,
            code="TELNYX_SMS_SEND_FAILED",
            message="Telnyx could not send the SMS.",
            details={"error": "Error code: 409 - Alpha sender not configured"},
        )

    monkeypatch.setattr(CallService, "send_sms", failing_send_sms)

    response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={"channel": "sms", "contact_ids": [alex_id], "content": "will fail", "send_now": True},
    )
    assert response.status_code == 201, response.text
    payload = response.json()["data"]
    assert payload["status"] == "failed"

    delivery_error = payload["deliveries"][0]["error"]
    assert "Alpha sender not configured" in delivery_error, (
        f"the provider's real reason never reached the delivery record: {delivery_error!r}"
    )


def test_sms_config_validator_does_not_require_the_voice_application_id(monkeypatch):
    """SMS and voice calling are configured independently -- a business with SMS set
    up but no voice Call Control application (or vice versa) must not have one
    feature block the other. Before this fix, send_sms reused the voice validator and
    was blocked by a missing TELNYX_VOICE_APPLICATION_ID it never actually uses."""
    from app.core.config import settings
    from app.services.call_service import CallService

    monkeypatch.setattr(settings, "TELNYX_API_KEY", "test-key")
    monkeypatch.setattr(settings, "TELNYX_PHONE_NUMBER", "+19995550100")
    monkeypatch.setattr(settings, "TELNYX_VOICE_APPLICATION_ID", None)

    CallService._validate_telnyx_sms_config()  # must not raise

    monkeypatch.setattr(settings, "TELNYX_PHONE_NUMBER", None)
    with pytest.raises(AppException) as exc_info:
        CallService._validate_telnyx_sms_config()
    assert exc_info.value.code == "TELNYX_NOT_CONFIGURED"


def test_bulk_sms_validation_accepts_manual_phone_recipients(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-sms-raw@example.com")

    response = client.post(
        "/api/v1/smartflow/bulk-messages/recipients/validate",
        headers=headers,
        json={
            "channel": "sms",
            "recipient_emails": ["+1 (555) 555-1234", "invalid-phone", "+1 (555) 555-1234"],
        },
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["valid_count"] == 1
    assert payload["invalid_count"] == 1
    assert payload["duplicate_count"] >= 1
    assert payload["recipients"][0]["phone"] == "+15555551234"


def test_bulk_scheduled_dispatcher_processes_due_campaign(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-scheduled@example.com")

    from app.services.call_service import CallService
    from app.services.smartflow.bulk_message_service import BulkMessageService

    async def fake_send_sms(self, *, to_number: str, message: str, from_number: str | None = None) -> dict:
        return {"sid": "SM_SCHEDULED", "to": to_number, "body": message}

    CallService.send_sms = fake_send_sms

    create_response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "sms",
            "recipient_emails": ["+15555551234"],
            "content": "Scheduled SMS update.",
            "send_now": False,
            "scheduled_at": (utc_now() + timedelta(minutes=5)).isoformat(),
        },
    )
    assert create_response.status_code == 201
    campaign = create_response.json()["data"]
    assert campaign["status"] == "scheduled"

    bulk_service = BulkMessageService(mock_db)
    asyncio.run(
        mock_db.bulk_messages.update_one(
            {"_id": ObjectId(campaign["id"])},
            {"$set": {"scheduled_at": utc_now() - timedelta(seconds=1)}},
        )
    )
    processed = asyncio.run(bulk_service.dispatch_due_scheduled_messages())
    assert processed == 1

    updated = asyncio.run(mock_db.bulk_messages.find_one({"_id": ObjectId(campaign["id"])}))
    assert updated is not None
    assert updated["status"] == "sent"
    assert updated["sent_count"] == 1
    assert updated["deliveries"][0]["target"] == "+15555551234"
