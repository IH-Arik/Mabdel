from __future__ import annotations

import asyncio
import json

from bson import ObjectId

from app.core.config import settings
from app.services.call_service import CallService
from app.tests.conftest import grant_owner_role

BUSINESS_NUMBER = "+15550001111"
CALLER_NUMBER = "+15559998888"


def _webhook_envelope(event_type: str, payload: dict) -> bytes:
    return json.dumps(
        {"data": {"event_type": event_type, "id": "evt_test", "occurred_at": "2026-01-01T00:00:00Z", "payload": payload}}
    ).encode()


def _signup_owner(client, mock_db, email: str = "popup-owner@example.com") -> tuple[dict[str, str], str]:
    assert client.post(
        "/api/v1/auth/register",
        json={"full_name": "Popup Owner", "email": email, "password": "SecurePass2024!"},
    ).status_code == 201
    otp = asyncio.run(mock_db.otp_codes.find_one({"email": email, "purpose": "signup"}, sort=[("created_at", -1)]))
    assert client.post(
        "/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"}
    ).status_code == 200
    grant_owner_role(mock_db, email)

    async def _wire_org() -> str:
        user = await mock_db.users.find_one({"email": email})
        user_id = str(user["_id"])
        await mock_db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"organization_id": user_id, "role": "owner", "primary_role": "owner"}},
        )
        # One shared Telnyx number per business — this is how an inbound call is
        # matched back to the organization that owns the number it was dialled on.
        await mock_db.organizations.update_one(
            {"organization_id": user_id},
            {"$set": {"organization_id": user_id, "telnyx_phone_number": BUSINESS_NUMBER}},
            upsert=True,
        )
        return user_id

    user_id = asyncio.run(_wire_org())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, user_id


def test_incoming_call_shows_up_for_the_browser_to_pop(client, mock_db, monkeypatch) -> None:
    """The website has no push channel for inbound calls — TelnyxVoiceContext polls
    /smartflow/calls every 3s looking for status == "ringing" AND direction == "inbound".
    If either field is missing or renamed the overlay silently never appears, which is
    exactly the case that cannot be checked by hand without a real phone call."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        return None

    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    headers, _ = _signup_owner(client, mock_db)

    client.post(
        "/api/v1/calls/webhook",
        content=_webhook_envelope(
            "call.initiated",
            {
                "call_control_id": "v2:popup-test",
                "direction": "incoming",
                "from": CALLER_NUMBER,
                "to": BUSINESS_NUMBER,
            },
        ),
    )

    listed = client.get("/api/v1/smartflow/calls", headers=headers, params={"page": 1, "page_size": 5})
    assert listed.status_code == 200, listed.text
    items = listed.json()["data"]["items"]

    # Exactly the predicate the browser overlay uses.
    ringing = [item for item in items if item.get("status") == "ringing" and item.get("direction") == "inbound"]
    assert ringing, (
        "browser poll would never fire the incoming-call overlay; "
        f"got {[(i.get('status'), i.get('direction')) for i in items]}"
    )

    call = ringing[0]
    assert call.get("twilio_call_sid") == "v2:popup-test", "overlay needs the call id to accept/reject"
    assert call.get("from_number") == CALLER_NUMBER, "overlay shows the caller's number"


def test_incoming_call_is_visible_to_a_colleague_not_just_the_owner(client, mock_db, monkeypatch) -> None:
    """The number belongs to the business, so any teammate at a browser should be
    able to pick it up — not only the owner the call log is attributed to."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        return None

    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    _, owner_id = _signup_owner(client, mock_db, email="popup-owner2@example.com")

    staff_email = "popup-staff@example.com"
    assert client.post(
        "/api/v1/auth/register",
        json={"full_name": "Popup Staff", "email": staff_email, "password": "SecurePass2024!"},
    ).status_code == 201
    otp = asyncio.run(mock_db.otp_codes.find_one({"email": staff_email, "purpose": "signup"}, sort=[("created_at", -1)]))
    client.post("/api/v1/auth/verify-otp", json={"email": staff_email, "code": otp["code"], "purpose": "signup"})
    grant_owner_role(mock_db, staff_email)

    async def _join_org() -> None:
        staff = await mock_db.users.find_one({"email": staff_email})
        await mock_db.users.update_one({"_id": staff["_id"]}, {"$set": {"organization_id": owner_id}})

    asyncio.run(_join_org())

    staff_login = client.post("/api/v1/auth/login", json={"email": staff_email, "password": "SecurePass2024!"})
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['data']['access_token']}"}

    client.post(
        "/api/v1/calls/webhook",
        content=_webhook_envelope(
            "call.initiated",
            {
                "call_control_id": "v2:popup-team",
                "direction": "incoming",
                "from": CALLER_NUMBER,
                "to": BUSINESS_NUMBER,
            },
        ),
    )

    listed = client.get("/api/v1/smartflow/calls", headers=staff_headers, params={"page": 1, "page_size": 5})
    assert listed.status_code == 200, listed.text
    ringing = [
        item
        for item in listed.json()["data"]["items"]
        if item.get("status") == "ringing" and item.get("direction") == "inbound"
    ]
    assert ringing, "a teammate at a browser would never see the business's incoming call"
