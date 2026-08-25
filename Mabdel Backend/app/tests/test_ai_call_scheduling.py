from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

from app.core.config import settings
from app.services.ai_phone_agent import AIPhoneAgent, _clean_spoken_email, _looks_affirmative, _looks_like_scheduling_request
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow.calendar_service import CalendarService
from app.services.smartflow.call_meeting_request_service import CallMeetingRequestService
from app.services.smartflow_service import SmartFlowService
from app.tests.conftest import grant_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _owner_with_org(client, mock_db, email: str) -> tuple[dict[str, str], str]:
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify.status_code == 200
    grant_role(mock_db, email, "owner")

    async def _self_reference_org():
        user = await mock_db.users.find_one({"email": email})
        await mock_db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"organization_id": str(user["_id"]), "role": "owner", "primary_role": "owner"}},
        )
        return str(user["_id"])

    user_id = asyncio.run(_self_reference_org())
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, user_id


# ── business hours ───────────────────────────────────────────────────────


def test_business_hours_default_when_unset(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "bh-default@example.com")
    response = client.get("/api/v1/smartflow/calendar/business-hours", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["start_hour"] == 9
    assert data["end_hour"] == 17
    assert data["days"] == [0, 1, 2, 3, 4]


def test_business_hours_update_and_persist(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "bh-update@example.com")
    response = client.put(
        "/api/v1/smartflow/calendar/business-hours",
        headers=headers,
        json={"start_hour": 8, "end_hour": 12, "days": [0, 1, 2]},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["start_hour"] == 8
    assert data["end_hour"] == 12
    assert data["days"] == [0, 1, 2]

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": owner_id}))
    assert org["business_hours"]["start_hour"] == 8


def test_business_hours_rejects_invalid_day(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "bh-invalid@example.com")
    response = client.put("/api/v1/smartflow/calendar/business-hours", headers=headers, json={"days": [7]})
    assert response.status_code == 422


# ── real free-slot finder ────────────────────────────────────────────────


def test_find_free_slots_uses_business_hours_not_hardcoded_list(mock_db):
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-slots-1",
                "business_hours": {"timezone": "UTC", "days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 8, "end_hour": 11, "slot_minutes": 60},
            }
        )
        await mock_db.users.insert_one(
            {"_id": __import__("bson").ObjectId(), "organization_id": "org-slots-1"}
        )
        user = await mock_db.users.find_one({"organization_id": "org-slots-1"})
        return await service.find_free_slots(str(user["_id"]), date(2026, 8, 17))  # a Monday

    slots = asyncio.run(_run())
    assert slots == ["08:00", "09:00", "10:00"]


def test_find_free_slots_excludes_busy_calendar_time_across_team(mock_db):
    service = CalendarService(mock_db)

    async def _run():
        owner_id = __import__("bson").ObjectId()
        staff_id = __import__("bson").ObjectId()
        await mock_db.users.insert_many(
            [
                {"_id": owner_id, "email": "owner-slots-2@example.com", "organization_id": "org-slots-2"},
                {"_id": staff_id, "email": "staff-slots-2@example.com", "organization_id": "org-slots-2"},
            ]
        )
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-slots-2",
                "business_hours": {"timezone": "UTC", "days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 12, "slot_minutes": 60},
            }
        )
        # Staff (not the owner) has something booked — should still block the slot,
        # since the caller is booking with "the business", not one specific person.
        await mock_db.calendar_events.insert_one(
            {
                "user_id": str(staff_id),
                "status": "scheduled",
                "starts_at": datetime(2026, 8, 17, 10, 0, tzinfo=timezone.utc),
                "ends_at": datetime(2026, 8, 17, 11, 0, tzinfo=timezone.utc),
            }
        )
        return await service.find_free_slots(str(owner_id), date(2026, 8, 17))

    slots = asyncio.run(_run())
    assert slots == ["09:00", "11:00"]


def test_find_free_slots_returns_empty_outside_business_days(mock_db):
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-slots-3", "business_hours": {"days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-slots-3"})
        return await service.find_free_slots(str(user.inserted_id), date(2026, 8, 22))  # a Saturday

    assert asyncio.run(_run()) == []


def test_find_next_available_slot_scans_forward(mock_db, monkeypatch):
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-slots-4", "business_hours": {"days": [1], "start_hour": 9, "end_hour": 10, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-slots-4"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())

    # a Monday morning, well before the 9am open on the next Tuesday (weekday 1)
    monkeypatch.setattr(
        CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz))
    )
    slot = asyncio.run(service.find_next_available_slot(user_id, days_ahead=7))

    assert slot is not None
    assert slot["date"] == "2026-08-18"  # the next Tuesday
    assert slot["time"] == "09:00"


def test_find_free_slots_respects_non_utc_timezone(mock_db):
    """A business in America/New_York (UTC-4 in August, EDT) with hours 9-11 local
    must offer 13:00/14:00 UTC-equivalent-labelled-as-local slots — i.e. the returned
    strings stay in local wall-clock time (09:00, 10:00), not shifted to UTC."""
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-tz-1",
                "business_hours": {"timezone": "America/New_York", "days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 11, "slot_minutes": 60},
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-tz-1"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())
    slots = asyncio.run(service.find_free_slots(user_id, date(2026, 8, 17)))
    # Local labels stay 09:00/10:00 regardless of timezone — that's what should be
    # spoken to the caller and shown in the business-hours UI.
    assert slots == ["09:00", "10:00"]


def test_find_free_slots_non_utc_timezone_correctly_excludes_utc_stored_busy_event(mock_db):
    """The actual conflict check must happen in UTC. 9am New York (EDT, UTC-4) in
    August is 13:00 UTC — an event stored at 13:00-14:00 UTC must block the 09:00
    local slot, proving the timezone conversion is real and not a no-op."""
    service = CalendarService(mock_db)

    async def _run():
        owner_id = __import__("bson").ObjectId()
        await mock_db.users.insert_one({"_id": owner_id, "organization_id": "org-tz-2"})
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-tz-2",
                "business_hours": {"timezone": "America/New_York", "days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 11, "slot_minutes": 60},
            }
        )
        await mock_db.calendar_events.insert_one(
            {
                "user_id": str(owner_id),
                "status": "scheduled",
                "starts_at": datetime(2026, 8, 17, 13, 0),  # 09:00 EDT
                "ends_at": datetime(2026, 8, 17, 14, 0),
            }
        )
        return await service.find_free_slots(str(owner_id), date(2026, 8, 17))

    assert asyncio.run(_run()) == ["10:00"]


def test_find_free_slots_respects_slot_minutes_granularity(mock_db):
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-gran-1", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 10, "slot_minutes": 30}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-gran-1"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())
    slots = asyncio.run(service.find_free_slots(user_id, date(2026, 8, 17)))
    assert slots == ["09:00", "09:30"]


def test_find_free_slots_excludes_already_passed_times_today(mock_db, monkeypatch):
    """A caller ringing at 2:30pm business-local must not be offered 9am/10am/11am/
    noon/1pm today — those times have already passed. The 3pm slot, still ahead of
    "now", must remain offered."""
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-past-1",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-past-1"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())
    monkeypatch.setattr(
        CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 14, 30, tzinfo=tz))
    )
    slots = asyncio.run(service.find_free_slots(user_id, date(2026, 8, 17)))
    assert slots == ["15:00", "16:00"]


def test_find_free_slots_does_not_filter_by_time_of_day_for_a_future_date(mock_db, monkeypatch):
    """The past-time guard must only apply to *today* — querying a future date must
    still return the full business-hours slot list even though "now" is later in
    the day than some of those slots."""
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-past-2",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 11, "slot_minutes": 60},
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-past-2"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())
    monkeypatch.setattr(
        CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 16, 0, tzinfo=tz))
    )
    slots = asyncio.run(service.find_free_slots(user_id, date(2026, 8, 18)))
    assert slots == ["09:00", "10:00"]


def test_find_next_available_slot_skips_todays_passed_hours(mock_db, monkeypatch):
    """End-to-end through find_next_available_slot: calling mid-afternoon must roll
    past today's already-passed morning slots and land on the next open time, not
    hand back a time that's already gone by."""
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-past-3",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 12, "slot_minutes": 60},
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-past-3"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())
    # A Monday at 2pm business-local, business hours end at noon -- today is fully
    # exhausted, so the next slot must be tomorrow morning, not today at all.
    monkeypatch.setattr(
        CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 14, 0, tzinfo=tz))
    )
    slot = asyncio.run(service.find_next_available_slot(user_id, days_ahead=7))

    assert slot is not None
    assert slot["date"] == "2026-08-18"
    assert slot["time"] == "09:00"


def test_find_next_available_slot_uses_business_timezone_not_server_clock(mock_db, monkeypatch):
    """The "today" boundary has to be computed in the business's own timezone, not
    the server's. The UTC/server clock reads Tuesday 01:00 — already the next
    calendar day by UTC — while it's still 18:00 Monday evening in
    America/Los_Angeles, and still within that business's (evening-inclusive)
    hours. Using the server's date would skip straight to Tuesday and either miss
    today's still-open slot entirely or misreport its date."""
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-tz-today-1",
                "business_hours": {
                    "timezone": "America/Los_Angeles",
                    "days": [0],  # Monday only
                    "start_hour": 9,
                    "end_hour": 20,
                    "slot_minutes": 60,
                },
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-tz-today-1"})
        return str(user.inserted_id)

    user_id = asyncio.run(_run())
    from zoneinfo import ZoneInfo

    def fake_now(tz):
        # 2026-08-18 01:00 UTC == 2026-08-17 18:00 America/Los_Angeles (still Monday,
        # still open — hours run until 20:00 local).
        utc_instant = datetime(2026, 8, 18, 1, 0, tzinfo=ZoneInfo("UTC"))
        return utc_instant.astimezone(tz)

    monkeypatch.setattr(CalendarService, "_now", staticmethod(fake_now))
    slot = asyncio.run(service.find_next_available_slot(user_id, days_ahead=7))

    assert slot is not None
    assert slot["date"] == "2026-08-17"  # still "today" in the business's own timezone
    assert slot["time"] == "19:00"  # the only slot left after 18:00 local


def test_pending_request_soft_holds_the_slot_from_other_callers(mock_db):
    """Two simultaneous calls must not both be offered — and both book — the exact
    same time. A pending (not yet approved) request already blocks it."""
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-hold-1", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 11, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-hold-1"})
        user_id = str(user.inserted_id)

        before = await service.find_free_slots(user_id, date(2026, 8, 17))
        assert before == ["09:00", "10:00"]

        await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": "org-hold-1",
                "caller_name": "First Caller",
                "status": "pending",
                "requested_start": datetime(2026, 8, 17, 9, 0, tzinfo=timezone.utc),
                "requested_end": datetime(2026, 8, 17, 10, 0, tzinfo=timezone.utc),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        after = await service.find_free_slots(user_id, date(2026, 8, 17))
        return after

    assert asyncio.run(_run()) == ["10:00"]


def test_declined_pending_request_frees_the_slot_again(mock_db):
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-hold-2", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 10, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-hold-2"})
        user_id = str(user.inserted_id)

        await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": "org-hold-2",
                "caller_name": "Declined Caller",
                "status": "declined",  # already handled — must not still hold the slot
                "requested_start": datetime(2026, 8, 17, 9, 0, tzinfo=timezone.utc),
                "requested_end": datetime(2026, 8, 17, 10, 0, tzinfo=timezone.utc),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return await service.find_free_slots(user_id, date(2026, 8, 17))

    assert asyncio.run(_run()) == ["09:00"]


def test_accept_gives_clear_error_when_slot_taken_in_the_meantime(client, mock_db):
    """The rare leftover race: something else claimed the calendar slot between the
    request being created and the admin clicking accept. Must fail loud and clear,
    not with a generic 500 or a silent double-booking."""
    headers, owner_id = _owner_with_org(client, mock_db, "conflict-test@example.com")

    async def _seed():
        starts = datetime.now(timezone.utc) + timedelta(days=1)
        ends = starts + timedelta(hours=1)
        # Something else already occupies this exact slot.
        await mock_db.calendar_events.insert_one(
            {
                "user_id": owner_id,
                "title": "Unrelated meeting",
                "starts_at": starts,
                "ends_at": ends,
                "status": "scheduled",
            }
        )
        result = await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": owner_id,
                "caller_name": "Caller",
                "requested_start": starts,
                "requested_end": ends,
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    request_id = asyncio.run(_seed())
    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request_id}/accept", headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CALL_MEETING_REQUEST_SLOT_TAKEN"

    # Still pending — the admin can decline it and follow up manually.
    doc = asyncio.run(mock_db.call_meeting_requests.find_one({"_id": __import__("bson").ObjectId(request_id)}))
    assert doc["status"] == "pending"


def test_email_retry_asks_to_spell_out_invalid_input(mock_db):
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-email-retry"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        agent.phase = "collecting_email"
        agent.proposed_slot = {"date": "2026-08-17", "time": "09:00"}
        agent.caller_name = "Test Caller"

        first_reply = await agent._advance_conversation("mumble mumble not an email")
        phase_after_bad = agent.phase
        second_reply = await agent._advance_conversation("j o h n at example dot com")
        return first_reply, phase_after_bad, second_reply, agent.caller_email, agent.phase

    first_reply, phase_after_bad, second_reply, email, final_phase = asyncio.run(_run())
    assert "spell" in first_reply.lower()
    assert phase_after_bad == "collecting_email"  # stayed, didn't silently move on
    assert email == "john@example.com"
    # A validly-formatted email moves to the read-back confirmation, not straight
    # to the final send confirmation — the caller still has to confirm it's correct.
    assert final_phase == "confirming_email"
    assert email in second_reply


def test_looks_like_valid_email():
    from app.services.ai_phone_agent import _looks_like_valid_email

    assert _looks_like_valid_email("john@example.com")
    assert not _looks_like_valid_email("not an email")
    assert not _looks_like_valid_email("john@example")


def test_localize_business_slot_converts_local_to_utc(mock_db):
    service = CalendarService(mock_db)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-localize-1", "business_hours": {"timezone": "America/New_York"}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-localize-1"})
        return await service.localize_business_slot(str(user.inserted_id), "2026-08-17", "09:00")

    result = asyncio.run(_run())
    assert result.tzinfo is not None
    assert result.astimezone(timezone.utc).hour == 13  # 09:00 EDT == 13:00 UTC


# ── pure helper functions ────────────────────────────────────────────────


def test_looks_like_scheduling_request():
    assert _looks_like_scheduling_request("Can I schedule a meeting?")
    assert _looks_like_scheduling_request("I'd like to book an appointment")
    assert not _looks_like_scheduling_request("What's your refund policy?")


def test_looks_affirmative():
    assert _looks_affirmative("Yes that works")
    assert _looks_affirmative("Sure, sounds good")
    assert not _looks_affirmative("No thanks")


def test_clean_spoken_email():
    assert _clean_spoken_email("john at example dot com") == "john@example.com"
    assert _clean_spoken_email("Jane.Doe@Example.com") == "jane.doe@example.com"


# ── AI phone agent scheduling state machine ──────────────────────────────


def _make_agent(user_id: str, flow_service: SmartFlowService) -> AIPhoneAgent:
    agent = AIPhoneAgent("call_test_1", GoCustifyAIService(), flow_service)
    agent.user_id = user_id
    agent.caller_phone = "+15551234567"
    return agent


def test_scheduling_flow_end_to_end_creates_pending_request(mock_db, monkeypatch):
    async def _run():
        # require_meeting_approval=True opts into the pending-request path this test
        # is named for — by default, book_or_request_meeting_for_user now books the
        # meeting directly when it has the caller's contact info (see
        # test_scheduling_flow_end_to_end_books_directly_by_default for that path).
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-agent-1",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                "require_meeting_approval": True,
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-1"})
        user_id = str(user.inserted_id)

        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(user_id, flow_service)

        reply1 = await agent._advance_conversation("I'd like to schedule a meeting")
        assert "free" in reply1.lower() or agent.phase == "offering_slot"
        assert agent.phase == "offering_slot"

        reply2 = await agent._advance_conversation("Yes that works")
        assert agent.phase == "collecting_first_name"

        reply3 = await agent._advance_conversation("John")
        assert agent.phase == "collecting_last_name"

        reply4 = await agent._advance_conversation("Smith")
        assert agent.caller_name == "John Smith"
        # _make_agent presets caller_phone (simulating known caller ID), so this
        # goes straight to the read-back rather than asking for it from scratch.
        assert agent.phase == "confirming_phone"
        assert agent.caller_phone in reply4

        reply5 = await agent._advance_conversation("Yes, that's right")
        assert agent.phase == "collecting_email"

        reply6 = await agent._advance_conversation("john at example dot com")
        assert agent.phase == "confirming_email"
        assert agent.caller_email == "john@example.com"

        reply7 = await agent._advance_conversation("Yes, that's correct")
        assert agent.phase == "confirming"

        reply8 = await agent._advance_conversation("Yes, send it")
        assert agent.phase == "idle"

        return reply8

    final_reply = asyncio.run(_run())
    assert "team" in final_reply.lower()

    request = asyncio.run(mock_db.call_meeting_requests.find_one({"organization_id": "org-agent-1"}))
    assert request is not None
    assert request["caller_name"] == "John Smith"
    assert request["caller_email"] == "john@example.com"
    assert request["caller_phone"] == "+15551234567"
    assert request["status"] == "pending"
    assert request["call_sid"] == "call_test_1"


def test_declining_a_slot_offers_the_next_one_instead_of_giving_up(mock_db):
    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-agent-2", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-2"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)

        await agent._advance_conversation("Can we book a meeting?")
        first_slot = dict(agent.proposed_slot)
        reply = await agent._advance_conversation("No, that doesn't work")

        return agent.phase, first_slot, agent.proposed_slot, agent.declined_slots, reply

    phase, first_slot, second_slot, declined, reply = asyncio.run(_run())
    assert phase == "offering_slot"  # still trying, not given up
    assert second_slot != first_slot  # a genuinely different slot was offered
    assert f"{first_slot['date']} {first_slot['time']}" in declined
    assert "instead" in reply.lower()


def test_declining_repeatedly_eventually_gives_up_gracefully(mock_db):
    """Business hours wide open (plenty of supply) so MAX_SLOT_OFFERS, not slot
    scarcity, is what stops the retries — decline 5 times in a row and the agent
    must give up rather than loop or crash."""
    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-agent-cap", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-cap"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)

        replies = [await agent._advance_conversation("I'd like to book a meeting")]
        for _ in range(6):
            replies.append(await agent._advance_conversation("No"))
        # replies[5] is the reply to the 5th decline, where MAX_SLOT_OFFERS (5) is hit
        # and the agent gives up. The 6th "No" (replies[6]) lands after phase has
        # already reset to "idle", so it falls through to the plain-chat LLM reply
        # instead — not deterministic content, so it's excluded from the assertion below.
        return agent.phase, replies[5]

    phase, gave_up_reply = asyncio.run(_run())
    assert phase == "idle"
    assert "call you back" in gave_up_reply.lower() or "follow up" in gave_up_reply.lower()


def test_scheduling_flow_no_slots_available_gives_fallback_message(mock_db):
    async def _run():
        # Business hours window with no open days at all.
        await mock_db.organizations.insert_one(
            {"organization_id": "org-agent-3", "business_hours": {"days": [], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-3"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        return await agent._advance_conversation("I want to schedule a meeting")

    reply = asyncio.run(_run())
    assert "follow up" in reply.lower() or "sorry" in reply.lower()


def test_plain_chat_never_touches_stub_workflow_intents(mock_db, monkeypatch):
    """A caller asking for an invoice on a call must not trigger the (non-functional)
    LangGraph action stubs — only plain conversational replies are allowed outside
    the scheduling flow."""
    workflow_called = False

    async def fake_run_assistant_workflow(*args, **kwargs):
        nonlocal workflow_called
        workflow_called = True
        raise AssertionError("The AI phone agent must never invoke the command workflow")

    monkeypatch.setattr("app.services.gocustify_ai_service.run_assistant_workflow", fake_run_assistant_workflow)

    async def fake_generate_with_openai(self, user_text, history):
        return "A team member will follow up with you about that.", 10

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate_with_openai)

    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-agent-4"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        return await agent._advance_conversation("Can you create an invoice for me?")

    reply = asyncio.run(_run())
    assert not workflow_called
    assert "team member" in reply.lower()


# ── Business name in greeting/prompt ─────────────────────────────────────


def test_greeting_uses_the_actual_business_name(mock_db):
    """A caller must hear the business they called, not our own product name."""
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-greet-1"})
        user_id = str(user.inserted_id)
        await mock_db.business_profiles.insert_one({"user_id": user_id, "business_name": "Dentist Care"})

        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(user_id, flow_service)
        agent.stream_sid = "MZ_test"
        synthesized = {}

        async def fake_synthesize_stream(text, voice_id=None):
            synthesized["text"] = text
            yield b"\x00\x00" * 100

        agent.ai_service.synthesize_speech_stream = fake_synthesize_stream
        await agent.greet(lambda msg: asyncio.sleep(0))
        return synthesized.get("text", ""), agent.business_name

    greeting, business_name = asyncio.run(_run())
    assert "Dentist Care" in greeting
    assert "GoCustify" not in greeting
    assert business_name == "Dentist Care"


def test_greeting_falls_back_gracefully_when_no_business_name_set(mock_db):
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-greet-2"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        agent.stream_sid = "MZ_test"
        synthesized = {}

        async def fake_synthesize_stream(text, voice_id=None):
            synthesized["text"] = text
            yield b"\x00\x00" * 100

        agent.ai_service.synthesize_speech_stream = fake_synthesize_stream
        await agent.greet(lambda msg: asyncio.sleep(0))
        return synthesized.get("text", "")

    greeting = asyncio.run(_run())
    assert "GoCustify" not in greeting
    assert "Thanks for calling" in greeting


def test_plain_chat_prompt_includes_business_name(mock_db, monkeypatch):
    captured_prompt = {}

    async def fake_generate(self, prompt, history):
        captured_prompt["text"] = prompt
        return "A team member will follow up.", 5

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-greet-3"})
        user_id = str(user.inserted_id)
        await mock_db.business_profiles.insert_one({"user_id": user_id, "business_name": "Acme Plumbing"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(user_id, flow_service)
        return await agent._advance_conversation("What are your hours?")

    asyncio.run(_run())
    assert "Acme Plumbing" in captured_prompt["text"]


def test_plain_chat_prompt_includes_business_type(mock_db, monkeypatch):
    """The AI should know what kind of business it's answering for (e.g. "we're a
    dental clinic") so it can tailor tone even without the owner spelling it out in
    custom_instructions."""
    captured_prompt = {}

    async def fake_generate(self, prompt, history):
        captured_prompt["text"] = prompt
        return "A team member will follow up.", 5

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-btype-1", "ai_call_settings": {"business_type": "Dental Clinic"}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-btype-1"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        return await agent._advance_conversation("What are your hours?")

    asyncio.run(_run())
    assert "Business Type: Dental Clinic" in captured_prompt["text"]


def test_plain_chat_prompt_omits_business_type_when_unset(mock_db, monkeypatch):
    captured_prompt = {}

    async def fake_generate(self, prompt, history):
        captured_prompt["text"] = prompt
        return "A team member will follow up.", 5

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-btype-2"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        return await agent._advance_conversation("What are your hours?")

    asyncio.run(_run())
    assert "Business Type" not in captured_prompt["text"]


def test_plain_chat_prompt_includes_real_hours_and_address(mock_db, monkeypatch):
    captured_prompt = {}

    async def fake_generate(self, prompt, history):
        captured_prompt["text"] = prompt
        return "We're open Monday to Friday, 9 to 5.", 5

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-hours-1", "business_hours": {"days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-hours-1"})
        user_id = str(user.inserted_id)
        await mock_db.business_profiles.insert_one(
            {
                "user_id": user_id,
                "business_name": "Acme Plumbing",
                "phone_number": "+15551234567",
                "website": "https://acme-plumbing.example.com",
                "office_address": {
                    "street_address": "123 Main St",
                    "city": "Springfield",
                    "state": "IL",
                    "postal_code": "62704",
                    "country": "USA",
                },
            }
        )
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(user_id, flow_service)
        return await agent._advance_conversation("What are your hours and where are you located?")

    asyncio.run(_run())
    prompt = captured_prompt["text"]
    # Real data made it into the prompt as ground truth...
    assert "9:00 AM - 5:00 PM" in prompt
    assert "123 Main St" in prompt
    assert "Springfield" in prompt
    assert "+15551234567" in prompt
    # ...and the AI is told to use only these facts, not invent anything.
    assert "VERIFIED BUSINESS FACTS" in prompt
    assert "DO NOT invent" in prompt


def test_plain_chat_prompt_omits_unset_address_rather_than_guessing(mock_db, monkeypatch):
    """No business_profiles doc exists — address/phone/website must not be fabricated.
    (Business hours still appear because organizations always resolve to at least the
    platform default hours — Mon-Fri 9-5 — never a per-call guess.)"""
    captured_prompt = {}

    async def fake_generate(self, prompt, history):
        captured_prompt["text"] = prompt
        return "Let me have someone follow up with that.", 5

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-no-profile-1"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        return await agent._advance_conversation("Where are you located?")

    asyncio.run(_run())
    prompt = captured_prompt["text"]
    assert "- Office Address / Location:" not in prompt
    assert "- Contact Phone:" not in prompt
    assert "- Official Website:" not in prompt
    assert "DO NOT invent" in prompt


def test_plain_chat_prompt_admits_unknown_when_hours_unconfigured(mock_db, monkeypatch):
    """A business with hours explicitly set to no days at all — the rare case where
    even the default schedule doesn't apply — must not have any facts fabricated."""
    captured_prompt = {}

    async def fake_generate(self, prompt, history):
        captured_prompt["text"] = prompt
        return "Let me have someone follow up with our hours.", 5

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-no-hours-1", "business_hours": {"days": []}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-no-hours-1"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        return await agent._advance_conversation("What are your hours?")

    asyncio.run(_run())
    prompt = captured_prompt["text"]
    assert "DO NOT invent" in prompt


def test_business_info_is_fetched_once_and_cached(mock_db, monkeypatch):
    async def fake_generate(self, prompt, history):
        return "ok", 1

    monkeypatch.setattr(GoCustifyAIService, "_generate_with_openai", fake_generate)

    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-cache-1", "business_hours": {"days": [0, 1], "start_hour": 9, "end_hour": 17}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-cache-1"})
        user_id = str(user.inserted_id)
        await mock_db.business_profiles.insert_one({"user_id": user_id, "business_name": "Acme"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(user_id, flow_service)

        real_collection = mock_db.business_profiles
        call_count = {"n": 0}

        class _CountingCollection:
            def __getattr__(self, item):
                return getattr(real_collection, item)

            async def find_one(self, *args, **kwargs):
                call_count["n"] += 1
                return await real_collection.find_one(*args, **kwargs)

        # AsyncIOMotorDatabase resolves `.business_profiles` via __getattr__ each
        # access — setting it directly on the instance shadows that, since normal
        # attribute lookup checks the instance __dict__ before falling back.
        mock_db.business_profiles = _CountingCollection()

        await agent._advance_conversation("What are your hours?")
        lookups_after_first_turn = call_count["n"]
        await agent._advance_conversation("Where are you located?")
        return lookups_after_first_turn, call_count["n"]

    lookups_after_first_turn, lookups_after_second_turn = asyncio.run(_run())
    # First turn fetches the business_profiles doc (once for the name, once for
    # address/phone/website — separate cached fields). The second turn must not
    # trigger any further lookups since both are already cached on the agent.
    assert lookups_after_first_turn > 0
    assert lookups_after_second_turn == lookups_after_first_turn


# ── CallMeetingRequestService + endpoints ────────────────────────────────


def test_meeting_request_notifies_every_org_member(mock_db):
    async def _run():
        owner_id = __import__("bson").ObjectId()
        manager_id = __import__("bson").ObjectId()
        await mock_db.users.insert_many(
            [
                {"_id": owner_id, "email": "owner-notify-1@example.com", "organization_id": "org-notify-1"},
                {"_id": manager_id, "email": "manager-notify-1@example.com", "organization_id": "org-notify-1"},
            ]
        )
        service = CallMeetingRequestService(mock_db)
        await service.create_pending_request(
            organization_id="org-notify-1",
            call_sid="call_x",
            caller_name="Jane Caller",
            caller_email="jane@example.com",
            caller_phone="+1555",
            requested_start=datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc),
            requested_end=datetime(2026, 8, 20, 15, 0, tzinfo=timezone.utc),
        )
        notifications = await mock_db.notifications.find({}).to_list(length=10)
        return notifications

    notifications = asyncio.run(_run())
    assert len(notifications) == 2
    assert all(n["type"] == "calendar" for n in notifications)


def test_accept_meeting_request_requires_calls_manage(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "accept-perm@example.com")

    async def _seed():
        result = await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": owner_id,
                "call_sid": "call_y",
                "caller_name": "Caller",
                "caller_email": None,
                "caller_phone": "+1555",
                "requested_start": datetime.now(timezone.utc) + timedelta(days=1),
                "requested_end": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    request_id = asyncio.run(_seed())

    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request_id}/accept", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["status"] == "confirmed"

    updated = asyncio.run(mock_db.call_meeting_requests.find_one({"_id": __import__("bson").ObjectId(request_id)}))
    assert updated["confirmed_by_user_id"] == owner_id


def test_decline_meeting_request(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "decline-test@example.com")

    async def _seed():
        result = await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": owner_id,
                "caller_name": "Caller",
                "requested_start": datetime.now(timezone.utc) + timedelta(days=1),
                "requested_end": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    request_id = asyncio.run(_seed())
    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request_id}/decline", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "declined"


def test_decline_notifies_caller_by_email(client, mock_db, monkeypatch):
    """A caller left with a silently-declined request has no way to know — this
    sends a courtesy email when we have one on file."""
    headers, owner_id = _owner_with_org(client, mock_db, "decline-email@example.com")

    sent_emails = []

    async def fake_send(self, *, email, subject, text, html):
        sent_emails.append({"email": email, "subject": subject})

    monkeypatch.setattr("app.services.email_service.EmailService.send_invoice_email", fake_send)

    async def _seed():
        result = await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": owner_id,
                "caller_name": "Caller",
                "caller_email": "caller@example.com",
                "requested_start": datetime.now(timezone.utc) + timedelta(days=1),
                "requested_end": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    request_id = asyncio.run(_seed())
    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request_id}/decline", headers=headers)
    assert response.status_code == 200
    assert len(sent_emails) == 1
    assert sent_emails[0]["email"] == "caller@example.com"


def test_cannot_accept_already_handled_request(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "double-accept@example.com")

    async def _seed():
        result = await mock_db.call_meeting_requests.insert_one(
            {
                "organization_id": owner_id,
                "caller_name": "Caller",
                "requested_start": datetime.now(timezone.utc) + timedelta(days=1),
                "requested_end": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                "status": "declined",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    request_id = asyncio.run(_seed())
    response = client.post(f"/api/v1/smartflow/calls/meeting-requests/{request_id}/accept", headers=headers)
    assert response.status_code == 409


def test_list_meeting_requests_scoped_to_organization(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "list-scope@example.com")

    async def _seed():
        await mock_db.call_meeting_requests.insert_many(
            [
                {
                    "organization_id": owner_id,
                    "caller_name": "Mine",
                    "requested_start": datetime.now(timezone.utc),
                    "requested_end": datetime.now(timezone.utc) + timedelta(hours=1),
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
                {
                    "organization_id": "some-other-org",
                    "caller_name": "Not mine",
                    "requested_start": datetime.now(timezone.utc),
                    "requested_end": datetime.now(timezone.utc) + timedelta(hours=1),
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
            ]
        )

    asyncio.run(_seed())
    response = client.get("/api/v1/smartflow/calls/meeting-requests", headers=headers)
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["caller_name"] == "Mine"


# ── multi-language call handling ─────────────────────────────────────────


def test_resolve_call_language_maps_whisper_name_to_code():
    from app.services.call_phrases import resolve_call_language

    assert resolve_call_language("Spanish") == "es"
    assert resolve_call_language("japanese") == "ja"
    assert resolve_call_language(None) == "en"
    # Not in our 11-language set (Bengali deliberately excluded — TTS-1 doesn't
    # officially support it) — falls back to English rather than guessing.
    assert resolve_call_language("bengali") == "en"
    assert resolve_call_language("klingon") == "en"


def test_matches_any_falls_back_to_english_keywords():
    from app.services.call_phrases import AFFIRMATIVE_WORDS, matches_any

    assert matches_any("Sí, claro", "es", AFFIRMATIVE_WORDS)
    assert matches_any("はい", "ja", AFFIRMATIVE_WORDS)
    # English keyword still recognized even when the locked-in language is Spanish —
    # covers a caller who drifts back to English mid-call.
    assert matches_any("yes that works", "es", AFFIRMATIVE_WORDS)
    assert not matches_any("banana", "es", AFFIRMATIVE_WORDS)


def test_phrase_looks_up_translation_and_falls_back_to_english():
    from app.services.call_phrases import phrase

    assert phrase("ask_name", "fr") == "Parfait — puis-je avoir votre nom pour la demande de rendez-vous ?"
    # Unsupported/unknown language code falls back to English rather than crashing.
    assert phrase("ask_name", "bn") == phrase("ask_name", "en")
    assert phrase("ask_email", "es", name="Ana") == "Gracias, Ana. ¿Cuál es el mejor correo electrónico para enviarte la confirmación?"


def test_friendly_slot_renders_in_requested_language():
    from app.services.ai_phone_agent import _friendly_slot

    en = _friendly_slot("2026-08-17", "09:00", "en")
    assert "Monday" in en and "August" in en

    es = _friendly_slot("2026-08-17", "09:00", "es")
    assert "lunes" in es and "agosto" in es

    zh = _friendly_slot("2026-08-17", "09:00", "zh")
    assert "8月17日" in zh

    # Unknown language falls back to the English template rather than KeyError-ing.
    fallback = _friendly_slot("2026-08-17", "09:00", "bn")
    assert "Monday" in fallback


def test_scheduling_flow_end_to_end_in_spanish(mock_db):
    async def _run():
        # require_meeting_approval=True — same reasoning as
        # test_scheduling_flow_end_to_end_creates_pending_request; this test checks
        # the "sent to team" phrase, which only fires on the approval-required path.
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-agent-es",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                "require_meeting_approval": True,
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-es"})
        user_id = str(user.inserted_id)

        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(user_id, flow_service)
        agent.language = "es"
        agent.language_locked = True

        reply1 = await agent._advance_conversation("Quisiera agendar una reunión")
        assert agent.phase == "offering_slot"
        assert "libre" in reply1 or "equipo" in reply1

        reply2 = await agent._advance_conversation("Sí, claro")
        assert agent.phase == "collecting_first_name"
        assert reply2 == "Genial — ¿cuál es tu nombre?"

        reply3 = await agent._advance_conversation("Ana")
        assert agent.phase == "collecting_last_name"

        reply4 = await agent._advance_conversation("García")
        assert agent.caller_name == "Ana García"
        assert agent.phase == "confirming_phone"  # _make_agent presets caller_phone

        reply5 = await agent._advance_conversation("Sí")
        assert agent.phase == "collecting_email"

        reply6 = await agent._advance_conversation("ana at example dot com")
        assert agent.phase == "confirming_email"
        assert agent.caller_email == "ana@example.com"

        reply7 = await agent._advance_conversation("Sí")
        assert agent.phase == "confirming"

        reply8 = await agent._advance_conversation("Sí, envíalo")
        assert agent.phase == "idle"
        return reply8

    final_reply = asyncio.run(_run())
    assert "equipo" in final_reply

    request = asyncio.run(mock_db.call_meeting_requests.find_one({"organization_id": "org-agent-es"}))
    assert request is not None
    assert request["caller_name"] == "Ana García"
    assert request["caller_email"] == "ana@example.com"


def test_declining_in_japanese_offers_next_slot_in_japanese(mock_db):
    async def _run():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-agent-ja", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-ja"})
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(str(user.inserted_id), flow_service)
        agent.language = "ja"
        agent.language_locked = True

        await agent._advance_conversation("会議を予約したいです")
        assert agent.phase == "offering_slot"

        reply = await agent._advance_conversation("いいえ")
        assert agent.phase == "offering_slot"
        assert "代わりに" in reply
        return reply

    asyncio.run(_run())


def test_language_locks_in_after_first_turn_and_does_not_re_detect(mock_db):
    async def _seed_and_agent():
        await mock_db.organizations.insert_one(
            {"organization_id": "org-agent-lock", "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60}}
        )
        user = await mock_db.users.insert_one({"organization_id": "org-agent-lock"})
        flow_service = SmartFlowService(mock_db)
        return _make_agent(str(user.inserted_id), flow_service)

    agent = asyncio.run(_seed_and_agent())
    assert agent.language == "en"
    assert agent.language_locked is False

    # Simulate what process_and_respond does on the first turn: detect once, then lock.
    from app.services import call_phrases

    if not agent.language_locked:
        agent.language = call_phrases.resolve_call_language("french")
        agent.language_locked = True
    assert agent.language == "fr"

    # A later turn detecting a different language must NOT flip it mid-call.
    if not agent.language_locked:
        agent.language = call_phrases.resolve_call_language("german")
    assert agent.language == "fr"


# ── Scheduling on an outbound ("Make AI Call") call ──────────────────────
# Every test above hands the agent a caller_phone directly, so none of them cover
# how it is actually resolved from the call log — which is where outbound calls
# differ: the business is the from_number, not the person being called.


def test_outbound_call_books_against_the_customers_number_not_the_business(mock_db):
    """A meeting request created from an outbound AI call must carry the number the
    AI dialled. Reading from_number (the inbound convention) stamped the business's
    own number on the request, leaving the team calling themselves back."""

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-outbound-1",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                "require_meeting_approval": True,
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-outbound-1"})
        user_id = str(user.inserted_id)

        # Exactly what create_outbound_call writes for a "Make AI Call".
        await mock_db.call_logs.insert_one(
            {
                "user_id": user_id,
                "twilio_call_sid": "call_outbound_sched",
                "call_type": "outbound",
                "ai_ready": True,
                "from_number": "+15550000000",   # the business's shared Telnyx number
                "phone_number": "+15551234567",  # the customer the AI is calling
                "status": "in_progress",
            }
        )

        flow_service = SmartFlowService(mock_db)
        agent = AIPhoneAgent("call_outbound_sched", GoCustifyAIService(), flow_service)
        agent.user_id = user_id
        agent.is_outbound = True
        # As set by the real call_stream websocket handler for a normal outbound
        # call: the number dialled, resolved via other_party_number at session start.
        agent.caller_phone = "+15551234567"

        await agent._advance_conversation("I'd like to schedule a meeting")
        await agent._advance_conversation("Yes that works")
        await agent._advance_conversation("John")
        await agent._advance_conversation("Smith")
        # caller_phone already known -> agent reads it back rather than asking; the
        # caller confirming it is what carries it through to the meeting request.
        await agent._advance_conversation("yes")
        await agent._advance_conversation("john at example dot com")
        await agent._advance_conversation("yes")
        await agent._advance_conversation("Yes, send it")

    asyncio.run(_run())

    request = asyncio.run(mock_db.call_meeting_requests.find_one({"organization_id": "org-outbound-1"}))
    assert request is not None, "outbound AI call produced no meeting request at all"
    assert request["caller_phone"] == "+15551234567", (
        f"meeting request stored the wrong callback number: {request['caller_phone']} "
        "(+15550000000 is the business's own line)"
    )
    assert request["caller_name"] == "John Smith"
    assert request["status"] == "pending"


def test_outbound_call_falls_back_to_the_call_log_number_if_caller_phone_was_never_set(mock_db):
    """Defensive fallback in _submit_pending_request: if the session somehow reaches
    booking with no caller_phone at all (should not happen once the AI has walked the
    caller through the read-back loop, but must not silently stamp nothing), it still
    resolves the dialled number from the call log rather than leaving it blank."""

    async def _run():
        await mock_db.organizations.insert_one(
            {
                "organization_id": "org-outbound-fallback",
                "business_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                "require_meeting_approval": True,
            }
        )
        user = await mock_db.users.insert_one({"organization_id": "org-outbound-fallback"})
        user_id = str(user.inserted_id)

        await mock_db.call_logs.insert_one(
            {
                "user_id": user_id,
                "twilio_call_sid": "call_outbound_fallback",
                "call_type": "outbound",
                "ai_ready": True,
                "from_number": "+15550000000",
                "phone_number": "+15551234567",
                "status": "in_progress",
            }
        )

        flow_service = SmartFlowService(mock_db)
        agent = AIPhoneAgent("call_outbound_fallback", GoCustifyAIService(), flow_service)
        agent.user_id = user_id
        agent.is_outbound = True
        agent.caller_phone = None
        agent.caller_name = "John Smith"
        agent.caller_email = "john@example.com"
        agent.proposed_slot = {"date": "2026-09-01", "time": "10:00"}

        return await agent._submit_pending_request()

    asyncio.run(_run())

    request = asyncio.run(mock_db.call_meeting_requests.find_one({"organization_id": "org-outbound-fallback"}))
    assert request is not None
    assert request["caller_phone"] == "+15551234567"


# ── Phone/email verification loop (read-back + "is this correct?") ───────
# Client requirement: the AI must capture first name, last name, phone, and email,
# read the phone and email back, and keep re-asking — no attempt cap — until the
# caller actually confirms each one.


def test_name_collection_is_split_into_first_and_last_turns(mock_db):
    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)
        agent.phase = "offering_slot"
        agent.proposed_slot = {"date": "2026-09-01", "time": "10:00"}

        reply1 = await agent._advance_conversation("yes")
        phase1 = agent.phase
        reply2 = await agent._advance_conversation("Maria")
        phase2 = agent.phase
        reply3 = await agent._advance_conversation("Gonzalez")
        return reply1, phase1, reply2, phase2, reply3, agent

    reply1, phase1, reply2, phase2, reply3, agent = asyncio.run(_run())
    assert phase1 == "collecting_first_name"
    assert "first name" in reply1.lower()
    assert phase2 == "collecting_last_name"
    assert agent.caller_first_name == "Maria"
    assert "Maria" in reply2  # confirms it heard the first name before asking for the last
    assert agent.caller_last_name == "Gonzalez"
    assert agent.caller_name == "Maria Gonzalez"


def test_known_caller_phone_is_read_back_instead_of_asked_for(mock_db):
    """caller_phone is already known (caller ID on inbound, dialled number on
    outbound) — the AI must read it back for confirmation, not make the caller
    repeat a number that is already reliably on file."""

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)  # presets caller_phone
        agent.phase = "collecting_last_name"
        agent.caller_first_name = "Maria"
        reply = await agent._advance_conversation("Gonzalez")
        return reply, agent.phase

    reply, phase = asyncio.run(_run())
    assert phase == "confirming_phone"
    assert "+15551234567" in reply


def test_unknown_caller_phone_is_asked_for_then_read_back(mock_db):
    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)
        agent.caller_phone = None  # e.g. a blocked/private caller ID
        agent.phase = "collecting_last_name"
        agent.caller_first_name = "Maria"

        ask_reply = await agent._advance_conversation("Gonzalez")
        ask_phase = agent.phase
        confirm_reply = await agent._advance_conversation("five five five, one two three, four five six seven")
        return ask_reply, ask_phase, confirm_reply, agent.phase, agent.caller_phone

    ask_reply, ask_phase, confirm_reply, confirm_phase, phone = asyncio.run(_run())
    assert ask_phase == "collecting_phone"
    assert confirm_phase == "confirming_phone"
    assert phone == "5551234567"
    assert phone in confirm_reply


def test_rejecting_the_phone_readback_asks_again_with_no_attempt_cap(mock_db):
    """Client requirement: keep asking until the caller confirms it's correct."""

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)
        agent.phase = "confirming_phone"

        phases = []
        for _ in range(5):  # repeatedly reject — must never give up or move on
            reply = await agent._advance_conversation("no, that's wrong")
            phases.append(agent.phase)
            assert agent.phase == "collecting_phone"
            # re-supply a number so the loop can be exercised again
            reply = await agent._advance_conversation("5559990000")
            phases.append(agent.phase)
            assert agent.phase == "confirming_phone"
        return phases

    phases = asyncio.run(_run())
    assert all(p in {"collecting_phone", "confirming_phone"} for p in phases), (
        "the loop must stay in the phone verification states, never silently advance"
    )


def test_rejecting_the_email_readback_asks_again_with_no_attempt_cap(mock_db):
    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)
        agent.phase = "confirming_email"
        agent.caller_email = "wrong@example.com"

        phases = []
        for _ in range(5):
            await agent._advance_conversation("no")
            phases.append(agent.phase)
            assert agent.phase == "collecting_email"
            await agent._advance_conversation("right at example dot com")
            phases.append(agent.phase)
            assert agent.phase == "confirming_email"
        return phases, agent.caller_email

    phases, email = asyncio.run(_run())
    assert email == "right@example.com"
    assert all(p in {"collecting_email", "confirming_email"} for p in phases)


def test_unclear_yes_no_on_phone_confirm_reasks_without_advancing_or_resetting(mock_db):
    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)
        agent.phase = "confirming_phone"
        reply = await agent._advance_conversation("banana")  # neither yes nor no
        return reply, agent.phase, agent.caller_phone

    reply, phase, phone = asyncio.run(_run())
    assert phase == "confirming_phone"  # did not silently move forward
    assert phone == "+15551234567"  # did not get wiped by an unrelated utterance
    assert "yes" in reply.lower() or "no" in reply.lower()


def test_final_confirmation_summary_includes_the_phone_number(mock_db):
    """The end-of-flow summary the client hears before it goes to the team must
    mention the phone number, not just the email — the whole point of collecting it."""

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent("guest", flow_service)
        agent.phase = "confirming_email"
        agent.caller_name = "Maria Gonzalez"
        agent.caller_phone = "+15559990000"
        agent.caller_email = "maria@example.com"
        agent.proposed_slot = {"date": "2026-09-01", "time": "10:00"}
        return await agent._advance_conversation("yes")

    reply = asyncio.run(_run())
    assert "+15559990000" in reply
    assert "maria@example.com" in reply


def test_looks_like_valid_phone():
    from app.services.ai_phone_agent import _looks_like_valid_phone

    assert _looks_like_valid_phone("5551234567")
    assert _looks_like_valid_phone("+15551234567")
    assert not _looks_like_valid_phone("123")
    assert not _looks_like_valid_phone("not a number")


def test_clean_spoken_phone():
    from app.services.ai_phone_agent import _clean_spoken_phone

    assert _clean_spoken_phone("555-123-4567") == "5551234567"
    assert _clean_spoken_phone("+1 (555) 123-4567") == "+15551234567"
    assert _clean_spoken_phone("five five five one two three four five six seven") == "5551234567"
