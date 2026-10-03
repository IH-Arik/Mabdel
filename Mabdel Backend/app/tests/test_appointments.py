from __future__ import annotations

import asyncio
from datetime import datetime

from bson import ObjectId

from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.calendar_service import CalendarService
from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_team_direct_messaging import _signup

CALLER = "+15551230000"
MONDAY = "2026-08-17"
TUESDAY = "2026-08-18"


def _setup(client, mock_db, monkeypatch, email, *, approval=False):
    headers, owner_id = _owner_with_org(client, mock_db, email)
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))

    async def _org():
        await mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "require_meeting_approval": approval,
                "telnyx_phone_number": "+15550009999",
                "business_hours": {"timezone": "America/Chicago", "days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
            }
        )

    asyncio.run(_org())
    return headers, owner_id, AppointmentService(mock_db)


def _texts(mock_db):
    return asyncio.run(mock_db.messages.find({"platform": "sms", "automated": True}).sort("timestamp", 1).to_list(None))


def test_open_times_on_a_named_day_and_part_of_day(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "appt-slots@example.com")

    afternoon = asyncio.run(service.available_slots(owner_id, day=TUESDAY, part_of_day="afternoon"))
    assert [slot["time"] for slot in afternoon["slots"]] == ["12:00", "13:00", "14:00"]
    assert afternoon["slots"][0]["spoken"] == "Tue Aug 18 at 12:00 PM"  # business-local, not UTC
    saturday = asyncio.run(service.available_slots(owner_id, day="2026-08-22"))
    assert saturday["slots"] == [] and "Monday" in saturday["business_hours"]


def test_book_links_the_customer_and_texts_from_the_business(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "appt-book@example.com")

    result = asyncio.run(service.book(owner_id, name="Nadia Rahman", phone=CALLER, email=None, day=TUESDAY, time="10:00", language="en"))

    assert result["outcome"] == "booked" and result["when"] == "Tue Aug 18 at 10:00 AM"
    event = asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(result["appointment_id"])}))
    assert event["customer"]["phone"] == CALLER and event["source"] == "ai_call" and event["contact_ids"]
    request = asyncio.run(mock_db.call_meeting_requests.find_one({"calendar_event_id": result["appointment_id"]}))
    assert request["status"] == "confirmed" and event["call_meeting_request_id"] == str(request["_id"])
    [text] = _texts(mock_db)
    assert text["content"] == "Bright Dental: your appointment is confirmed for Tue Aug 18 at 10:00 AM." + (
        f" {event['meeting_link']}" if event.get("meeting_link") else ""
    )

    taken = asyncio.run(service.book(owner_id, name="Someone", phone="+15557770000", email=None, day=TUESDAY, time="10:00"))
    assert taken["outcome"] == "unavailable"


def test_caller_finds_moves_and_cancels_only_their_own_appointment(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "appt-change@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))
    appointment_id = booked["appointment_id"]

    mine = asyncio.run(service.find_upcoming(owner_id, "+1 (555) 123-0000"))
    assert [item["appointment_id"] for item in mine["appointments"]] == [appointment_id]
    assert asyncio.run(service.find_upcoming(owner_id, "+15559990000"))["appointments"] == []

    stolen = asyncio.run(service.cancel(owner_id, appointment_id=appointment_id, phone="+15559990000"))
    assert stolen["outcome"] == "not_possible"

    wrong_name = asyncio.run(service.reschedule(owner_id, appointment_id=appointment_id, phone=CALLER, day=TUESDAY, time="15:00", caller_name="Someone Else"))
    assert wrong_name["outcome"] == "not_possible"  # phone matched, but the name didn't - not enough to change the booking

    moved = asyncio.run(service.reschedule(owner_id, appointment_id=appointment_id, phone=CALLER, day=TUESDAY, time="15:00", caller_name="Nadia"))
    assert moved == {"outcome": "rescheduled", "when": "Tue Aug 18 at 3:00 PM"}
    request = asyncio.run(mock_db.call_meeting_requests.find_one({"calendar_event_id": appointment_id}))
    assert request.get("rescheduled_at")

    cancelled = asyncio.run(service.cancel(owner_id, appointment_id=appointment_id, phone=CALLER, caller_name="Nadia"))
    assert cancelled["outcome"] == "cancelled"
    assert asyncio.run(mock_db.calendar_events.count_documents({"_id": ObjectId(appointment_id)})) == 0
    assert asyncio.run(mock_db.call_meeting_requests.find_one({"_id": request["_id"]}))["status"] == "cancelled"

    contents = [text["content"] for text in _texts(mock_db)]
    assert contents[1].startswith("Bright Dental: your appointment has been moved to Tue Aug 18 at 3:00 PM.")
    assert contents[2].startswith("Bright Dental: your appointment on Tue Aug 18 at 3:00 PM has been cancelled.")
    # All three texts share one SMS thread in Unified.
    assert len({text["conversation_id"] for text in _texts(mock_db)}) == 1


def test_with_approval_on_a_move_waits_for_the_team(client, mock_db, monkeypatch):
    headers, owner_id, service = _setup(client, mock_db, monkeypatch, "appt-approval@example.com")
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))
    asyncio.run(mock_db.organizations.update_one({"organization_id": owner_id}, {"$set": {"require_meeting_approval": True}}))

    moved = asyncio.run(service.reschedule(owner_id, appointment_id=booked["appointment_id"], phone=CALLER, day=TUESDAY, time="14:00", caller_name="Nadia"))
    assert moved["outcome"] == "pending"
    event = asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(booked["appointment_id"])}))
    assert event["starts_at"].hour == 15  # still 10:00 Chicago (15:00 UTC) until someone approves
    request = asyncio.run(mock_db.call_meeting_requests.find_one({"kind": "reschedule"}))

    accepted = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request['_id']}/accept", headers=headers)
    assert accepted.status_code == 200, accepted.text
    event = asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(booked["appointment_id"])}))
    assert event["starts_at"].hour == 19  # 14:00 Chicago
    assert "moved to Tue Aug 18 at 2:00 PM" in _texts(mock_db)[-1]["content"]


def test_a_teammate_moving_it_in_the_calendar_texts_the_customer(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "appt-staff@example.com")
    mate_headers, mate_id = _signup(client, mock_db, "appt-staff-mate@example.com", "Mate")
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(mate_id)}, {"$set": {"organization_id": owner_id}}))
    booked = asyncio.run(service.book(owner_id, name="Nadia", phone=CALLER, email=None, day=TUESDAY, time="10:00"))

    renamed = client.patch(f"/api/v1/smartflow/calendar/events/{booked['appointment_id']}", headers=mate_headers, json={"title": "Cleaning"})
    assert renamed.status_code == 200, renamed.text
    assert len(_texts(mock_db)) == 1  # a title change texts nobody

    moved = client.patch(
        f"/api/v1/smartflow/calendar/events/{booked['appointment_id']}",
        headers=mate_headers,
        json={"starts_at": "2026-08-18T21:00:00Z", "ends_at": "2026-08-18T22:00:00Z"},
    )
    assert moved.status_code == 200, moved.text
    assert "moved to Tue Aug 18 at 4:00 PM" in _texts(mock_db)[-1]["content"]

    deleted = client.delete(f"/api/v1/smartflow/calendar/events/{booked['appointment_id']}", headers=mate_headers)
    assert deleted.status_code in (200, 204), deleted.text
    assert "has been cancelled" in _texts(mock_db)[-1]["content"]


def test_receptionist_settings_round_trip(client, mock_db, monkeypatch):
    headers, owner_id, _ = _setup(client, mock_db, monkeypatch, "appt-settings@example.com")

    saved = client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"require_meeting_approval": True, "transfer_number": "+1 (555) 000-1111", "knowledge_base": "Cleaning costs $80.\nFree parking.", "voice_engine": "classic"},
    )
    assert saved.status_code == 200, saved.text
    data = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]
    assert data["require_meeting_approval"] is True and data["transfer_number"] == "+15550001111"
    assert data["knowledge_base"] == "Cleaning costs $80.\nFree parking." and data["voice_engine"] == "classic"
    org = asyncio.run(mock_db.organizations.find_one({"organization_id": owner_id}))
    assert org["require_meeting_approval"] is True and "require_meeting_approval" not in org["ai_call_settings"]
    assert client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"voice_engine": "robot"}).status_code == 422
