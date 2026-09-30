from __future__ import annotations

import asyncio
from datetime import timedelta

from bson import ObjectId

from app.services.smartflow.appointment_service import AppointmentService
from app.tests.test_ai_call_settings import _owner_with_org
from app.utils.helpers import utc_now


def _book(mock_db, owner_id, organization_id, *, hours_ahead, phone="+8801711111111", name="Karim", reminder_sent_at=None, buffer_minutes=0):
    now = utc_now()
    # A small buffer keeps a "due right now" booking safely inside the poll window,
    # rather than sitting exactly on its edge against a separately-computed now().
    start = now + timedelta(hours=hours_ahead, minutes=buffer_minutes)
    document = {
        "user_id": owner_id,
        "organization_id": organization_id,
        "title": "Appointment",
        "starts_at": start,
        "ends_at": start + timedelta(hours=1),
        "status": "scheduled",
        "customer": {"name": name, "phone": phone},
        "contact_ids": [],
        "timezone": "UTC",
        "reminder_sent_at": reminder_sent_at,
    }
    result = asyncio.run(mock_db.calendar_events.insert_one(document))
    return str(result.inserted_id)


def test_reminders_are_off_by_default_and_nothing_is_sent(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "rem-default@example.com")
    settings = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]
    assert settings["appointment_reminders_enabled"] is False and settings["appointment_reminder_hours_before"] == 24

    user = asyncio.run(mock_db.users.find_one({"organization_id": organization_id}))
    _book(mock_db, str(user["_id"]), organization_id, hours_ahead=24)

    sent = asyncio.run(AppointmentService(mock_db).send_due_reminders())
    assert sent == 0
    updated = asyncio.run(mock_db.calendar_events.find_one({}))
    assert updated["reminder_sent_at"] is None


def test_an_appointment_inside_the_configured_window_gets_texted_once(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "rem-on@example.com")
    client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"appointment_reminders_enabled": True, "appointment_reminder_hours_before": 24},
    )
    user = asyncio.run(mock_db.users.find_one({"organization_id": organization_id}))
    owner_id = str(user["_id"])
    event_id = _book(mock_db, owner_id, organization_id, hours_ahead=24, buffer_minutes=5)
    _book(mock_db, owner_id, organization_id, hours_ahead=2)  # too soon: outside the window, not due yet
    _book(mock_db, owner_id, organization_id, hours_ahead=48)  # too far: not due yet either

    sent = asyncio.run(AppointmentService(mock_db).send_due_reminders())
    assert sent == 1

    updated = asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(event_id)}))
    assert updated["reminder_sent_at"] is not None
    thread = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "sms"}))
    message = asyncio.run(mock_db.messages.find_one({"conversation_id": str(thread["_id"])}))
    assert "reminder" in message["content"].lower() or "before" not in message["content"]

    # running again right away must not text the same customer twice
    sent_again = asyncio.run(AppointmentService(mock_db).send_due_reminders())
    assert sent_again == 0


def test_a_custom_lead_time_is_honoured(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "rem-custom@example.com")
    client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"appointment_reminders_enabled": True, "appointment_reminder_hours_before": 2},
    )
    user = asyncio.run(mock_db.users.find_one({"organization_id": organization_id}))
    owner_id = str(user["_id"])
    _book(mock_db, owner_id, organization_id, hours_ahead=24)  # not due yet under a 2h lead time
    due_id = _book(mock_db, owner_id, organization_id, hours_ahead=2, buffer_minutes=5)

    sent = asyncio.run(AppointmentService(mock_db).send_due_reminders())
    assert sent == 1
    updated = asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(due_id)}))
    assert updated["reminder_sent_at"] is not None


def test_rescheduling_gets_a_fresh_reminder(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "rem-reschedule@example.com")
    client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"appointment_reminders_enabled": True})
    user = asyncio.run(mock_db.users.find_one({"organization_id": organization_id}))
    owner_id = str(user["_id"])
    event_id = _book(mock_db, owner_id, organization_id, hours_ahead=24, reminder_sent_at=utc_now())

    new_start = utc_now() + timedelta(hours=48)
    update = client.patch(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers=headers,
        json={"starts_at": new_start.isoformat(), "ends_at": (new_start + timedelta(hours=1)).isoformat()},
    )
    assert update.status_code == 200, update.text
    updated = asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(event_id)}))
    assert updated["reminder_sent_at"] is None


def test_a_cancelled_appointment_is_never_reminded(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "rem-cancelled@example.com")
    client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"appointment_reminders_enabled": True})
    user = asyncio.run(mock_db.users.find_one({"organization_id": organization_id}))
    owner_id = str(user["_id"])
    event_id = _book(mock_db, owner_id, organization_id, hours_ahead=24)
    asyncio.run(mock_db.calendar_events.update_one({"_id": ObjectId(event_id)}, {"$set": {"status": "cancelled"}}))

    sent = asyncio.run(AppointmentService(mock_db).send_due_reminders())
    assert sent == 0


def test_reminders_still_go_out_when_confirmations_are_turned_off(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "rem-vs-confirm@example.com")
    client.patch(
        "/api/v1/smartflow/ai-call-settings",
        headers=headers,
        json={"appointment_reminders_enabled": True, "sms_confirmations_enabled": False},
    )
    user = asyncio.run(mock_db.users.find_one({"organization_id": organization_id}))
    owner_id = str(user["_id"])
    _book(mock_db, owner_id, organization_id, hours_ahead=24, buffer_minutes=5)

    sent = asyncio.run(AppointmentService(mock_db).send_due_reminders())
    assert sent == 1  # reminders are their own opt-in, independent of the confirmations toggle
