from __future__ import annotations

import asyncio

from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _receptionist


def _add_provider(mock_db, owner_id, name, role_title=None):
    asyncio.run(mock_db.providers.insert_one({"user_id": owner_id, "name": name, "role_title": role_title, "linked_user_id": None, "active": True}))


def _add_type(mock_db, owner_id, name, minutes):
    asyncio.run(mock_db.appointment_types.insert_one({"user_id": owner_id, "name": name, "duration_minutes": minutes, "active": True}))


def test_providers_and_types_appear_in_the_instructions_when_set_up(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "recept-providers@example.com")
    _add_provider(mock_db, owner_id, "Dr. Smith", "Dentist")
    _add_type(mock_db, owner_id, "Cleaning", 45)
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())
    assert "PROVIDERS: Dr. Smith (Dentist)" in instructions
    assert "APPOINTMENT TYPES: Cleaning (45 min)" in instructions
    assert "Ask which one the caller wants" in instructions


def test_no_providers_configured_adds_nothing_to_the_instructions(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "recept-no-providers@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())
    assert "PROVIDERS" not in instructions
    assert "APPOINTMENT TYPES" not in instructions
    assert "Ask which one the caller wants" not in instructions


def test_the_book_appointment_tool_passes_the_provider_and_type_through(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "recept-book-provider@example.com")
    _add_provider(mock_db, owner_id, "Dr. Smith")
    _add_type(mock_db, owner_id, "Cleaning", 45)
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    agent.caller_name = "Karim"

    result = asyncio.run(
        agent._tool_book_appointment(date="2026-08-18", time="10:00", first_name="Karim", provider="dr. smith", appointment_type="cleaning")
    )
    assert result["outcome"] == "booked", result
    event = asyncio.run(mock_db.calendar_events.find_one({}))
    assert event["provider_id"] is not None
    assert (event["ends_at"] - event["starts_at"]).total_seconds() == 45 * 60
    assert "Cleaning" in event["title"] and "Dr. Smith" in event["title"]
