from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac

from app.core.config import settings
from app.services.call_service import CallService


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


def _twilio_signature(url: str, form_data: dict[str, str], auth_token: str) -> str:
    payload = url + "".join(f"{key}{form_data[key]}" for key in sorted(form_data))
    digest = hmac.new(auth_token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("utf-8")


def test_outbound_call_can_be_started_from_contact(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db)
    contact_id = _create_contact(client, headers, name="Rahim Uddin", phone="+8801700000001")

    monkeypatch.setattr(settings, "TWILIO_PHONE_NUMBER", "+15550000000")

    async def fake_initiate(self, *, to_number: str, from_number: str | None, user_id: str, call_log_id: str) -> dict:
        return {
            "sid": "CA_OUTBOUND_123",
            "status": "queued",
            "to": to_number,
            "from": from_number or settings.TWILIO_PHONE_NUMBER,
        }

    monkeypatch.setattr(CallService, "initiate_outbound_call", fake_initiate)

    response = client.post(
        "/api/v1/smartflow/calls/outbound",
        headers=headers,
        json={"contact_id": contact_id},
    )

    assert response.status_code == 201
    payload = response.json()["data"]
    assert payload["twilio_call_sid"] == "CA_OUTBOUND_123"
    assert payload["twilio_status"] == "queued"
    assert payload["call_log"]["contact_id"] == contact_id
    assert payload["call_log"]["phone_number"] == "+8801700000001"
    assert payload["call_log"]["call_type"] == "outbound"


def test_outbound_call_status_callback_updates_call_log(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="calls-status@example.com")
    contact_id = _create_contact(client, headers, name="Karim Mia", phone="+8801700000002")

    monkeypatch.setattr(settings, "TWILIO_PHONE_NUMBER", "+15550000000")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", True)

    async def fake_initiate(self, *, to_number: str, from_number: str | None, user_id: str, call_log_id: str) -> dict:
        return {
            "sid": "CA_OUTBOUND_456",
            "status": "initiated",
            "to": to_number,
            "from": from_number or settings.TWILIO_PHONE_NUMBER,
        }

    monkeypatch.setattr(CallService, "initiate_outbound_call", fake_initiate)

    create_response = client.post(
        "/api/v1/smartflow/calls/outbound",
        headers=headers,
        json={"contact_id": contact_id},
    )
    assert create_response.status_code == 201
    call_log_id = create_response.json()["data"]["call_log"]["id"]

    me_response = client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    user_id = me_response.json()["data"]["id"]

    form_data = {
        "CallSid": "CA_OUTBOUND_456",
        "CallStatus": "completed",
        "CallDuration": "63",
        "From": "+15550000000",
        "To": "+8801700000002",
    }
    url = f"http://testserver/api/v1/calls/status?user_id={user_id}&call_log_id={call_log_id}"
    signature = _twilio_signature(url, form_data, settings.TWILIO_AUTH_TOKEN)

    status_response = client.post(
        f"/api/v1/calls/status?user_id={user_id}&call_log_id={call_log_id}",
        data=form_data,
        headers={"X-Twilio-Signature": signature},
    )
    assert status_response.status_code == 200
    updated_log = status_response.json()["data"]["call_log"]
    assert updated_log["twilio_call_sid"] == "CA_OUTBOUND_456"
    assert updated_log["status"] == "completed"
    assert updated_log["duration"] == 63
