from __future__ import annotations

import asyncio

from app.tests.conftest import grant_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _owner_with_org(client, mock_db, email: str, role: str = "owner") -> tuple[dict[str, str], str]:
    assert client.post(
        "/api/v1/auth/register",
        json={"full_name": "Owner", "email": email, "password": "SecurePass2024!"},
    ).status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    assert client.post(
        "/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"}
    ).status_code == 200
    grant_role(mock_db, email, role)

    async def _self_org() -> str:
        user = await mock_db.users.find_one({"email": email})
        await mock_db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"organization_id": str(user["_id"]), "role": role, "primary_role": role}},
        )
        return str(user["_id"])

    organization_id = asyncio.run(_self_org())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, organization_id


def _seed_open_business_hours(mock_db, organization_id: str) -> None:
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": organization_id},
            {"$set": {"business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}},
            upsert=True,
        )
    )


# ── start / message / end ────────────────────────────────────────────────


def test_start_session_returns_session_id_and_greeting(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "aitest-start@example.com")

    response = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["session_id"]
    assert isinstance(data["greeting"], str) and data["greeting"]


def test_start_session_uses_the_configured_custom_greeting(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "aitest-greeting@example.com")
    patched = client.patch(
        "/api/v1/smartflow/ai-call-settings", headers=headers, json={"greeting_inbound": "Welcome to Test Co."}
    )
    assert patched.status_code == 200, patched.text

    response = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    assert response.status_code == 200, response.text
    assert "Welcome to Test Co." in response.json()["data"]["greeting"]


def test_message_returns_a_reply_and_advances_the_conversation(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "aitest-msg@example.com")
    start = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    session_id = start.json()["data"]["session_id"]

    response = client.post(
        f"/api/v1/smartflow/ai-call-settings/test/{session_id}/message",
        headers=headers,
        json={"message": "What are your hours?"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert isinstance(data["reply"], str) and data["reply"]
    assert data["ended"] is False


def test_full_simulated_booking_flow_never_touches_real_records(client, mock_db):
    """The whole point of is_simulation=True: driving the real scheduling flow to a
    completed booking must not create a real call_meeting_requests document, a real
    calendar_events document, or a real call_logs document — the simulator is
    text-in/text-out only."""
    headers, organization_id = _owner_with_org(client, mock_db, "aitest-booking@example.com")
    _seed_open_business_hours(mock_db, organization_id)
    client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"closing_message": "Talk soon, bye!"},
    )

    start = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    assert start.status_code == 200, start.text
    session_id = start.json()["data"]["session_id"]

    def _send(message: str) -> dict:
        resp = client.post(
            f"/api/v1/smartflow/ai-call-settings/test/{session_id}/message",
            headers=headers,
            json={"message": message},
        )
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]

    r1 = _send("I'd like to schedule a meeting")
    assert r1["ended"] is False
    _send("Yes that works")
    _send("John")
    _send("Smith")
    r5 = _send("+15551234567")  # no caller-ID preset in a simulation, so it's asked for
    assert "correct" in r5["reply"].lower()  # confirm_phone_readback read-back
    _send("Yes, that's right")
    _send("john at example dot com")
    _send("Yes, that's correct")
    final = _send("Yes, send it")

    assert final["ended"] is True
    assert "Talk soon, bye!" in final["reply"]
    # A realistic booking confirmation, not a generic error.
    assert "booked" in final["reply"].lower() or "team" in final["reply"].lower()

    assert asyncio.run(mock_db.call_meeting_requests.count_documents({})) == 0
    assert asyncio.run(mock_db.calendar_events.count_documents({})) == 0
    assert asyncio.run(mock_db.call_logs.count_documents({})) == 0
    assert asyncio.run(mock_db.notifications.count_documents({})) == 0


def test_delete_ends_the_session_so_further_messages_404(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "aitest-end@example.com")
    start = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    session_id = start.json()["data"]["session_id"]

    ended = client.delete(f"/api/v1/smartflow/ai-call-settings/test/{session_id}", headers=headers)
    assert ended.status_code == 200, ended.text

    response = client.post(
        f"/api/v1/smartflow/ai-call-settings/test/{session_id}/message",
        headers=headers,
        json={"message": "hello?"},
    )
    assert response.status_code == 404


def test_unknown_session_id_returns_404(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "aitest-unknown@example.com")
    response = client.post(
        "/api/v1/smartflow/ai-call-settings/test/does-not-exist/message",
        headers=headers,
        json={"message": "hi"},
    )
    assert response.status_code == 404


def test_one_owners_session_is_not_reachable_by_another_organization(client, mock_db):
    headers_a, _ = _owner_with_org(client, mock_db, "aitest-org-a@example.com")
    headers_b, _ = _owner_with_org(client, mock_db, "aitest-org-b@example.com")

    start = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers_a)
    session_id = start.json()["data"]["session_id"]

    response = client.post(
        f"/api/v1/smartflow/ai-call-settings/test/{session_id}/message",
        headers=headers_b,
        json={"message": "hi"},
    )
    assert response.status_code == 404


def test_starting_a_test_session_requires_calls_manage(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "aitest-staff@example.com", role="staff")
    response = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    assert response.status_code == 403, response.text
