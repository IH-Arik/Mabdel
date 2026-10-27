import asyncio
import json

import pytest
from bson import ObjectId

from app.services.realtime_receptionist import TOOLS
from app.tests.test_realtime_receptionist import FakeOpenAI, _receptionist


def _seed_owner(mock_db, key):
    owner = str(ObjectId())

    async def seed():
        await mock_db.users.insert_one({"_id": ObjectId(owner), "email": f"{key}@example.com", "organization_id": owner})
        await mock_db.organizations.insert_one({"organization_id": owner, "business_name": "Test Business"})

    asyncio.run(seed())
    return owner


@pytest.mark.parametrize("tool", ["book_appointment", "reschedule_appointment", "cancel_appointment"])
@pytest.mark.parametrize("consent", [None, False, 1, "yes"])
def test_appointment_tools_require_explicit_boolean_consent(client, mock_db, monkeypatch, tool, consent):
    owner = _seed_owner(mock_db, f"consent-{tool}-{consent}")
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        result = await agent.run_tool(tool, {"caller_confirmed": consent})
        assert result["status"] == "REQUIRES_CALLER_CONFIRMATION"
        assert await mock_db.calendar_events.count_documents({}) == 0
        assert await mock_db.call_meeting_requests.count_documents({}) == 0
        assert await mock_db.messages.count_documents({}) == 0
    asyncio.run(run())
    schema = next(item for item in TOOLS if item["name"] == tool)
    assert "caller_confirmed" in schema["parameters"]["required"]


def test_provider_tool_call_retries_do_not_repeat_a_message(client, mock_db, monkeypatch):
    owner = _seed_owner(mock_db, "tool-retry")
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        args = {"message": "Please call me about the quote", "caller_name": "Jane"}
        first = await agent.run_tool("take_message", json.dumps(args), invocation_id="tool-1")
        second = await agent.run_tool("take_message", args, invocation_id="tool-1")
        assert first["saved"] and second == first
        assert await mock_db.messages.count_documents({}) == 1
        mismatch = await agent.run_tool("take_message", {**args, "message": "Different request"}, invocation_id="tool-1")
        assert mismatch["status"] == "ACTION_FAILED"
        assert await mock_db.messages.count_documents({}) == 1
    asyncio.run(run())


def test_concurrent_repeated_tool_id_runs_only_one_side_effect(client, mock_db, monkeypatch):
    owner = _seed_owner(mock_db, "tool-concurrent")
    calls = []
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        async def delayed(**kwargs):
            calls.append(kwargs)
            await asyncio.sleep(0.03)
            return {"saved": True}
        monkeypatch.setattr(agent, "_tool_take_message", delayed)
        results = await asyncio.gather(*(agent.run_tool("take_message", {"message": "Callback"}, invocation_id="shared") for _ in range(2)))
        assert len(calls) == 1
        assert any(result.get("saved") for result in results)
        assert any(result.get("status") == "ACTION_UNKNOWN" for result in results)
        assert (await agent.run_tool("take_message", {"message": "Callback"}, invocation_id="shared"))["saved"]
    asyncio.run(run())
