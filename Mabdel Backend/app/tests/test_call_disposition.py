from __future__ import annotations

import asyncio

from bson import ObjectId

from app.services.realtime_receptionist import _derive_call_disposition
from app.services.smartflow.call_history_service import CallHistoryService
from app.tests.test_ai_call_scheduling import _owner_with_org


def test_a_successful_booking_is_the_disposition():
    actions = [
        {"tool": "check_availability", "result": {"slots": []}},
        {"tool": "book_appointment", "result": {"outcome": "booked"}},
    ]
    assert _derive_call_disposition(actions) == "booked"


def test_a_failed_booking_attempt_does_not_count_as_booked():
    actions = [{"tool": "book_appointment", "result": {"outcome": "unavailable", "reason": "That time is not available."}}]
    assert _derive_call_disposition(actions) == "faq_only"


def test_a_pending_approval_booking_still_counts_as_booked():
    actions = [{"tool": "book_appointment", "result": {"outcome": "pending"}}]
    assert _derive_call_disposition(actions) == "booked"


def test_a_failed_transfer_falls_back_to_message_taken_when_a_message_was_also_left():
    actions = [
        {"tool": "transfer_to_human", "result": {"transferred": False, "note": "Nobody is available."}},
        {"tool": "take_message", "result": {"saved": True}},
    ]
    assert _derive_call_disposition(actions) == "message_taken"


def test_a_successful_transfer_outranks_a_message_taken_earlier_in_the_call():
    actions = [
        {"tool": "take_message", "result": {"saved": True}},
        {"tool": "transfer_to_human", "result": {"transferred": True}},
    ]
    assert _derive_call_disposition(actions) == "transferred"


def test_booking_outranks_an_earlier_cancellation_in_the_same_call():
    actions = [
        {"tool": "cancel_appointment", "result": {"outcome": "cancelled"}},
        {"tool": "book_appointment", "result": {"outcome": "booked"}},
    ]
    assert _derive_call_disposition(actions) == "booked"


def test_no_actions_at_all_is_faq_only():
    assert _derive_call_disposition([]) == "faq_only"
    assert _derive_call_disposition(None) == "faq_only"


def test_a_notify_team_playbook_action_counts_as_message_taken():
    actions = [{"tool": "notify_team", "result": {"notified": True}}]
    assert _derive_call_disposition(actions) == "message_taken"


def test_call_log_serialization_exposes_a_human_readable_label(client, mock_db, monkeypatch):
    _, owner_id = _owner_with_org(client, mock_db, "disposition-label@example.com")
    call_id = asyncio.run(
        mock_db.call_logs.insert_one(
            {"user_id": owner_id, "twilio_call_sid": "call-disp", "disposition": "rescheduled", "status": "completed", "call_type": "incoming"}
        )
    ).inserted_id
    service = CallHistoryService(mock_db)

    call = asyncio.run(mock_db.call_logs.find_one({"_id": call_id}))
    serialized = asyncio.run(service._serialize_call_log(call))

    assert serialized["disposition"] == "rescheduled"
    assert serialized["disposition_label"] == "Rescheduled"


def test_listing_can_be_filtered_by_disposition(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "disposition-filter@example.com")
    asyncio.run(
        mock_db.call_logs.insert_many(
            [
                {"user_id": owner_id, "twilio_call_sid": "a", "disposition": "booked", "status": "completed", "call_type": "incoming", "timestamp": None},
                {"user_id": owner_id, "twilio_call_sid": "b", "disposition": "faq_only", "status": "completed", "call_type": "incoming", "timestamp": None},
            ]
        )
    )

    response = client.get("/api/v1/smartflow/calls", params={"disposition": "booked"}, headers=headers)

    assert response.status_code == 200, response.text
    items = response.json()["data"]["items"]
    assert len(items) == 1 and items[0]["disposition"] == "booked"
