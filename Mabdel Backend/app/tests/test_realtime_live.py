"""Live end-to-end check of the receptionist against the REAL OpenAI Realtime API.

Skipped unless REALTIME_LIVE=1 (it spends a few cents and needs OPENAI_API_KEY):

    REALTIME_LIVE=1 pytest app/tests/test_realtime_live.py -s

Telnyx is faked and the caller is typed instead of spoken, but everything else is real:
the session handshake, the model, its tool calls, our appointment tools and database
writes, the customer text, and the goodbye/hang-up. Mocked tests cannot catch a payload
the API rejects (that is how a rejected `rate` field once slipped through).
"""

from __future__ import annotations

import asyncio
import json
import os

import pytest

import app.services.realtime_receptionist as realtime
from app.core.config import settings
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.realtime_receptionist import RealtimeReceptionist
from app.services.smartflow_service import SmartFlowService
from app.tests.test_ai_call_scheduling import _owner_with_org

# Captured at import, before the autouse fixture swaps the real opener for a refusal.
_REAL_OPEN = realtime.open_openai_socket

pytestmark = pytest.mark.skipif(
    os.environ.get("REALTIME_LIVE") != "1" or not settings.OPENAI_API_KEY,
    reason="live Realtime check: set REALTIME_LIVE=1 (needs OPENAI_API_KEY)",
)

CALLER = "+15551230000"


class Control:
    def __init__(self):
        self.hung_up = []

    async def hangup_call(self, call_id):
        self.hung_up.append(call_id)
        return True

    async def transfer_call(self, call_id, *, to_number):
        return True


async def _idle(agent, timeout=60):
    async with asyncio.timeout(timeout):
        while agent.response_active or agent._tasks or agent.greeting_in_progress:
            await asyncio.sleep(0.2)
        await asyncio.sleep(0.4)  # let a late event land


async def _say(agent, text):
    await agent._send_openai(
        {"type": "conversation.item.create", "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]}}
    )
    await agent._request_response()
    await asyncio.sleep(0.3)
    await _idle(agent)


def test_a_real_model_books_an_appointment_through_our_tools(client, mock_db, monkeypatch):
    _, owner_id = _owner_with_org(client, mock_db, "rt-live@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "business_hours": {"timezone": "America/Chicago", "days": [0, 1, 2, 3, 4, 5, 6], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                "ai_call_settings": {"voice_id": "female_warm", "knowledge_base": "A cleaning costs $80 and takes 45 minutes."},
            }
        )
    )
    asyncio.run(mock_db.business_profiles.insert_one({"user_id": owner_id, "business_name": "Bright Dental", "services_offered": "Cleanings and check-ups"}))
    control = Control()
    frames: list[dict] = []
    report: dict = {}

    async def run():
        agent = RealtimeReceptionist("live-call", GoCustifyAIService(), SmartFlowService(mock_db), open_socket=_REAL_OPEN, call_control=control)
        agent.user_id = owner_id
        agent.caller_phone = CALLER
        assert await agent.connect(), "the live API rejected our session configuration"

        async def to_telnyx(message):
            frames.append(message)

        await agent.start(to_telnyx)
        await _idle(agent)
        report["greeting_frames"] = len(frames)
        assert frames, "no greeting audio came back"
        assert all(set(frame) == {"event", "media"} for frame in frames), "Telnyx rejects frames with extra keys"

        await _say(agent, "Hi, how much is a cleaning?")
        await _say(agent, "Great. Do you have anything on Tuesday morning?")
        await _say(agent, "The first time you mentioned works. My name is Nadia Rahman, and please text me the confirmation.")
        for _ in range(2):
            if any(action["tool"] == "book_appointment" for action in agent.ai_actions):
                break
            await _say(agent, "Yes, please go ahead and book it. Thank you.")
        report["tools"] = [action["tool"] for action in agent.ai_actions]

        await _say(agent, "That's everything, thank you so much. Goodbye!")
        await asyncio.sleep(3)
        report["hung_up"] = control.hung_up == ["live-call"]
        report["transcript_lines"] = len(agent.transcript_log)
        await agent.close()

    asyncio.run(run())
    print("\nLIVE REPORT:", json.dumps(report))
    assert "check_availability" in report["tools"], report
    booked = [a for a in report["tools"] if a == "book_appointment"]
    assert booked, f"the model never booked: {report}"
    event = asyncio.run(mock_db.calendar_events.find_one({"customer.phone": CALLER}))
    assert event and event["customer"]["name"].lower().startswith("nadia"), "no appointment was saved for the caller"
    texts = asyncio.run(mock_db.messages.find({"platform": "sms", "automated": True}).to_list(None))
    assert texts and "Bright Dental" in texts[0]["content"], "the customer was not texted"
