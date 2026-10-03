from __future__ import annotations

import asyncio
from datetime import date, datetime

from app.services.smartflow.calendar_service import CalendarService
from app.tests.test_ai_call_scheduling import _owner_with_org

TUESDAY = date(2026, 8, 18)  # a day the business is normally open, per business_hours below


def _setup(client, mock_db, monkeypatch, email, *, blocked_dates=None, daily_breaks=None):
    headers, owner_id = _owner_with_org(client, mock_db, email)
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))

    async def _org():
        await mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "business_hours": {
                    "timezone": "America/Chicago",
                    "days": [0, 1, 2, 3, 4],
                    "start_hour": 9,
                    "end_hour": 17,
                    "slot_minutes": 60,
                    "blocked_dates": blocked_dates or [],
                    "daily_breaks": daily_breaks or [],
                },
            }
        )

    asyncio.run(_org())
    return headers, owner_id, CalendarService(mock_db)


def test_blocked_date_returns_no_slots_even_though_the_weekday_is_open(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "bh-blocked@example.com", blocked_dates=["2026-08-18"])

    slots = asyncio.run(service.find_free_slots(owner_id, TUESDAY))

    assert slots == []


def test_an_unblocked_day_in_the_same_week_still_has_slots(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(client, mock_db, monkeypatch, "bh-unblocked@example.com", blocked_dates=["2026-08-18"])

    slots = asyncio.run(service.find_free_slots(owner_id, date(2026, 8, 19)))

    assert slots  # Wednesday wasn't blocked


def test_daily_break_excludes_its_window_every_open_day(client, mock_db, monkeypatch):
    _, owner_id, service = _setup(
        client, mock_db, monkeypatch, "bh-break@example.com", daily_breaks=[{"start_hour": 12, "end_hour": 13}]
    )

    slots = asyncio.run(service.find_free_slots(owner_id, TUESDAY))

    assert "12:00" not in slots
    assert "09:00" in slots and "13:00" in slots  # before and after the break are untouched


def test_a_slot_that_only_partly_overlaps_the_break_is_also_excluded(client, mock_db, monkeypatch):
    # A 90-minute appointment type starting at 11:00 would run until 12:30, overlapping
    # the 12:00-13:00 break even though 11:00 itself is outside it - must still be blocked.
    _, owner_id, service = _setup(
        client, mock_db, monkeypatch, "bh-break-overlap@example.com", daily_breaks=[{"start_hour": 12, "end_hour": 13}]
    )

    slots = asyncio.run(service.find_free_slots(owner_id, TUESDAY, duration_minutes=90))

    assert "11:00" not in slots
    assert "10:00" in slots


def test_update_business_hours_persists_blocked_dates_and_breaks(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "bh-update@example.com")

    response = client.put(
        "/api/v1/smartflow/calendar/business-hours",
        json={"blocked_dates": ["2026-12-25", "2027-01-01"], "daily_breaks": [{"start_hour": 12, "end_hour": 13}]},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["blocked_dates"] == ["2026-12-25", "2027-01-01"]
    assert data["daily_breaks"] == [{"start_hour": 12, "end_hour": 13}]


def test_invalid_blocked_date_format_is_rejected(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "bh-invalid@example.com")

    response = client.put(
        "/api/v1/smartflow/calendar/business-hours",
        json={"blocked_dates": ["not-a-date"]},
        headers=headers,
    )

    assert response.status_code == 422


def test_business_hours_text_mentions_upcoming_closures_and_breaks():
    from datetime import timedelta as td

    from app.services.ai_phone_agent import _format_business_hours_text

    soon = (date.today() + td(days=10)).isoformat()
    far = (date.today() + td(days=365)).isoformat()
    hours = {
        "days": [0, 1, 2, 3, 4],
        "start_hour": 9,
        "end_hour": 17,
        "blocked_dates": [soon, far],  # the far one is outside the 90-day lookahead window
        "daily_breaks": [{"start_hour": 12, "end_hour": 13}],
    }

    text = _format_business_hours_text(hours, "en")

    assert soon in text and far not in text
    assert "12:00 PM" in text and "1:00 PM" in text
