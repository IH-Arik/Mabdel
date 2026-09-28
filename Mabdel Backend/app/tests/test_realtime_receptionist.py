from __future__ import annotations

import asyncio
import json
from datetime import datetime

from bson import ObjectId

import app.services.realtime_receptionist as realtime
from app.core.config import settings
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.realtime_receptionist import RealtimeReceptionist
from app.services.smartflow.calendar_service import CalendarService
from app.services.smartflow_service import SmartFlowService
from app.tests.test_ai_call_scheduling import _owner_with_org


class FakeOpenAI:
    """Stands in for the Realtime WebSocket: records what we send, replays events."""

    def __init__(self):
        self.sent: list[dict] = []
        self.inbox: asyncio.Queue | None = None
        self.closed = False
        self._preloaded: list[dict] = []
        self.reject_session = False
        self.handshake: asyncio.Queue = asyncio.Queue()

    def preload(self, *events):
        self._preloaded.extend(events)

    async def send(self, raw):
        event = json.loads(raw)
        self.sent.append(event)
        if event.get("type") == "session.update":
            # What the real API answers: session.updated, or an error for a bad config.
            self.handshake.put_nowait(
                {"type": "error", "error": {"message": "Unknown parameter"}} if self.reject_session else {"type": "session.updated"}
            )

    async def recv(self):
        return json.dumps(await self.handshake.get())

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.inbox is None:
            self.inbox = asyncio.Queue()
            for event in self._preloaded:
                self.inbox.put_nowait(event)
        event = await self.inbox.get()
        if event is None:
            raise StopAsyncIteration
        return json.dumps(event)

    async def emit(self, event):
        if self.inbox is None:
            self.inbox = asyncio.Queue()
        await self.inbox.put(event)
        for _ in range(5):
            await asyncio.sleep(0)

    async def close(self):
        self.closed = True

    def of_type(self, kind):
        return [event for event in self.sent if event.get("type") == kind]


class FakeCallControl:
    def __init__(self):
        self.hung_up: list[str] = []
        self.transfers: list[tuple[str, str]] = []

    async def hangup_call(self, call_id):
        self.hung_up.append(call_id)
        return True

    async def transfer_call(self, call_id, *, to_number):
        self.transfers.append((call_id, to_number))
        return True


def _business(client, mock_db, monkeypatch, email, **settings_doc):
    _, owner_id = _owner_with_org(client, mock_db, email)
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "business_hours": {"timezone": "America/Chicago", "days": [0, 1, 2, 3, 4], "start_hour": 9, "end_hour": 17, "slot_minutes": 60},
                "ai_call_settings": {"voice_id": "female_warm", **settings_doc},
            }
        )
    )
    asyncio.run(mock_db.business_profiles.insert_one({"user_id": owner_id, "business_name": "Bright Dental", "services_offered": "Cleanings and check-ups"}))
    return owner_id


def _receptionist(mock_db, owner_id, socket, control=None, caller="+15551230000"):
    agent = RealtimeReceptionist("call-rt", GoCustifyAIService(), SmartFlowService(mock_db), open_socket=lambda: _ready(socket), call_control=control or FakeCallControl())
    agent.user_id = owner_id
    agent.caller_phone = caller
    return agent


async def _ready(socket):
    return socket


def test_session_is_telephony_audio_with_the_business_briefing(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-config@example.com", knowledge_base="A cleaning costs $80. Free parking behind the building.")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        assert await agent.connect()

    asyncio.run(run())
    session = socket.of_type("session.update")[0]["session"]
    # No "rate": the live API rejects it on audio/pcmu, and a rejected session.update
    # leaves the call on the default 24 kHz format.
    assert session["audio"]["input"]["format"] == {"type": "audio/pcmu"}
    assert session["audio"]["output"]["format"] == {"type": "audio/pcmu"}
    assert session["audio"]["output"]["voice"] == "coral"  # the business's chosen voice
    assert {tool["name"] for tool in session["tools"]} >= {"check_availability", "book_appointment", "reschedule_appointment", "cancel_appointment", "take_message", "transfer_to_human", "end_call"}
    instructions = session["instructions"]
    assert "Bright Dental" in instructions and "Cleanings and check-ups" in instructions
    assert "A cleaning costs $80." in instructions
    # The safety rules come after everything the business typed, so they win.
    assert instructions.index("NON-NEGOTIABLE RULES") > instructions.index("A cleaning costs $80.")


def test_audio_passes_through_and_the_greeting_is_protected(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-audio@example.com")
    socket = FakeOpenAI()
    to_telnyx: list[dict] = []

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        await agent.connect()

        async def send(message):
            to_telnyx.append(message)

        await agent.start(send)
        greeting = socket.of_type("response.create")[0]["response"]["instructions"]
        assert "Bright Dental" in greeting and "recorded" in greeting.lower()

        await agent.on_caller_audio("aGVsbG8=")  # "Hello?" over the greeting: not forwarded
        assert not socket.of_type("input_audio_buffer.append")

        await socket.emit({"type": "response.output_audio.delta", "item_id": "item_1", "delta": "//79/A=="})
        assert to_telnyx[-1] == {"event": "media", "media": {"payload": "//79/A=="}}

        await socket.emit({"type": "response.done", "response": {"output": []}})
        assert socket.of_type("input_audio_buffer.clear")
        await agent.on_caller_audio("aGVsbG8=")
        assert socket.of_type("input_audio_buffer.append")[-1]["audio"] == "aGVsbG8="

        await socket.emit({"type": "response.output_audio.delta", "item_id": "item_2", "delta": "AAAAAAAA"})
        await socket.emit({"type": "input_audio_buffer.speech_started"})
        assert to_telnyx[-1] == {"event": "clear"}  # queued AI audio stops at once
        truncate = socket.of_type("conversation.item.truncate")[-1]
        assert truncate["item_id"] == "item_2" and truncate["audio_end_ms"] >= 0
        await agent.close()

    asyncio.run(run())


def test_tools_book_a_time_the_caller_named_and_record_it(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-book@example.com")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await socket.emit({"type": "response.done", "response": {"output": []}})  # greeting finished
        await socket.emit({
            "type": "response.done",
            "response": {"output": [{"type": "function_call", "name": "check_availability", "call_id": "c1", "arguments": json.dumps({"date": "2026-08-18", "part_of_day": "morning"})}]},
        })
        await _until(lambda: len(socket.of_type("conversation.item.create")) == 1)
        output = json.loads(socket.of_type("conversation.item.create")[-1]["item"]["output"])
        assert [slot["time"] for slot in output["slots"]] == ["09:00", "10:00", "11:00"]
        assert socket.of_type("response.create")[-1] == {"type": "response.create"}  # model continues speaking

        await socket.emit({
            "type": "response.done",
            "response": {"output": [{"type": "function_call", "name": "book_appointment", "call_id": "c2", "arguments": json.dumps({"date": "2026-08-18", "time": "10:00", "first_name": "Nadia", "last_name": "Rahman"})}]},
        })
        await _until(lambda: len(socket.of_type("conversation.item.create")) == 2)
        booked = json.loads(socket.of_type("conversation.item.create")[-1]["item"]["output"])
        assert booked["outcome"] == "booked" and booked["when"] == "Tue Aug 18 at 10:00 AM"
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())
    event = asyncio.run(mock_db.calendar_events.find_one({"customer.phone": "+15551230000"}))
    assert event and event["customer"]["name"] == "Nadia Rahman"
    log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "call-rt"}))
    assert [action["tool"] for action in log["ai_actions"]] == ["check_availability", "book_appointment"]
    assert asyncio.run(mock_db.messages.count_documents({"platform": "sms", "automated": True})) == 1


async def _until(condition, timeout=5.0):
    """Tool calls hit the database, so give the reader task real time to finish."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while not condition():
        assert loop.time() < deadline, "timed out waiting for the receptionist"
        await asyncio.sleep(0.01)


async def _noop():
    return None


def test_goodbye_then_hang_up_and_transfer_to_a_person(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-end@example.com", transfer_number="+15550001111")
    socket = FakeOpenAI()
    control = FakeCallControl()
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await socket.emit({"type": "response.done", "response": {"output": []}})

        result = await agent.run_tool("transfer_to_human", json.dumps({"reason": "wants the dentist"}))
        assert result == {"transferred": True} and control.transfers == [("call-rt", "+15550001111")]
        await agent.on_caller_audio("aGVsbG8=")
        assert not socket.of_type("input_audio_buffer.append")  # the call is with a person now

        agent.transferring = False
        await socket.emit({"type": "response.done", "response": {"output": [{"type": "function_call", "name": "end_call", "call_id": "c9", "arguments": "{}"}]}})
        assert not control.hung_up  # the goodbye has not been said yet
        await socket.emit({"type": "response.done", "response": {"output": []}})
        await asyncio.sleep(0.01)
        assert control.hung_up == ["call-rt"]
        await agent.close()

    asyncio.run(run())


def test_no_transfer_number_means_offer_a_message(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-notransfer@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        result = await agent.run_tool("transfer_to_human", "{}")
        assert result["transferred"] is False and "message" in result["note"]
        saved = await agent.run_tool("take_message", json.dumps({"message": "Please call me about my crown", "caller_name": "Nadia", "urgent": True}))
        assert saved["saved"] is True

    asyncio.run(run())
    note = asyncio.run(mock_db.notifications.find_one({"title": {"$regex": "Urgent message from Nadia"}}))
    assert note and "crown" in note["body"]


def test_call_stream_uses_realtime_and_refuses_unknown_calls(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    socket = FakeOpenAI()
    socket.preload({"type": "response.output_audio.delta", "item_id": "item_g", "delta": "//79/A=="})

    async def fake_open():
        return socket

    monkeypatch.setattr(realtime, "open_openai_socket", fake_open)

    with client.websocket_connect("/api/v1/calls/stream/unknown-call") as websocket:
        closed = websocket.receive()
    assert closed["type"] == "websocket.close" and closed["code"] == 1008

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "CArt", "user_id": "guest", "direction": "inbound", "from_number": "+15551230000"}))
    with client.websocket_connect("/api/v1/calls/stream/CArt") as websocket:
        websocket.send_json({"event": "connected"})
        websocket.send_json({"event": "start", "stream_id": "MZrt"})
        first = websocket.receive_json()
    assert first == {"event": "media", "media": {"payload": "//79/A=="}}
    assert socket.of_type("session.update") and socket.of_type("response.create")


def test_test_ai_preview_uses_the_receptionist_in_dry_run(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "rt-sim@example.com")
    monkeypatch.setattr(CalendarService, "_now", staticmethod(lambda tz: datetime(2026, 8, 17, 7, 0, tzinfo=tz)))
    asyncio.run(mock_db.organizations.insert_one({"organization_id": owner_id, "business_name": "Bright Dental", "ai_call_settings": {}}))
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    script = iter([
        {"role": "assistant", "tool_calls": [{"id": "t1", "type": "function", "function": {"name": "book_appointment", "arguments": json.dumps({"date": "2026-08-18", "time": "10:00", "first_name": "Nadia"})}}]},
        {"role": "assistant", "content": "You're booked for Tuesday at 10 AM."},
    ])

    async def fake_chat(self, messages, tools):
        return next(script)

    monkeypatch.setattr(RealtimeReceptionist, "_chat", fake_chat)

    started = client.post("/api/v1/smartflow/ai-call-settings/test/start", headers=headers)
    assert started.status_code == 200, started.text
    session_id = started.json()["data"]["session_id"]
    reply = client.post(f"/api/v1/smartflow/ai-call-settings/test/{session_id}/message", headers=headers, json={"message": "Book me Tuesday at 10"})
    assert reply.status_code == 200, reply.text
    assert reply.json()["data"]["reply"] == "You're booked for Tuesday at 10 AM."
    assert asyncio.run(mock_db.calendar_events.count_documents({})) == 0  # a preview never books
    assert asyncio.run(mock_db.messages.count_documents({})) == 0


def test_outbound_call_briefs_the_ai_with_its_purpose(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-outbound@example.com")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        agent.is_outbound = True
        agent.call_log = {"purpose": "appointment_reminder", "script_notes": "Remind them to bring their X-rays."}
        await agent.connect()

    asyncio.run(run())
    instructions = socket.of_type("session.update")[0]["session"]["instructions"]
    assert "OUTBOUND CALL" in instructions and "appointment reminder" in instructions
    assert "Remind them to bring their X-rays." in instructions


def test_a_rejected_session_falls_back_instead_of_running_unconfigured(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-reject@example.com")
    socket = FakeOpenAI()
    socket.reject_session = True

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        assert await agent.connect() is False
        assert agent.openai is None

    asyncio.run(run())
    assert socket.closed


def test_call_stream_answers_with_the_classic_agent_when_realtime_is_rejected(client, mock_db, monkeypatch):
    from app.tests.test_ai_call_reliability import install_fake_streaming_tts

    install_fake_streaming_tts(monkeypatch)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    socket = FakeOpenAI()
    socket.reject_session = True

    async def fake_open():
        return socket

    monkeypatch.setattr(realtime, "open_openai_socket", fake_open)
    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "CAfallback", "user_id": "guest", "direction": "inbound"}))

    with client.websocket_connect("/api/v1/calls/stream/CAfallback") as websocket:
        websocket.send_json({"event": "connected"})
        websocket.send_json({"event": "start", "stream_id": "MZfb"})
        first = websocket.receive_json()

    assert first["event"] == "media" and first["media"]["payload"]  # the classic greeting still plays
    assert not socket.of_type("response.create")  # the rejected Realtime session was never used
