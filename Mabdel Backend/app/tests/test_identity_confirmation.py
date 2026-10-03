from __future__ import annotations

import asyncio
import json
from datetime import datetime

from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.calendar_service import CalendarService
from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_realtime_receptionist import FakeOpenAI, _receptionist

CALLER = "+15551230000"
TUESDAY = "2026-08-18"


def _setup(client, mock_db, monkeypatch, email):
    headers, owner_id = _owner_with_org(client, mock_db, email)
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))

    async def _org():
        await mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "business_hours": {"timezone": "America/Chicago", "days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
            }
        )

    asyncio.run(_org())
    return headers, owner_id, AppointmentService(mock_db)


def test_rescheduling_without_confirming_the_name_is_refused(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "identity-no-name@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    result = asyncio.run(service.reschedule(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, day=TUESDAY, time="14:00"))

    assert result["outcome"] == "not_possible"
    assert "confirm" in result["reason"].lower()


def test_a_mismatched_name_is_refused_even_though_the_phone_matches(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "identity-mismatch@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    result = asyncio.run(
        service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, caller_name="Someone Totally Different")
    )

    assert result["outcome"] == "not_possible"
    event = asyncio.run(mock_db.calendar_events.find_one({"customer.phone": CALLER}))
    assert event is not None  # untouched


def test_a_first_name_only_match_is_accepted(client, mock_db, monkeypatch):
    # The caller doesn't have to recite the exact full name on file - just enough to
    # show it's genuinely them, not merely someone dialling from the same phone.
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "identity-first-name@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    result = asyncio.run(service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, caller_name="Nadia"))

    assert result["outcome"] == "cancelled"


def test_a_case_insensitive_match_is_accepted(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "identity-case@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    result = asyncio.run(service.reschedule(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, day=TUESDAY, time="14:00", caller_name="NADIA RAHMAN"))

    assert result["outcome"] == "rescheduled"


def test_an_appointment_with_no_name_on_file_skips_the_check(client, mock_db, monkeypatch):
    # Older/manual bookings may have no customer name captured at all - nothing to
    # verify against, so the check must not block a legitimate caller forever.
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "identity-no-stored-name@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00"))
    from bson import ObjectId

    asyncio.run(mock_db.calendar_events.update_one({"_id": ObjectId(booked["appointment_id"])}, {"$set": {"customer.name": ""}}))

    result = asyncio.run(service.cancel(owner_id, appointment_id=booked["appointment_id"], phone=CALLER))

    assert result["outcome"] == "cancelled"


def test_find_my_appointments_never_reveals_the_customer_name(client, mock_db, monkeypatch):
    # The whole point of asking the caller to confirm the name is defeated if the AI
    # can just read it back to itself from this lookup first.
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "identity-no-leak@example.com")
    asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    result = asyncio.run(service.find_upcoming(owner_id, CALLER))

    [appointment] = result["appointments"]
    assert "Nadia" not in json.dumps(appointment)
    assert "title" not in appointment


def test_live_call_cancel_tool_requires_a_caller_name_argument(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "identity-tool-required@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "business_hours": {"timezone": "America/Chicago", "days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
            }
        )
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    async def run():
        booked = await agent.run_tool("book_appointment", json.dumps({"date": TUESDAY, "time": "10:00", "first_name": "Nadia"}))
        assert booked["outcome"] == "booked"
        missing_name = await agent.run_tool("cancel_appointment", json.dumps({"appointment_id": booked["appointment_id"]}))
        assert "error" in missing_name
        return booked

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    booked = asyncio.run(run())
    event = asyncio.run(mock_db.calendar_events.find_one({"customer.phone": "+15551230000"}))
    assert event is not None  # the cancel attempt without a name never touched it
