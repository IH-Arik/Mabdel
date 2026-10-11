from __future__ import annotations

import asyncio

from app.tests.test_realtime_receptionist import FakeOpenAI, _business, _receptionist
from app.tests.test_ai_call_scheduling import _owner_with_org


def test_every_business_starts_with_the_8_default_purposes(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "outbound-purposes-default@example.com")

    response = client.get("/api/v1/smartflow/ai-call-settings", headers=headers)

    assert response.status_code == 200, response.text
    purposes = response.json()["data"]["outbound_call_purposes"]
    assert len(purposes) == 8
    names = {item["name"] for item in purposes}
    assert names == {
        "Appointment Reminder", "Appointment Confirmation", "Missed-Call Callback",
        "Lead Follow-Up", "Estimate/Quote Follow-Up", "Customer Reactivation",
        "Service Reminder", "Custom Outbound Campaign",
    }


def test_owner_can_edit_add_and_remove_purposes(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "outbound-purposes-crud@example.com")
    current = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]
    purposes = current["outbound_call_purposes"]
    purposes.append(
        {
            "id": "custom-winback",
            "name": "VIP Win-Back",
            "opening_message": "Hi, we miss having you as a customer.",
            "objective": "Win back a VIP customer.",
            "questions_to_ask": ["What would bring you back?"],
            "allowed_actions": ["Offer a discount", "Book an appointment"],
            "closing_message": "Hope to see you again soon!",
            "follow_up_sms": "{business}: we'd love to have you back!",
            "active": True,
        }
    )

    response = client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"outbound_call_purposes": purposes})

    assert response.status_code == 200, response.text
    saved = response.json()["data"]["outbound_call_purposes"]
    assert len(saved) == 9
    custom = next(item for item in saved if item["id"] == "custom-winback")
    assert custom["name"] == "VIP Win-Back" and custom["questions_to_ask"] == ["What would bring you back?"]

    fetched = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]["outbound_call_purposes"]
    assert len(fetched) == 9  # persisted, not just echoed back


def test_a_custom_purpose_reaches_the_live_call_prompt(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "outbound-purposes-custom@example.com",
        outbound_call_purposes=[
            {
                "id": "vip-checkin", "name": "VIP Check-In", "active": True,
                "opening_message": "Hi, just checking in to see how everything's going.",
                "objective": "Make sure a VIP customer is happy with recent service.",
                "questions_to_ask": ["How has everything been?"],
                "allowed_actions": ["Take a message", "Transfer to a team member"],
                "closing_message": "Thanks so much for your time!",
                "follow_up_sms": None,
            }
        ],
    )
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        agent.is_outbound = True
        agent.call_log = {"purpose": "vip-checkin", "script_notes": None}
        await agent.connect()

    asyncio.run(run())
    instructions = socket.of_type("session.update")[0]["session"]["instructions"]
    assert 'Purpose: "VIP Check-In"' in instructions
    assert "How has everything been?" in instructions
    assert "Transfer to a team member" in instructions


def test_an_unknown_purpose_id_falls_back_to_a_generic_line_instead_of_failing(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "outbound-purposes-unknown@example.com")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        agent.is_outbound = True
        agent.call_log = {"purpose": "some_deleted_purpose_id", "script_notes": "Call about the invoice."}
        await agent.connect()

    asyncio.run(run())
    instructions = socket.of_type("session.update")[0]["session"]["instructions"]
    assert "OUTBOUND CALL" in instructions and "some deleted purpose id" in instructions
    assert "Call about the invoice." in instructions  # notes still come through


def test_an_inactive_purpose_is_treated_as_not_found(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "outbound-purposes-inactive@example.com",
        outbound_call_purposes=[
            {"id": "paused-campaign", "name": "Paused Campaign", "active": False, "opening_message": "Should never be spoken"},
        ],
    )
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        agent.is_outbound = True
        agent.call_log = {"purpose": "paused-campaign", "script_notes": None}
        await agent.connect()

    asyncio.run(run())
    instructions = socket.of_type("session.update")[0]["session"]["instructions"]
    assert "Should never be spoken" not in instructions
    assert "OUTBOUND CALL" in instructions
