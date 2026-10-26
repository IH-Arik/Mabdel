"""A required connected calendar must acknowledge a change before confirmation."""
from __future__ import annotations

import asyncio
from datetime import datetime

import pytest

from app.core.exceptions import AppException
from app.services.smartflow.appointment_notifications import AppointmentNotifier
from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.calendar_service import CalendarService
from app.services.smartflow.call_meeting_request_service import CallMeetingRequestService
from app.tests.test_realtime_receptionist import _business


@pytest.mark.parametrize("provider", ["google_business", "microsoft", "zoom", "caldav"])
@pytest.mark.parametrize("action", ["new", "reschedule", "cancel"])
def test_primary_calendar_failure_keeps_pending_without_false_confirmation_and_retry_is_once(client, mock_db, monkeypatch, provider, action):
    owner = _business(client, mock_db, monkeypatch, f"calendar-fail-{provider}-{action}@example.com")
    delivered_kinds = []
    async def notify(self, user_id, **kwargs):
        delivered_kinds.append(kwargs["kind"])
    monkeypatch.setattr(AppointmentNotifier, "notify", notify)
    async def provider_settings(self, user_id):
        return {"primary_calendar_provider": provider, "connected": {provider: True}}
    monkeypatch.setattr(CalendarService, "get_calendar_provider_settings", provider_settings)
    async def run():
        service = AppointmentService(mock_db)
        requests = CallMeetingRequestService(mock_db)
        recover = False
        remote_mutations = []
        async def mutation(*args, **kwargs):
            if not recover:
                raise AppException(status_code=502, code="PROVIDER_UNAVAILABLE", message="Calendar unavailable")
            remote_mutations.append(action)
            return "remote-event-1" if provider == "caldav" else {"id": "remote-event-1", "join_url": "https://provider.example/meeting"}
        for calendar in (service.calendar, service.requests.calendar_service, requests.calendar_service):
            adapter = {"google_business": calendar.google_calendar_service, "microsoft": calendar.microsoft_calendar_service, "zoom": calendar.zoom_calendar_service, "caldav": calendar.caldav_service}[provider]
            for name in (["push_event", "delete_event"] if provider == "caldav" else ["create_remote_event", "update_remote_event", "delete_remote_event"]):
                monkeypatch.setattr(adapter, name, mutation)
        event_id = None
        original_start = datetime(2026, 8, 17, 9, 0)
        if action != "new":
            field = {"google_business": "google_event_id", "microsoft": "microsoft_event_id", "zoom": "zoom_meeting_id", "caldav": "caldav_uid"}[provider]
            event_id = (await mock_db.calendar_events.insert_one({"user_id": owner, "title": "Appointment", "starts_at": original_start,
                "ends_at": datetime(2026, 8, 17, 10, 0), "meeting_mode": "offline", field: "existing-remote",
                "customer": {"name": "Jane Doe", "phone": "+15551230000"}})).inserted_id
        if action == "new":
            result = await service.book(owner, name="Jane Doe", phone="+15551230000", email=None, day="2026-08-17", time="10:00")
        elif action == "reschedule":
            result = await service.reschedule(owner, appointment_id=str(event_id), phone="+15551230000", caller_name="Jane Doe", day="2026-08-17", time="10:00")
        else:
            result = await service.cancel(owner, appointment_id=str(event_id), phone="+15551230000", caller_name="Jane Doe")
        assert result["outcome"] in {"pending", "pending_cancellation"}, result
        assert not set(delivered_kinds) & {"booked", "rescheduled", "cancelled"}
        assert not remote_mutations
        if action == "new":
            assert await mock_db.calendar_events.count_documents({}) == 0
        else:
            unchanged = await mock_db.calendar_events.find_one({"_id": event_id})
            assert unchanged["starts_at"] == original_start
        row = await mock_db.call_meeting_requests.find_one({"status": "pending"})
        assert row and not row.get("meeting_link")
        # Staff can retry the same pending request; failure never consumes approval.
        with pytest.raises(AppException) as error:
            await requests.accept(owner, str(row["_id"]))
        assert error.value.code == "CALENDAR_SYNC_REQUIRED"
        assert (await mock_db.call_meeting_requests.find_one({"_id": row["_id"]}))["status"] == "pending"
        recover = True
        approved = await requests.accept(owner, str(row["_id"]))
        assert approved["status"] == "confirmed"
        with pytest.raises(AppException) as already:
            await requests.accept(owner, str(row["_id"]))
        assert already.value.status_code == 409
        assert remote_mutations == [action]
        assert delivered_kinds.count({"new": "booked", "reschedule": "rescheduled", "cancel": "cancelled"}[action]) == 1
        assert await mock_db.calendar_events.count_documents({}) == (0 if action == "cancel" else 1)
    asyncio.run(run())


@pytest.mark.parametrize("failure", ["timeout", "empty"])
def test_required_calendar_missing_response_or_timeout_never_saves_fake_event(client, mock_db, monkeypatch, failure):
    owner = _business(client, mock_db, monkeypatch, f"calendar-no-response-{failure}@example.com")
    async def provider_settings(self, user_id):
        return {"primary_calendar_provider": "google_business", "connected": {"google_business": True}}
    monkeypatch.setattr(CalendarService, "get_calendar_provider_settings", provider_settings)
    async def run():
        service = AppointmentService(mock_db)
        async def fail(*args, **kwargs):
            if failure == "timeout":
                raise TimeoutError("Provider did not respond")
            return None
        monkeypatch.setattr(service.requests.calendar_service.google_calendar_service, "create_remote_event", fail)
        result = await service.book(owner, name="Jane Doe", phone="+15551230000", email=None, day="2026-08-17", time="10:00")
        assert result["outcome"] == "pending"
        assert await mock_db.calendar_events.count_documents({}) == 0
    asyncio.run(run())
