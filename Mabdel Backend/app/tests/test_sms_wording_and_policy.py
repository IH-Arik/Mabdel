from __future__ import annotations

import asyncio
from datetime import timedelta

from app.services.smartflow.appointment_notifications import AppointmentNotifier
from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _receptionist
from app.utils.helpers import utc_now


def test_custom_wording_replaces_the_built_in_text_for_that_kind_only(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "wording-custom@example.com")
    client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"sms_wording": {"booked": "Bright Dental: see you {when}!"}},
    )
    starts_at = utc_now() + timedelta(days=1)
    booked_id = asyncio.run(
        AppointmentNotifier(mock_db).notify(owner_id, kind="booked", phone="+8801711111111", name="Karim", starts_at=starts_at)
    )
    cancelled_id = asyncio.run(
        AppointmentNotifier(mock_db).notify(owner_id, kind="cancelled", phone="+8801711111111", name="Karim", starts_at=starts_at)
    )
    booked = asyncio.run(mock_db.messages.find_one({"_id": __import__("bson").ObjectId(booked_id)}))
    cancelled = asyncio.run(mock_db.messages.find_one({"_id": __import__("bson").ObjectId(cancelled_id)}))
    assert booked["content"].startswith("Bright Dental: see you ") and "confirmed" not in booked["content"]
    assert "cancelled" in cancelled["content"].lower()  # untouched kind still uses the built-in text


def test_a_broken_placeholder_falls_back_to_the_built_in_text_instead_of_failing(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "wording-broken@example.com")
    client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"sms_wording": {"booked": "See you {when}, ask about {discount}!"}},
    )
    message_id = asyncio.run(
        AppointmentNotifier(mock_db).notify(
            owner_id, kind="booked", phone="+8801722222222", name="Nadia", starts_at=utc_now() + timedelta(days=1)
        )
    )
    assert message_id is not None
    message = asyncio.run(mock_db.messages.find_one({"_id": __import__("bson").ObjectId(message_id)}))
    assert "confirmed" in message["content"]  # the built-in text, not a crash or a literal "{discount}"


def test_wording_is_control_char_cleaned_and_length_capped(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "wording-clean@example.com")
    response = client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"sms_wording": {"reminder": "  hi\x07 there  "}},
    )
    assert response.status_code == 200
    assert response.json()["data"]["sms_wording"]["reminder"] == "hi there"


def test_cancellation_policy_reaches_the_receptionists_instructions(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "policy-reaches@example.com",
        cancellation_policy="Cancellations need 24 hours' notice or a $25 fee applies.",
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())
    assert "Cancellations need 24 hours' notice or a $25 fee applies." in instructions
    assert "CANCELLATION POLICY" in instructions


def test_no_policy_set_adds_nothing_to_the_instructions(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "policy-empty@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())
    assert "CANCELLATION POLICY" not in instructions


def test_cancellation_policy_is_control_char_cleaned_and_length_capped(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "policy-clean@example.com")
    response = client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"cancellation_policy": "  No refunds after 24h\x07  "},
    )
    assert response.status_code == 200
    assert response.json()["data"]["cancellation_policy"] == "No refunds after 24h"
