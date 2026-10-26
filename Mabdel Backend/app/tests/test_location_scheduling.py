from __future__ import annotations

import asyncio
from datetime import datetime
from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.calendar_service import CalendarService
from app.services.smartflow.provider_service import ProviderService
from app.services.smartflow.call_meeting_request_service import CallMeetingRequestService
from app.tests.test_provider_aware_booking import _setup, _provider
from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_calendar_manual_provider_booking import _event


def _location(db, owner_id, name="Main", **extra):
    return asyncio.run(ProviderService(db).create_location(owner_id, {"name": name, "capacity": 1, **extra}))


def _clock(monkeypatch):
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 9, 21, 8, tzinfo=tz)))


def _book(service, owner, **extra):
    return asyncio.run(service.book(owner, name="Karim", phone="+8801711111111", email=None, day="2026-09-21", time="10:00", **extra))


def test_location_capacity_applies_across_different_providers(client, mock_db, monkeypatch):
    owner = _setup(client, mock_db, "location-capacity@example.com"); _clock(monkeypatch)
    location = _location(mock_db, owner)
    _provider(mock_db, owner, "Smith"); _provider(mock_db, owner, "Jane")
    service = AppointmentService(mock_db)
    assert _book(service, owner, provider_name="Smith", location_name="Main")["outcome"] == "booked"
    assert _book(service, owner, provider_name="Jane", location_name="Main")["outcome"] == "unavailable"
    event = asyncio.run(mock_db.calendar_events.find_one({"location_id": location["id"]}))
    assert event and event["location_name"] == "Main" and event["meeting_mode"] == "offline"


def test_distinct_locations_allow_parallel_bookings_and_capacity_two_allows_two(client, mock_db, monkeypatch):
    owner = _setup(client, mock_db, "location-parallel@example.com"); _clock(monkeypatch)
    _location(mock_db, owner, "Main", capacity=2); _location(mock_db, owner, "Branch")
    for name in ("Smith", "Jane", "Lee"):
        _provider(mock_db, owner, name)
    service = AppointmentService(mock_db)
    assert _book(service, owner, provider_name="Smith", location_name="Main")["outcome"] == "booked"
    assert _book(service, owner, provider_name="Jane", location_name="Main")["outcome"] == "booked"
    assert _book(service, owner, provider_name="Lee", location_name="Main")["outcome"] == "unavailable"
    assert _book(service, owner, provider_name="Lee", location_name="Branch")["outcome"] == "booked"


def test_location_hours_and_provider_location_eligibility(client, mock_db, monkeypatch):
    owner = _setup(client, mock_db, "location-hours@example.com"); _clock(monkeypatch)
    main = _location(mock_db, owner, "Main", working_hours={"start_hour": 13, "end_hour": 15})
    branch = _location(mock_db, owner, "Branch")
    provider = _provider(mock_db, owner, "Smith")
    asyncio.run(ProviderService(mock_db).update_provider(owner, provider, {"location_ids": [main["id"]]}))
    service = AppointmentService(mock_db)
    slots = asyncio.run(service.available_slots(owner, day="2026-09-21", provider_name="Smith", location_name="Main", count=10))["slots"]
    assert [slot["time"] for slot in slots] == ["13:00", "14:00"]
    assert _book(service, owner, provider_name="Smith", location_name="Branch")["outcome"] == "unavailable"
    assert _book(service, owner, provider_name="Smith", location_name="Main")["outcome"] == "unavailable"


def test_pending_location_hold_survives_approval_and_reschedule(client, mock_db, monkeypatch):
    owner = _setup(client, mock_db, "location-pending@example.com"); _clock(monkeypatch)
    location = _location(mock_db, owner)
    _provider(mock_db, owner, "Smith"); _provider(mock_db, owner, "Jane")
    requests = CallMeetingRequestService(mock_db)
    async def approval(*args): return "human_approval_required"
    monkeypatch.setattr(CallMeetingRequestService, "scheduling_capability", approval)
    service = AppointmentService(mock_db)
    assert _book(service, owner, provider_name="Smith")["outcome"] == "pending"
    assert _book(service, owner, provider_name="Jane")["outcome"] == "unavailable"
    pending = asyncio.run(mock_db.call_meeting_requests.find_one({"status": "pending"}))
    assert pending["location_id"] == location["id"]
    accepted = asyncio.run(requests.accept(owner, str(pending["_id"])))
    assert accepted["status"] == "confirmed"
    event = asyncio.run(mock_db.calendar_events.find_one({"location_id": location["id"]}))
    moved = asyncio.run(service.reschedule(owner, appointment_id=str(event["_id"]), phone="+8801711111111", caller_name="Karim", day="2026-09-21", time="11:00"))
    assert moved["outcome"] == "pending"
    pending_move = asyncio.run(mock_db.call_meeting_requests.find_one({"kind": "reschedule", "status": "pending"}))
    asyncio.run(requests.accept(owner, str(pending_move["_id"])))
    updated = asyncio.run(mock_db.calendar_events.find_one({"_id": event["_id"]}))
    assert updated["starts_at"].hour == 11 and updated["location_id"] == location["id"]


def test_unknown_spoken_resources_fail_closed(client, mock_db, monkeypatch):
    owner = _setup(client, mock_db, "location-unknown@example.com"); _clock(monkeypatch)
    service = AppointmentService(mock_db)
    for extra in ({"location_name": "Missing"}, {"provider_name": "Missing"}, {"appointment_type_name": "Missing"}):
        assert _book(service, owner, **extra)["outcome"] == "unavailable"
    assert asyncio.run(mock_db.calendar_events.count_documents({})) == 0


def test_location_and_eligibility_references_reject_foreign_resources(client, mock_db):
    headers, owner = _owner_with_org(client, mock_db, "location-owner@example.com")
    _, other = _owner_with_org(client, mock_db, "location-other@example.com")
    foreign = _location(mock_db, other)
    response = _event(client, headers, location_id=foreign["id"])
    assert response.status_code == 404
    response = client.post("/api/v1/smartflow/providers", headers=headers, json={"name": "Smith", "location_ids": [foreign["id"]]})
    assert response.status_code == 404
    response = client.post("/api/v1/smartflow/appointment-types", headers=headers, json={"name": "Cleaning", "duration_minutes": 30, "eligible_provider_ids": ["000000000000000000000000"]})
    assert response.status_code == 404


def test_location_crud_validates_hours_and_manual_capacity(client, mock_db):
    headers, owner = _owner_with_org(client, mock_db, "location-crud@example.com")
    bad = client.post("/api/v1/smartflow/locations", headers=headers, json={"name": "Bad", "working_hours": {"start_hour": 17, "end_hour": 9}})
    assert bad.status_code == 422
    response = client.post("/api/v1/smartflow/locations", headers=headers, json={"name": "Main", "capacity": 1})
    assert response.status_code == 201
    location_id = response.json()["data"]["id"]
    first = _event(client, headers, location_id=location_id)
    assert first.status_code == 201 and first.json()["data"]["location_name"] == "Main"
    assert _event(client, headers, location_id=location_id).status_code == 409
    assert client.patch(f"/api/v1/smartflow/locations/{location_id}", headers=headers, json={"capacity": 2}).status_code == 200
    assert _event(client, headers, location_id=location_id).status_code == 201
    assert client.delete(f"/api/v1/smartflow/locations/{location_id}", headers=headers).status_code == 200
    assert _event(client, headers, location_id=location_id).status_code == 409


def test_service_requires_an_eligible_location_and_multiple_locations_need_a_choice(client, mock_db, monkeypatch):
    owner = _setup(client, mock_db, "location-service@example.com"); _clock(monkeypatch)
    main = _location(mock_db, owner, "Main"); _location(mock_db, owner, "Branch")
    asyncio.run(ProviderService(mock_db).create_appointment_type(owner, {"name": "Cleaning", "duration_minutes": 30, "eligible_location_ids": [main["id"]]}))
    service = AppointmentService(mock_db)
    assert _book(service, owner)["outcome"] == "unavailable"
    assert _book(service, owner, appointment_type_name="Cleaning", location_name="Branch")["outcome"] == "unavailable"
    assert _book(service, owner, appointment_type_name="Cleaning", location_name="Main")["outcome"] == "booked"


def test_capacity_uses_peak_concurrency_instead_of_total_overlapping_events():
    from app.services.smartflow.scheduling_resources import SchedulingResources
    start, middle, end = datetime(2026, 9, 21, 10), datetime(2026, 9, 21, 11), datetime(2026, 9, 21, 12)
    # Two existing bookings touch at their boundaries; a third spanning both needs
    # capacity two, even though there are two records within its overall window.
    assert SchedulingResources.has_capacity([(start, middle), (middle, end)], start, end, 2)
    assert not SchedulingResources.has_capacity([(start, end), (middle, end)], start, end, 2)


def test_location_change_updates_address_and_clear_removes_reference(client, mock_db):
    headers, owner = _owner_with_org(client, mock_db, "location-change@example.com")
    main = _location(mock_db, owner, "Main", address="Main road")
    branch = _location(mock_db, owner, "Branch", address="Branch road")
    event = _event(client, headers, location_id=main["id"]).json()["data"]
    changed = client.patch(f"/api/v1/smartflow/calendar/events/{event['id']}", headers=headers, json={"location_id": branch["id"]})
    assert changed.status_code == 200
    assert changed.json()["data"]["location"] == "Branch road"
    assert changed.json()["data"]["location_name"] == "Branch"
    cleared = client.patch(f"/api/v1/smartflow/calendar/events/{event['id']}", headers=headers, json={"location_id": None})
    assert cleared.status_code == 200
    assert cleared.json()["data"]["location_id"] is None and cleared.json()["data"]["location_name"] is None
