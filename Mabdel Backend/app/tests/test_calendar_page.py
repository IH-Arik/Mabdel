from __future__ import annotations

import asyncio
from datetime import datetime

from bson import ObjectId

from app.core.exceptions import AppException
from app.services.smartflow.google_calendar_service import GoogleCalendarService
from app.tests.test_team_direct_messaging import _same_org, _signup


def _event(client, headers, **overrides):
    body = {"title": "Meeting", "starts_at": "2099-10-24T10:00:00", "ends_at": "2099-10-24T11:00:00", **overrides}
    return client.post("/api/v1/smartflow/calendar/events", headers=headers, json=body)


def _customer_appointment(mock_db, owner_id, *, start, end):
    """What the AI receptionist books: an event under the owner that carries a customer."""
    result = asyncio.run(
        mock_db.calendar_events.insert_one(
            {
                "user_id": owner_id,
                "title": "Appointment with Nadia",
                "starts_at": datetime.fromisoformat(start),
                "ends_at": datetime.fromisoformat(end),
                "customer": {"name": "Nadia", "phone": "+8801700000001"},
                "status": "scheduled",
                "contact_ids": [],
                "timezone": "UTC",
            }
        )
    )
    return str(result.inserted_id)


def test_searching_events_by_text_with_symbols_does_not_crash(client, mock_db):
    headers, _ = _signup(client, mock_db, "cal-search@example.com", "Owner")
    assert _event(client, headers, title="Review (Q4)").status_code == 201
    for term in ("(", "[x", "a*"):
        assert client.get("/api/v1/smartflow/calendar/events", headers=headers, params={"search": term}).status_code == 200, term
    found = client.get("/api/v1/smartflow/calendar/events", headers=headers, params={"search": "Review ("}).json()["data"]["items"]
    assert [item["title"] for item in found] == ["Review (Q4)"]


def test_a_manual_meeting_cannot_be_put_on_top_of_a_customer_appointment(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "cal-clash-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "cal-clash-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    _customer_appointment(mock_db, owner_id, start="2099-11-02T10:00:00", end="2099-11-02T11:00:00")

    clash = _event(client, mate_headers, starts_at="2099-11-02T10:30:00", ends_at="2099-11-02T11:30:00")
    assert clash.status_code == 409
    assert _event(client, mate_headers, starts_at="2099-11-02T11:00:00", ends_at="2099-11-02T12:00:00").status_code == 201


def test_a_teammates_private_meeting_does_not_block_yours(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "cal-priv-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "cal-priv-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    assert _event(client, owner_headers, title="Owner private").status_code == 201
    assert _event(client, mate_headers, title="Mate meeting").status_code == 201  # same hour, different person


def test_attendees_from_the_businesss_contacts_are_shown_for_a_teammates_event(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "cal-att-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "cal-att-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    contact = client.post("/api/v1/smartflow/contacts", headers=owner_headers, json={"name": "Karim", "phone": "+8801711110000"}).json()["data"]["id"]

    created = _event(client, mate_headers, contact_ids=[contact]).json()["data"]
    assert [attendee["name"] for attendee in created["attendees"]] == ["Karim"]


def test_an_event_can_still_be_deleted_when_the_google_copy_cannot(client, mock_db, monkeypatch):
    headers, owner_id = _signup(client, mock_db, "cal-del@example.com", "Owner")
    event_id = _event(client, headers).json()["data"]["id"]
    asyncio.run(mock_db.calendar_events.update_one({"_id": ObjectId(event_id)}, {"$set": {"google_event_id": "g-1"}}))

    async def broken(self, user_id, google_event_id):
        raise AppException(status_code=502, code="GOOGLE_EVENT_DELETE_FAILED", message="Google Calendar event could not be deleted.")

    monkeypatch.setattr(GoogleCalendarService, "delete_remote_event", broken)
    assert client.delete(f"/api/v1/smartflow/calendar/events/{event_id}", headers=headers).status_code in (200, 204)
    assert asyncio.run(mock_db.calendar_events.find_one({"_id": ObjectId(event_id)})) is None


def test_the_invite_link_opens_a_page_that_escapes_what_people_typed(client, mock_db):
    headers, _ = _signup(client, mock_db, "cal-share@example.com", "Owner")
    created = _event(client, headers, title="<script>alert(1)</script>", location="Room <b>4</b>", timezone="Asia/Dhaka").json()["data"]
    shared = client.post(f"/api/v1/smartflow/calendar/events/{created['id']}/share", headers=headers, json={"channel": "link"})
    assert shared.status_code == 200, shared.text
    token_url = shared.json()["data"]["share_url"]
    path = "/calendar/share/" + token_url.rsplit("/", 1)[1]

    page = client.get(path)
    assert page.status_code == 200
    assert "<script>alert(1)</script>" not in page.text and "&lt;script&gt;" in page.text
    assert "Room &lt;b&gt;4&lt;/b&gt;" in page.text
    assert "Asia" not in page.text and ("+06" in page.text or "BDT" in page.text)  # shown in the meeting's own zone

    missing = client.get("/calendar/share/" + "x" * 24)
    assert missing.status_code == 404 and "Meeting not found" in missing.text
