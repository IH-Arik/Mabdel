from __future__ import annotations

import asyncio
import json

from app.core.config import settings
from app.services.call_service import CallService


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


def _auth_headers(client, mock_db, email: str = "calls@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Call User", "email": email, "password": "SecurePass2024!"},
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


def _create_contact(client, headers: dict[str, str], *, name: str, phone: str) -> str:
    response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": name, "phone": phone},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def _webhook_envelope(event_type: str, payload: dict) -> bytes:
    return json.dumps(
        {"data": {"event_type": event_type, "id": "evt_test", "occurred_at": "2026-01-01T00:00:00Z", "payload": payload}}
    ).encode()


def test_outbound_call_can_be_started_from_contact(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db)
    contact_id = _create_contact(client, headers, name="Rahim Uddin", phone="+8801700000001")

    monkeypatch.setattr(settings, "TELNYX_PHONE_NUMBER", "+15550000000")

    async def fake_initiate(self, *, to_number: str, from_number: str | None, user_id: str, call_log_id: str) -> dict:
        return {
            "sid": "v2:outbound-123",
            "status": "queued",
            "to": to_number,
            "from": from_number or settings.TELNYX_PHONE_NUMBER,
        }

    monkeypatch.setattr(CallService, "initiate_outbound_call", fake_initiate)

    response = client.post(
        "/api/v1/smartflow/calls/outbound",
        headers=headers,
        json={"contact_id": contact_id},
    )

    assert response.status_code == 201
    payload = response.json()["data"]
    assert payload["twilio_call_sid"] == "v2:outbound-123"
    assert payload["twilio_status"] == "queued"
    assert payload["call_log"]["contact_id"] == contact_id
    assert payload["call_log"]["phone_number"] == "+8801700000001"
    assert payload["call_log"]["call_type"] == "outbound"
    assert payload["call_log"]["status"] == "queued"


def test_outbound_call_webhook_updates_call_log(client, mock_db, monkeypatch):
    """The Telnyx Call Control webhook (not a per-call status callback URl) drives updates now."""
    headers = _auth_headers(client, mock_db, email="calls-status@example.com")
    contact_id = _create_contact(client, headers, name="Karim Mia", phone="+8801700000002")

    monkeypatch.setattr(settings, "TELNYX_PHONE_NUMBER", "+15550000000")
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    async def fake_initiate(self, *, to_number: str, from_number: str | None, user_id: str, call_log_id: str) -> dict:
        return {
            "sid": "v2:outbound-456",
            "status": "queued",
            "to": to_number,
            "from": from_number or settings.TELNYX_PHONE_NUMBER,
        }

    monkeypatch.setattr(CallService, "initiate_outbound_call", fake_initiate)

    create_response = client.post(
        "/api/v1/smartflow/calls/outbound",
        headers=headers,
        json={"contact_id": contact_id},
    )
    assert create_response.status_code == 201

    hangup_body = _webhook_envelope(
        "call.hangup",
        {
            "call_control_id": "v2:outbound-456",
            "hangup_cause": "normal_clearing",
            "call_duration_secs": 63,
            "from": "+15550000000",
            "to": "+8801700000002",
        },
    )
    webhook_response = client.post("/api/v1/calls/webhook", content=hangup_body)
    assert webhook_response.status_code == 200

    updated_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:outbound-456"}))
    assert updated_log["status"] == "completed"
    assert updated_log["duration"] == 63


def test_outbound_ai_call_starts_streaming_on_bridged_event(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="calls-ai-bridged@example.com")
    contact_id = _create_contact(client, headers, name="AI Call Target", phone="+8801700000004")

    monkeypatch.setattr(settings, "TELNYX_PHONE_NUMBER", "+15550000000")
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    async def fake_initiate(self, *, to_number: str, from_number: str | None, user_id: str, call_log_id: str) -> dict:
        return {
            "sid": "v2:outbound-ai-bridged",
            "status": "queued",
            "to": to_number,
            "from": from_number or settings.TELNYX_PHONE_NUMBER,
        }

    started_streams: list[dict] = []

    async def fake_start_streaming(self, call_control_id: str, *, websocket_url: str) -> bool:
        started_streams.append({"call_control_id": call_control_id, "websocket_url": websocket_url})
        return True

    monkeypatch.setattr(CallService, "initiate_outbound_call", fake_initiate)
    monkeypatch.setattr(CallService, "start_streaming", fake_start_streaming)

    create_response = client.post(
        "/api/v1/smartflow/calls/outbound",
        headers=headers,
        json={"contact_id": contact_id, "ai_ready": True},
    )
    assert create_response.status_code == 201

    bridged_body = _webhook_envelope(
        "call.bridged",
        {
            "call_control_id": "v2:outbound-ai-bridged",
            "from": "+15550000000",
            "to": "+8801700000004",
        },
    )
    webhook_response = client.post("/api/v1/calls/webhook", content=bridged_body)
    assert webhook_response.status_code == 200

    assert len(started_streams) == 1
    assert started_streams[0]["call_control_id"] == "v2:outbound-ai-bridged"

    updated_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:outbound-ai-bridged"}))
    assert updated_log["ai_stream_started"] is True


def test_outbound_call_requires_telnyx_configuration(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="calls-unconfigured@example.com")
    contact_id = _create_contact(client, headers, name="Nasrin Akter", phone="+8801700000003")

    monkeypatch.setattr(settings, "TELNYX_API_KEY", None)
    monkeypatch.setattr(settings, "TELNYX_PHONE_NUMBER", None)
    monkeypatch.setattr(settings, "TELNYX_VOICE_APPLICATION_ID", None)

    response = client.post(
        "/api/v1/smartflow/calls/outbound",
        headers=headers,
        json={"contact_id": contact_id},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "TELNYX_NOT_CONFIGURED"
