from __future__ import annotations

import asyncio

import pytest
from app.core.exceptions import AppException
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


def _provider(mock_db, owner_id, name, *, working_days=None, working_hours=None):
    doc = asyncio.run(
        mock_db.providers.insert_one(
            {
                "user_id": owner_id, "name": name, "role_title": None, "linked_user_id": None, "active": True,
                "working_days": working_days, "working_hours": working_hours,
            }
        )
    )
    return str(doc.inserted_id)


def _appointment_type(mock_db, owner_id, name, minutes, *, eligible_provider_ids=None):
    doc = asyncio.run(
        mock_db.appointment_types.insert_one(
            {
                "user_id": owner_id, "name": name, "duration_minutes": minutes, "active": True,
                "eligible_provider_ids": eligible_provider_ids,
            }
        )
    )
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


def test_a_provider_restricted_to_tue_thu_is_never_offered_on_a_monday(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-schedule-days@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))  # a Monday
    _provider(mock_db, owner_id, "Dr. Lee", working_days=[1, 3])  # Tuesday, Thursday only
    service = AppointmentService(mock_db)

    monday_slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Dr. Lee"))
    assert monday_slots["slots"] == []

    tuesday_slots = asyncio.run(service.available_slots(owner_id, day="2026-09-22", provider_name="Dr. Lee"))
    assert len(tuesday_slots["slots"]) > 0


def test_booking_a_restricted_provider_on_an_off_day_is_rejected_not_silently_allowed(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-schedule-reject@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))  # a Monday
    _provider(mock_db, owner_id, "Dr. Lee", working_days=[1, 3])
    service = AppointmentService(mock_db)

    result = asyncio.run(service.book(owner_id, name="Karim", phone="+8801711111111", email=None, day="2026-09-21", time="10:00", provider_name="Dr. Lee"))

    assert result["outcome"] == "unavailable"
    assert asyncio.run(mock_db.calendar_events.count_documents({})) == 0


def test_a_providers_own_narrower_hours_restrict_the_offered_window(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-schedule-hours@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    _provider(mock_db, owner_id, "Dr. Lee", working_hours={"start_hour": 13, "end_hour": 15})  # business is 9-17
    service = AppointmentService(mock_db)

    slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Dr. Lee"))
    times = [slot["time"] for slot in slots["slots"]]
    assert "09:00" not in times and "16:00" not in times
    assert "13:00" in times


def test_a_provider_with_no_working_days_set_still_follows_the_business_hours(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-schedule-default@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    _provider(mock_db, owner_id, "Dr. Lee")
    service = AppointmentService(mock_db)

    slots = asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Dr. Lee"))
    assert len(slots["slots"]) > 0


def test_an_appointment_type_restricted_to_specific_providers_rejects_an_ineligible_one(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-eligible-reject@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    dentist_id = _provider(mock_db, owner_id, "Dr. Smith")
    _provider(mock_db, owner_id, "Hygienist Jane")
    _appointment_type(mock_db, owner_id, "Root Canal", 60, eligible_provider_ids=[dentist_id])
    service = AppointmentService(mock_db)

    result = asyncio.run(
        service.book(owner_id, name="Nadia", phone="+8801733333333", email=None, day="2026-09-21", time="10:00", provider_name="Hygienist Jane", appointment_type_name="Root Canal")
    )

    assert result["outcome"] == "unavailable"
    assert asyncio.run(mock_db.calendar_events.count_documents({})) == 0


def test_an_appointment_type_restricted_to_specific_providers_allows_an_eligible_one(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-eligible-allow@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    dentist_id = _provider(mock_db, owner_id, "Dr. Smith")
    _appointment_type(mock_db, owner_id, "Root Canal", 60, eligible_provider_ids=[dentist_id])
    service = AppointmentService(mock_db)

    result = asyncio.run(
        service.book(owner_id, name="Nadia", phone="+8801733333333", email=None, day="2026-09-21", time="10:00", provider_name="Dr. Smith", appointment_type_name="Root Canal")
    )

    assert result["outcome"] == "booked"


def test_an_unmatched_provider_name_does_not_offer_another_providers_availability(client, mock_db, monkeypatch):
    owner_id = _setup(client, mock_db, "prov-unmatched@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, 0, tzinfo=tz)))
    service = AppointmentService(mock_db)
    with pytest.raises(AppException) as error:
        asyncio.run(service.available_slots(owner_id, day="2026-09-21", provider_name="Someone Who Doesn't Exist"))
    assert error.value.code == "PROVIDER_NOT_FOUND"


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
