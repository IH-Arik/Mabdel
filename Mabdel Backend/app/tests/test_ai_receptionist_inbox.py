from __future__ import annotations

import asyncio
import json
from datetime import datetime

from app.services.smartflow.calendar_service import CalendarService
from app.tests.test_realtime_receptionist import FakeOpenAI, _business, _receptionist


def test_a_second_message_from_the_same_caller_reuses_the_thread(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "ai-inbox-reuse@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool("take_message", json.dumps({"message": "Please call me back about the quote", "caller_name": "Karim"}))
        await agent.run_tool("take_message", json.dumps({"message": "Still waiting on that callback", "caller_name": "Karim"}))

    asyncio.run(run())

    conversations = asyncio.run(mock_db.conversations.find({"user_id": owner_id, "platform": "ai_receptionist"}).to_list(10))
    assert len(conversations) == 1  # same caller, same thread - not a new conversation per call
    messages = asyncio.run(mock_db.messages.find({"conversation_id": str(conversations[0]["_id"])}).sort("timestamp", 1).to_list(10))
    assert len(messages) == 2
    assert "quote" in messages[0]["content"] and "callback" in messages[1]["content"]
    contacts = asyncio.run(mock_db.contacts.find({"user_id": owner_id, "phone": "+15551230000"}).to_list(10))
    assert len(contacts) == 1  # no duplicate contact created on the second call either


def test_a_message_with_no_phone_number_on_file_skips_the_inbox_post_without_error(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "ai-inbox-no-phone@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), caller=None)
        agent.caller_phone = None
        result = await agent.run_tool("take_message", json.dumps({"message": "No number to reach me", "caller_name": "Anonymous"}))
        assert result["saved"] is True  # the primary behavior (bell notification) still works

    asyncio.run(run())
    assert asyncio.run(mock_db.conversations.count_documents({"platform": "ai_receptionist"})) == 0
    assert asyncio.run(mock_db.notifications.count_documents({"user_id": owner_id})) == 1


def test_a_message_is_formatted_with_caller_number_and_department_and_callback_flag(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "ai-inbox-format@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool(
            "take_message",
            json.dumps(
                {
                    "message": "Lower-left tooth pain for two days; worsening.",
                    "caller_name": "John Smith",
                    "callback_number": "+15551234567",
                    "department": "Dr. Lee's office",
                    "callback_requested": True,
                }
            ),
        )

    asyncio.run(run())
    conversation = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "ai_receptionist"}))
    message = asyncio.run(mock_db.messages.find_one({"conversation_id": str(conversation["_id"])}))
    assert message["content"] == (
        "John Smith — +15551234567 — Lower-left tooth pain for two days; worsening. "
        "Requests callback. For: Dr. Lee's office."
    )


def test_a_message_without_department_or_callback_flag_has_no_trailing_suffix(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "ai-inbox-format-plain@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool("take_message", json.dumps({"message": "Please call me back", "caller_name": "Karim"}))

    asyncio.run(run())
    conversation = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "ai_receptionist"}))
    message = asyncio.run(mock_db.messages.find_one({"conversation_id": str(conversation["_id"])}))
    assert message["content"] == "Karim — +15551230000 — Please call me back"


def test_the_ai_receptionist_thread_is_separate_from_the_customers_sms_thread(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "ai-inbox-separate@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool("take_message", json.dumps({"message": "Please call me back", "caller_name": "Nadia"}))

    asyncio.run(run())
    assert asyncio.run(mock_db.conversations.count_documents({"user_id": owner_id, "platform": "ai_receptionist"})) == 1
    assert asyncio.run(mock_db.conversations.count_documents({"user_id": owner_id, "platform": "sms"})) == 0


def test_listing_unified_conversations_filters_by_the_ai_receptionist_platform(client, mock_db, monkeypatch):
    from app.tests.test_ai_call_scheduling import _owner_with_org

    headers, owner_id = _owner_with_org(client, mock_db, "ai-inbox-list@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))
    asyncio.run(
        mock_db.organizations.insert_one(
            {"organization_id": owner_id, "business_name": "Bright Dental", "telnyx_phone_number": "+15550009999"}
        )
    )

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        await agent.run_tool("take_message", json.dumps({"message": "Please call me back", "caller_name": "Nadia"}))

    asyncio.run(run())

    response = client.get("/api/v1/smartflow/conversations", params={"platform": "ai_receptionist"}, headers=headers)
    assert response.status_code == 200, response.text
    items = response.json()["data"]["items"]
    assert len(items) == 1 and items[0]["platform"] == "ai_receptionist"

    all_response = client.get("/api/v1/smartflow/conversations", headers=headers)
    all_platforms = {item["platform"] for item in all_response.json()["data"]["items"]}
    assert "ai_receptionist" in all_platforms  # shows up in "All" too, not just its own tab
