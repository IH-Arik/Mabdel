from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from bson import ObjectId

from app.tests.test_team_direct_messaging import _same_org, _signup


def _team(client, mock_db, prefix):
    owner_headers, owner_id = _signup(client, mock_db, f"{prefix}-owner@example.com", "User Owner")
    mate_headers, mate_id = _signup(client, mock_db, f"{prefix}-mate@example.com", "User Mate")
    _same_org(mock_db, owner_id, mate_id)
    return owner_headers, owner_id, mate_headers, mate_id


def _event(mock_db, owner_id, title, days, customer=None):
    start = datetime.utcnow() + timedelta(days=days)
    doc = {"user_id": owner_id, "title": title, "starts_at": start, "ends_at": start + timedelta(hours=1), "meeting_mode": "online", "status": "confirmed"}
    if customer:
        doc["customer"] = customer
    return str(asyncio.run(mock_db.calendar_events.insert_one(doc)).inserted_id)


def test_teammates_see_the_customer_appointments_the_ai_booked_but_not_private_events(client, mock_db):
    owner_headers, owner_id, mate_headers, mate_id = _team(client, mock_db, "cal")
    booked = _event(mock_db, owner_id, "Appointment with Nadia", 2, customer={"name": "Nadia", "phone": "+15551230000"})
    private = _event(mock_db, owner_id, "Owner's private dentist visit", 3)

    titles = lambda headers: [e["title"] for e in client.get("/api/v1/smartflow/calendar/events", headers=headers, params={"upcoming_only": True}).json()["data"]["items"]]
    assert titles(owner_headers) == ["Appointment with Nadia", "Owner's private dentist visit"]
    assert titles(mate_headers) == ["Appointment with Nadia"]  # the AI's bookings are the team's; personal events are not

    assert client.get(f"/api/v1/smartflow/calendar/events/{booked}", headers=mate_headers).status_code == 200
    assert client.get(f"/api/v1/smartflow/calendar/events/{private}", headers=mate_headers).status_code == 404


def test_another_business_never_sees_the_appointments(client, mock_db):
    _, owner_id, _, _ = _team(client, mock_db, "cal2")
    stranger_headers, _ = _signup(client, mock_db, "cal2-stranger@example.com", "User Stranger")
    _event(mock_db, owner_id, "Appointment with Nadia", 2, customer={"name": "Nadia", "phone": "+15551230000"})
    items = client.get("/api/v1/smartflow/calendar/events", headers=stranger_headers).json()["data"]["items"]
    assert items == []


def test_call_totals_do_not_stop_at_500_and_count_inbound_ai_calls(client, mock_db):
    owner_headers, owner_id, mate_headers, _ = _team(client, mock_db, "calls")
    asyncio.run(
        mock_db.call_logs.insert_many(
            [{"user_id": owner_id, "status": "completed", "duration": 30, "call_type": "outgoing_direct"} for _ in range(600)]
        )
    )
    # An outbound AI call (ai_ready), an inbound call the receptionist answered (a summary but
    # no ai_ready), and one the Realtime receptionist wrote.
    asyncio.run(
        mock_db.call_logs.insert_many(
            [
                {"user_id": owner_id, "status": "completed", "duration": 120, "ai_ready": True},
                {"user_id": owner_id, "status": "completed", "duration": 180, "ai_summary": {"summary": "asked about hours"}},
                {"user_id": owner_id, "status": "completed", "duration": 60, "voice_engine": "realtime"},
                {"user_id": owner_id, "status": "completed", "duration": 45, "ai_summary": None},
            ]
        )
    )

    for headers in (owner_headers, mate_headers):
        data = client.get("/api/v1/smartflow/calls/summary", headers=headers).json()["data"]
        assert data["total_calls"] == 604  # not capped at 500
        assert data["ai_calls"] == 3
        assert data["total_minutes_saved"] == 2 + 3 + 1


def test_the_home_summary_matches_the_pages_it_links_to(client, mock_db):
    owner_headers, owner_id, mate_headers, mate_id = _team(client, mock_db, "home")
    asyncio.run(mock_db.contacts.insert_many([{"user_id": owner_id, "name": f"C{i}", "updated_at": datetime.utcnow()} for i in range(3)]))
    asyncio.run(
        mock_db.call_logs.insert_many(
            [{"user_id": owner_id, "status": "completed", "duration": 600, "ai_ready": True, "timestamp": datetime.utcnow() - timedelta(days=30 + i)} for i in range(8)]
            + [{"user_id": owner_id, "status": "completed", "duration": 0, "timestamp": datetime.utcnow() - timedelta(minutes=i)} for i in range(5)]
        )
    )
    _event(mock_db, owner_id, "Appointment with Nadia", 2, customer={"name": "Nadia", "phone": "+15551230000"})

    home = client.get("/api/v1/smartflow/home", headers=mate_headers).json()["data"]
    assert home["contacts"]["count"] == 3  # org-wide, like the Contacts page
    assert home["ai_call_analytics"]["total_calls"] == 13
    assert home["ai_call_analytics"]["minutes_saved"] == 8 * 10  # every AI call, not just the five newest shown
    assert home["calendar"]["upcoming_count"] == 1
