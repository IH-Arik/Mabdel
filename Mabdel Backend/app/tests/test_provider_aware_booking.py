from __future__ import annotations

import asyncio
from datetime import datetime

from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.calendar_service import CalendarService
from app.tests.test_ai_call_scheduling import _owner_with_org


def _setup(client, mock_db, email):
    _, owner_id = _owner_with_org(client, mock_db, email)
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner_id},
            {"$set": {"business_hours": {"timezone": "UTC", "days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 30}}},
        )
    )
    return owner_id


def _provider(mock_db, owner_id, name):
    doc = asyncio.run(mock_db.providers.insert_one({"user_id": owner_id, "name": name, "role_title": None, "linked_user_id": None, "active": True}))
    return str(doc.inserted_id)


def _appointment_type(mock_db, owner_id, name, minutes):
    doc = asyncio.run(mock_db.appointment_types.insert_one({"user_id": owner_id, "name": name, "duration_minutes": minutes, "active": True}))
    return str(doc.inserted_id)


def test_two_providers_can_be_booked_for_the_same_time(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-avail@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))  # a Monday
    smith_id = _provider(mock_db, owner_id, "Dr. Smith")
    jane_id = _provider(mock_db, owner_id, "Hygienist Jane")
    service = AppointmentService(mock_db)

    # book Dr. Smith at 10:00
    booked = asyncio.run(service.book(owner_id, name="Karim", phone="+8801711111111", email=None, day="2026-09-21", time="10:00", provider_name="Dr. Smith"))
    assert booked["outcome"] == "booked", booked

    # Jane is a different provider and must still be free at 10:00
    jane_slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Hygienist Jane"))
    assert "10:00" in [slot["time"] for slot in jane_slots["slots"]]

    # but Dr. Smith herself is now busy at 10:00
    smith_slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Dr. Smith"))
    assert "10:00" not in [slot["time"] for slot in smith_slots["slots"]]

    event = asyncio.run(mock_db.calendar_events.find_one({"customer.phone": "+8801711111111"}))
    assert event["provider_id"] == smith_id
    assert jane_id  # sanity: fixture created


def test_a_long_appointment_type_blocks_the_whole_duration(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-duration@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    _appointment_type(mock_db, owner_id, "Deep Cleaning", 90)
    service = AppointmentService(mock_db)

    booked = asyncio.run(service.book(owner_id, name="Nadia", phone="+8801722222222", email=None, day="2026-09-21", time="10:00", appointment_type_name="Deep Cleaning"))
    assert booked["outcome"] == "booked", booked
    event = asyncio.run(mock_db.calendar_events.find_one({"customer.phone": "+8801722222222"}))
    assert (event["ends_at"] - event["starts_at"]).total_seconds() == 90 * 60

    # 10:30 is inside that 90-minute block and must now be unavailable
    slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21"))
    assert "10:30" not in [slot["time"] for slot in slots["slots"]]


def test_an_unmatched_provider_name_falls_back_to_pooled_availability_instead_of_failing(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-unmatched@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    service = AppointmentService(mock_db)
    result = asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Someone Who Doesn't Exist"))
    assert result["provider"] is None
    assert result["slots"]  # still returns real slots rather than erroring out


def test_businesses_without_providers_are_unaffected(client, mock_db, monkeypatch):
    """No providers/appointment types configured at all: behaves exactly as the
    single-calendar pooled booking did before this feature existed."""
    owner_id = _setup(client, mock_db, "prov-none@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    service = AppointmentService(mock_db)
    booked = asyncio.run(service.book(owner_id, name="Rafi", phone="+8801733333333", email=None, day="2026-09-21", time="10:00"))
    assert booked["outcome"] == "booked"
    slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21"))
    assert "provider" not in slots and "appointment_type" not in slots
    assert "10:00" not in [slot["time"] for slot in slots["slots"]]


def test_rescheduling_keeps_the_same_provider_and_length(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-reschedule@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    smith_id = _provider(mock_db, owner_id, "Dr. Smith")
    _appointment_type(mock_db, owner_id, "Deep Cleaning", 90)
    service = AppointmentService(mock_db)
    booked = asyncio.run(
        service.book(owner_id, name="Karim", phone="+8801711111111", email=None, day="2026-09-21", time="10:00", provider_name="Dr. Smith", appointment_type_name="Deep Cleaning")
    )
    appointment_id = booked["appointment_id"]

    moved = asyncio.run(service.reschedule(owner_id, appointment_id=appointment_id, phone="+8801711111111", day="2026-09-22", time="11:00", caller_name="Karim"))
    assert moved["outcome"] == "rescheduled", moved
    event = asyncio.run(mock_db.calendar_events.find_one({"_id": __import__("bson").ObjectId(appointment_id)}))
    assert event["provider_id"] == smith_id
    assert (event["ends_at"] - event["starts_at"]).total_seconds() == 90 * 60  # still 90 minutes, not the default slot
