from __future__ import annotations

import asyncio
from datetime import datetime

from bson import ObjectId

from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.calendar_service import CalendarService
from app.tests.test_ai_call_scheduling import _owner_with_org

CALLER = "+15551230000"
TUESDAY = "2026-08-18"


def _setup(client, mock_db, monkeypatch, email, *, org_overrides=None):
    headers, owner_id = _owner_with_org(client, mock_db, email)
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))

    async def _org():
        await mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "business_hours": {"timezone": "America/Chicago", "days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                **(org_overrides or {}),
            }
        )

    asyncio.run(_org())
    return headers, owner_id, AppointmentService(mock_db)


def _texts(mock_db):
    return asyncio.run(mock_db.messages.find({"platform": "sms", "automated": True}).sort("timestamp", 1).to_list(None))


def test_cancellations_are_immediate_by_default_even_with_global_approval_on(client, mock_db, monkeypatch):
    # The long-standing behavior: turning on the old single approval switch must not
    # start blocking cancellations, since cancellations were never gated by it before.
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "approval-cancel-default@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))
    # Approval for new bookings is switched on only after the appointment already
    # exists, so it never interferes with placing the booking itself.
    asyncio.run(mock_db.organizations.update_one({"organization_id": owner_id}, {"$set": {"require_meeting_approval": True}}))

    cancelled = asyncio.run(service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, caller_name="Nadia"))

    assert cancelled["outcome"] == "cancelled"
    assert asyncio.run(mock_db.calendar_events.count_documents({"_id": ObjectId(booked["appointment_id"])})) == 0


def test_cancellation_approval_can_be_turned_on_independently(client, mock_db, monkeypatch):
    headers, owner_id, service = _setup(
        client, mock_db, monkeypatch, "approval-cancel-on@example.com", org_overrides={"require_approval_for_cancellations": True}
    )
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    result = asyncio.run(service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, caller_name="Nadia"))

    assert result["outcome"] == "pending_cancellation"
    # The appointment is untouched until someone on the team acts on it.
    assert asyncio.run(mock_db.calendar_events.count_documents({"_id": ObjectId(booked["appointment_id"])})) == 1
    request = asyncio.run(mock_db.call_meeting_requests.find_one({"kind": "cancel"}))
    assert request["status"] == "pending" and request["calendar_event_id"] == booked["appointment_id"]


def test_accepting_a_pending_cancellation_deletes_the_appointment(client, mock_db, monkeypatch):
    headers, owner_id, service = _setup(
        client, mock_db, monkeypatch, "approval-cancel-accept@example.com", org_overrides={"require_approval_for_cancellations": True}
    )
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))
    asyncio.run(service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, caller_name="Nadia"))
    request = asyncio.run(mock_db.call_meeting_requests.find_one({"kind": "cancel"}))

    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request['_id']}/accept", headers=headers)

    assert response.status_code == 200, response.text
    assert asyncio.run(mock_db.calendar_events.count_documents({"_id": ObjectId(booked["appointment_id"])})) == 0
    updated_request = asyncio.run(mock_db.call_meeting_requests.find_one({"_id": request["_id"]}))
    assert updated_request["status"] == "confirmed"
    # calendar delete's own notification path sends the "cancelled" text.
    assert _texts(mock_db)[-1]["content"].startswith("Bright Dental: your appointment on")
    assert "cancelled" in _texts(mock_db)[-1]["content"]


def test_declining_a_pending_cancellation_keeps_the_appointment_and_uses_distinct_wording(client, mock_db, monkeypatch):
    headers, owner_id, service = _setup(
        client, mock_db, monkeypatch, "approval-cancel-decline@example.com", org_overrides={"require_approval_for_cancellations": True}
    )
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))
    asyncio.run(service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, caller_name="Nadia"))
    request = asyncio.run(mock_db.call_meeting_requests.find_one({"kind": "cancel"}))

    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request['_id']}/decline", headers=headers)

    assert response.status_code == 200, response.text
    # The appointment survives - declining a cancellation is the opposite of declining a booking.
    assert asyncio.run(mock_db.calendar_events.count_documents({"_id": ObjectId(booked["appointment_id"])})) == 1
    last_text = _texts(mock_db)[-1]["content"]
    assert "still on the books" in last_text
    assert "sorry, we can't confirm" not in last_text


def test_reschedule_approval_is_independent_of_cancellation_approval(client, mock_db, monkeypatch):
    # Turning on cancellation approval alone must not start gating reschedules.
    _, owner_id, service = _setup(
        client, mock_db, monkeypatch, "approval-independent@example.com", org_overrides={"require_approval_for_cancellations": True}
    )
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    moved = asyncio.run(service.reschedule(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, day=TUESDAY, time="14:00", caller_name="Nadia"))

    assert moved["outcome"] == "rescheduled"


def test_settings_endpoint_exposes_and_persists_all_three_switches(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "approval-settings@example.com")

    response = client.patch(
        "/api/v1/smartflow/ai-call-settings",
        json={"require_meeting_approval": True, "require_approval_for_reschedules": False, "require_approval_for_cancellations": True},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["require_meeting_approval"] is True
    assert data["require_approval_for_reschedules"] is False
    assert data["require_approval_for_cancellations"] is True

    fetched = client.get("/api/v1/smartflow/ai-call-settings", headers=headers)
    fetched_data = fetched.json()["data"]
    assert fetched_data["require_meeting_approval"] is True
    assert fetched_data["require_approval_for_reschedules"] is False
    assert fetched_data["require_approval_for_cancellations"] is True
