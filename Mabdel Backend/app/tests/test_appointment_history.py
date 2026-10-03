from __future__ import annotations

import asyncio

from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _receptionist
from app.tests.test_team_direct_messaging import _same_org, _signup


def _event(client, headers, **overrides):
    body = {"title": "Meeting", "starts_at": "2099-10-24T10:00:00", "ends_at": "2099-10-24T11:00:00", **overrides}
    return client.post("/api/v1/smartflow/calendar/events", headers=headers, json=body)


def _history(client, headers, event_id):
    response = client.get(f"/api/v1/smartflow/calendar/events/{event_id}/history", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_creating_an_event_records_who_made_it(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "hist-create@example.com")
    event = _event(client, headers).json()["data"]

    entries = _history(client, headers, event["id"])
    assert len(entries) == 1
    assert entries[0]["action"] == "created"
    assert "hist-create" not in entries[0]["actor"]  # a real display name, not a raw id/email
    assert entries[0]["after"]["status"] == "scheduled"
    assert owner_id  # sanity


def test_moving_the_time_is_recorded_as_rescheduled_other_edits_as_updated(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "hist-actions@example.com")
    event = _event(client, headers).json()["data"]

    client.patch(f"/api/v1/smartflow/calendar/events/{event['id']}", headers=headers, json={"title": "Renamed"})
    client.patch(
        f"/api/v1/smartflow/calendar/events/{event['id']}", headers=headers,
        json={"starts_at": "2099-10-25T10:00:00", "ends_at": "2099-10-25T11:00:00"},
    )

    entries = _history(client, headers, event["id"])
    assert [entry["action"] for entry in entries] == ["created", "updated", "rescheduled"]
    assert entries[1]["before"]["starts_at"] == entries[1]["after"]["starts_at"]  # only the title changed
    assert entries[2]["before"]["starts_at"] != entries[2]["after"]["starts_at"]


def test_deleting_an_event_is_recorded_and_the_history_survives_the_event_being_gone(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "hist-delete@example.com")
    event = _event(client, headers).json()["data"]
    assert client.delete(f"/api/v1/smartflow/calendar/events/{event['id']}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/smartflow/calendar/events/{event['id']}", headers=headers).status_code == 404  # the event itself is gone

    entries = _history(client, headers, event["id"])
    assert [entry["action"] for entry in entries] == ["created", "cancelled"]
    assert entries[-1]["after"] is None


def test_a_teammate_can_see_the_history_a_stranger_cannot(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "hist-team-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "hist-team-mate@example.com", "Mate")
    stranger_headers, _ = _signup(client, mock_db, "hist-team-stranger@example.com", "Stranger")
    _same_org(mock_db, owner_id, mate_id)
    event = _event(client, owner_headers).json()["data"]

    assert len(_history(client, mate_headers, event["id"])) == 1
    stranger = client.get(f"/api/v1/smartflow/calendar/events/{event['id']}/history", headers=stranger_headers)
    assert stranger.status_code == 200 and stranger.json()["data"] == []


def test_an_ai_booked_and_ai_cancelled_appointment_shows_the_ai_as_the_actor(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "hist-ai@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    agent.caller_name = "Karim"
    booked = asyncio.run(agent._tool_book_appointment(date="2026-08-18", time="10:00", first_name="Karim"))
    assert booked["outcome"] == "booked", booked
    event = asyncio.run(mock_db.calendar_events.find_one({}))

    cancelled = asyncio.run(agent._tool_cancel_appointment(appointment_id=str(event["_id"]), caller_name="Karim"))
    assert cancelled["outcome"] == "cancelled", cancelled

    owner_login = client.post("/api/v1/auth/login", json={"email": "hist-ai@example.com", "password": "SecurePass2024!"})
    owner_headers = {"Authorization": f"Bearer {owner_login.json()['data']['access_token']}"}
    entries = _history(client, owner_headers, str(event["_id"]))
    assert [entry["action"] for entry in entries] == ["created", "cancelled"]
    assert entries[0]["actor"] == "AI Receptionist" and entries[1]["actor"] == "AI Receptionist"
