from __future__ import annotations

import asyncio
import json

from app.api.v1.endpoints.calls import _post_lead_call_summary
from app.tests.test_realtime_receptionist import FakeOpenAI, _business, _receptionist


def test_capture_lead_creates_a_new_source_tagged_contact(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "lead-new@example.com")
    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id, "call_type": "incoming"}))

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        result = await agent.run_tool(
            "capture_lead",
            json.dumps(
                {
                    "caller_name": "Priya Shah",
                    "phone": "+15559998888",
                    "email": "priya@example.com",
                    "service_interested": "Invisalign consultation",
                    "need_description": "Wants a quote for clear aligners.",
                    "preferred_time": "next Tuesday afternoon",
                }
            ),
        )
        assert result["saved"] is True

    asyncio.run(run())

    contact = asyncio.run(mock_db.contacts.find_one({"user_id": owner_id, "phone": "+15559998888"}))
    assert contact is not None
    assert contact["source"] == "ai_call_lead"
    assert contact["name"] == "Priya Shah"
    assert contact["email"] == "priya@example.com"
    assert "Invisalign consultation" in contact["notes"]
    assert "next Tuesday afternoon" in contact["notes"]

    call = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "call-rt"}))
    assert call["lead_contact_id"] == str(contact["_id"])

    conversation = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "ai_receptionist"}))
    message = asyncio.run(mock_db.messages.find_one({"conversation_id": str(conversation["_id"])}))
    assert "Invisalign consultation" in message["content"]


def test_capture_lead_updates_the_existing_contact_instead_of_duplicating_by_phone(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "lead-existing-phone@example.com")
    asyncio.run(
        mock_db.contacts.insert_one(
            {
                "user_id": owner_id,
                "name": "Existing Patient",
                "email": None,
                "phone": "+15557776666",
                "source": None,
                "notes": None,
                "identities": [],
                "presence": "offline",
            }
        )
    )

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool(
            "capture_lead",
            json.dumps({"caller_name": "Existing Patient", "phone": "+15557776666", "service_interested": "Teeth whitening"}),
        )

    asyncio.run(run())

    contacts = asyncio.run(mock_db.contacts.find({"user_id": owner_id, "phone": "+15557776666"}).to_list(10))
    assert len(contacts) == 1  # no duplicate created
    assert contacts[0]["source"] is None  # an existing contact's source is never overwritten
    assert "Teeth whitening" in (contacts[0]["notes"] or "")


def test_capture_lead_matches_an_existing_contact_by_email_when_the_phone_differs(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "lead-existing-email@example.com")
    asyncio.run(
        mock_db.contacts.insert_one(
            {
                "user_id": owner_id,
                "name": "Known Caller",
                "email": "known@example.com",
                "phone": "+15551112222",
                "source": None,
                "notes": None,
                "identities": [],
                "presence": "offline",
            }
        )
    )

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool(
            "capture_lead",
            json.dumps(
                {
                    "caller_name": "Known Caller",
                    "phone": "+15553334444",  # calling from a different number than on file
                    "email": "known@example.com",
                    "service_interested": "A second opinion",
                }
            ),
        )

    asyncio.run(run())

    contacts = asyncio.run(mock_db.contacts.find({"user_id": owner_id, "email": "known@example.com"}).to_list(10))
    assert len(contacts) == 1  # matched by email, not duplicated


def test_the_call_summary_is_attached_to_the_leads_conversation_thread(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "lead-summary@example.com")
    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id, "call_type": "incoming"}))

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool(
            "capture_lead",
            json.dumps({"caller_name": "Sam Lee", "phone": "+15552223333", "service_interested": "Orthodontics"}),
        )
        await mock_db.call_logs.update_one({"twilio_call_sid": "call-rt"}, {"$set": {"from_number": "+15552223333"}})
        summary = {"purpose": "Caller asked about orthodontic options.", "key_points": ["Interested in braces", "Budget-conscious"]}
        await _post_lead_call_summary(mock_db, "call-rt", owner_id, summary)

    asyncio.run(run())

    conversation = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "ai_receptionist"}))
    messages = asyncio.run(mock_db.messages.find({"conversation_id": str(conversation["_id"])}).sort("timestamp", 1).to_list(10))
    assert len(messages) == 2  # the lead-capture message, then the call summary
    assert messages[1]["content"].startswith("Call summary —")
    assert "orthodontic options" in messages[1]["content"]
    assert "Interested in braces" in messages[1]["content"]


def test_no_call_summary_is_posted_when_the_call_never_captured_a_lead(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "lead-summary-skip@example.com")
    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-no-lead", "user_id": owner_id, "from_number": "+15550001111"}))

    asyncio.run(_post_lead_call_summary(mock_db, "call-no-lead", owner_id, {"purpose": "Routine booking."}))

    assert asyncio.run(mock_db.conversations.count_documents({"user_id": owner_id, "platform": "ai_receptionist"})) == 0
