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

        await _greeting_done(socket)
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
        await _greeting_done(socket)
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


async def _greeting_done(socket, response_id="resp_greet"):
    """The greeting is its own response: the server announces it, then finishes it."""
    await socket.emit({"type": "response.created", "response": {"id": response_id}})
    await socket.emit({"type": "response.done", "response": {"id": response_id, "output": []}})


def _pcmu_delta(milliseconds: int) -> str:
    import base64

    return base64.b64encode(b"\xff" * (milliseconds * 8)).decode()


async def _noop():
    return None


def test_transfer_waits_for_the_announcement_then_connects(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-transfer@example.com", transfer_number="+15550001111")
    socket = FakeOpenAI()
    control = FakeCallControl()
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0.05)
    sent: list[dict] = []

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()

        async def to_telnyx(message):
            sent.append(message)

        await agent.start(to_telnyx)
        await _greeting_done(socket)
        # "One moment, I'll connect you" - 400 ms of audio already queued at Telnyx.
        await socket.emit({"type": "response.output_audio.delta", "item_id": "item_t", "delta": _pcmu_delta(400)})

        result = await agent.run_tool("transfer_to_human", json.dumps({"reason": "wants the dentist"}))
        assert result == {"transferred": True}
        assert control.transfers == []  # not yet - the announcement is still playing
        assert {"event": "clear"} not in sent  # and it is never cut off
        await agent.on_caller_audio("aGVsbG8=")
        assert not socket.of_type("input_audio_buffer.append")  # the call is with a person now

        await asyncio.sleep(0.6)
        assert control.transfers == [("call-rt", "+15550001111")]
        await agent.close()

    asyncio.run(run())


def test_a_failed_transfer_is_explained_and_the_call_carries_on(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-transfer-fail@example.com", transfer_number="+15550001111")
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def refuse(call_id, *, to_number):
        return False

    control.transfer_call = refuse
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await agent.run_tool("transfer_to_human", "{}")
        await _until(lambda: any("transfer did not go through" in (e.get("response") or {}).get("instructions", "") for e in socket.of_type("response.create")))
        assert agent.transferring is False
        await agent.close()

    asyncio.run(run())


def test_goodbye_said_once_then_hang_up_after_it_plays(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-end@example.com")
    socket = FakeOpenAI()
    control = FakeCallControl()
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0.05)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        creates_before = len(socket.of_type("response.create"))

        # The model says goodbye (300 ms of audio) and calls end_call in the same turn.
        await socket.emit({"type": "response.output_audio.delta", "item_id": "item_bye", "delta": _pcmu_delta(300)})
        await socket.emit({"type": "response.done", "response": {"id": "r_bye", "output": [{"type": "function_call", "name": "end_call", "call_id": "c9", "arguments": "{}"}]}})
        await _until(lambda: len(socket.of_type("conversation.item.create")) == 1)
        await asyncio.sleep(0.05)
        assert len(socket.of_type("response.create")) == creates_before  # no second goodbye
        assert control.hung_up == []  # the goodbye is still playing

        await asyncio.sleep(0.5)
        assert control.hung_up == ["call-rt"]
        await agent.close()

    asyncio.run(run())


def test_end_call_without_a_spoken_goodbye_asks_for_one_first(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-end2@example.com")
    socket = FakeOpenAI()
    control = FakeCallControl()
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "response.done", "response": {"id": "r1", "output": [{"type": "function_call", "name": "end_call", "call_id": "c1", "arguments": "{}"}]}})
        await _until(lambda: any("goodbye" in (e.get("response") or {}).get("instructions", "") for e in socket.of_type("response.create")))
        assert control.hung_up == []
        await socket.emit({"type": "response.done", "response": {"id": "r2", "output": []}})
        await _until(lambda: control.hung_up == ["call-rt"])
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


def test_a_caller_speaking_during_a_tool_call_does_not_collide_with_the_reply(client, mock_db, monkeypatch):
    """The real API rejects a second response.create while one is running (verified)."""
    owner_id = _business(client, mock_db, monkeypatch, "rt-race@example.com")
    socket = FakeOpenAI()

    async def run():
        gate = asyncio.Event()
        agent = _receptionist(mock_db, owner_id, socket)

        async def slow_tool(**_):
            await gate.wait()
            return {"slots": []}

        agent._tool_check_availability = slow_tool
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        creates = len(socket.of_type("response.create"))

        await socket.emit({"type": "response.done", "response": {"id": "r1", "output": [{"type": "function_call", "name": "check_availability", "call_id": "c1", "arguments": "{}"}]}})
        await socket.emit({"type": "response.created", "response": {"id": "r_vad"}})  # the caller spoke; the server started a reply
        gate.set()
        await _until(lambda: len(socket.of_type("conversation.item.create")) == 1)
        await asyncio.sleep(0.05)
        assert len(socket.of_type("response.create")) == creates  # held back while that reply runs

        await socket.emit({"type": "response.done", "response": {"id": "r_vad", "output": []}})
        await _until(lambda: len(socket.of_type("response.create")) == creates + 1)  # then the tool result is answered
        await agent.close()

    asyncio.run(run())


def test_a_rejected_overlap_is_retried_when_the_running_reply_ends(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-overlap@example.com")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await agent._request_response()
        creates = len(socket.of_type("response.create"))
        await socket.emit({"type": "error", "error": {"code": "conversation_already_has_active_response", "message": "busy"}})
        await socket.emit({"type": "response.done", "response": {"id": "r_other", "output": []}})
        await _until(lambda: len(socket.of_type("response.create")) == creates + 1)
        await agent.close()

    asyncio.run(run())


def test_a_language_switch_greeting_waits_for_the_cancelled_reply(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-lang-switch@example.com")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "response.created", "response": {"id": "r_answer"}})  # mid-answer when they press 2
        creates = len(socket.of_type("response.create"))

        agent.language = "es"  # what set_language_from_digit does on a keypad press
        await agent.acknowledge_language_switch()
        assert socket.of_type("response.cancel")
        assert len(socket.of_type("response.create")) == creates  # not sent into a running reply
        assert agent.greeting_in_progress is True

        await socket.emit({"type": "response.done", "response": {"id": "r_answer", "output": []}})  # the cancelled reply ends
        await _until(lambda: len(socket.of_type("response.create")) == creates + 1)
        assert agent.greeting_in_progress is True  # the cancelled reply did not end the protected greeting
        await agent.on_caller_audio("aGVsbG8=")
        assert not socket.of_type("input_audio_buffer.append")

        await _greeting_done(socket, "resp_greet_es")
        assert agent.greeting_in_progress is False
        await agent.close()

    asyncio.run(run())


def test_a_greeting_that_never_finishes_does_not_mute_the_caller(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-greet-stuck@example.com")
    socket = FakeOpenAI()
    monkeypatch.setattr(realtime, "GREETING_MAX_SECONDS", 0.05)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await agent.on_caller_audio("aGVsbG8=")
        assert not socket.of_type("input_audio_buffer.append")
        await asyncio.sleep(0.1)
        await agent.on_caller_audio("aGVsbG8=")
        assert socket.of_type("input_audio_buffer.append")
        await agent.close()

    asyncio.run(run())


def test_the_confirmation_text_uses_the_language_the_caller_spoke(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-language@example.com")
    socket = FakeOpenAI()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        booked = await agent.run_tool("book_appointment", json.dumps({"date": "2026-08-18", "time": "10:00", "first_name": "Nadia", "language": "es"}))
        assert booked["outcome"] == "booked" and agent.language == "es"
        cancelled = await agent.run_tool("cancel_appointment", json.dumps({"appointment_id": booked["appointment_id"], "language": "fr"}))
        assert cancelled["outcome"] == "cancelled"

    asyncio.run(run())
    texts = [m["content"] for m in asyncio.run(mock_db.messages.find({"platform": "sms", "automated": True}).sort("timestamp", 1).to_list(None))]
    assert "tu cita está confirmada" in texts[0]
    assert "est annulé" in texts[1]


def test_the_ai_cannot_book_a_date_that_has_already_passed(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-past@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        past = await agent.run_tool("book_appointment", json.dumps({"date": "2026-08-10", "time": "10:00", "first_name": "Nadia"}))
        assert past["outcome"] == "unavailable" and "already passed" in past["reason"]
        far = await agent.run_tool("book_appointment", json.dumps({"date": "2027-08-18", "time": "10:00", "first_name": "Nadia"}))
        assert far["outcome"] == "unavailable" and "too far" in far["reason"]
        ok = await agent.run_tool("book_appointment", json.dumps({"date": "2026-08-17", "time": "10:00", "first_name": "Nadia"}))
        assert ok["outcome"] == "booked"  # today, later on, is fine

    asyncio.run(run())
    assert asyncio.run(mock_db.calendar_events.count_documents({})) == 1


def test_a_call_that_runs_past_the_time_limit_is_ended_politely(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-limit@example.com")
    socket = FakeOpenAI()
    control = FakeCallControl()
    monkeypatch.setattr(realtime, "WATCH_INTERVAL_SECONDS", 0.02)
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0)
    monkeypatch.setattr(realtime, "HARD_STOP_GRACE_SECONDS", 0.05)
    monkeypatch.setattr(settings, "AI_CALL_MAX_SECONDS", 0)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await _until(lambda: any("time limit" in (e.get("response") or {}).get("instructions", "") for e in socket.of_type("response.create")))
        await _until(lambda: control.hung_up == ["call-rt"])  # hard stop even if the goodbye never plays
        await agent.close()

    asyncio.run(run())


def test_a_caller_who_goes_quiet_is_asked_once_then_the_call_ends(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-idle@example.com")
    socket = FakeOpenAI()
    control = FakeCallControl()
    monkeypatch.setattr(realtime, "WATCH_INTERVAL_SECONDS", 0.02)
    monkeypatch.setattr(realtime, "HANGUP_AFTER_GOODBYE_PAD_SECONDS", 0)
    monkeypatch.setattr(settings, "AI_CALL_IDLE_PROMPT_SECONDS", 0.05)
    monkeypatch.setattr(settings, "AI_CALL_IDLE_HANGUP_SECONDS", 0.15)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await _until(lambda: any("gone quiet" in (e.get("response") or {}).get("instructions", "") for e in socket.of_type("response.create")))
        await socket.emit({"type": "response.done", "response": {"id": "r_ask", "output": []}})  # the question was asked; silence again
        await _until(lambda: any("cannot hear the caller" in (e.get("response") or {}).get("instructions", "") for e in socket.of_type("response.create")))
        await socket.emit({"type": "response.done", "response": {"id": "r_bye", "output": []}})
        await _until(lambda: control.hung_up == ["call-rt"])
        await agent.close()

    asyncio.run(run())


def test_speech_resets_the_quiet_timer(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "rt-idle2@example.com")
    socket = FakeOpenAI()
    monkeypatch.setattr(realtime, "WATCH_INTERVAL_SECONDS", 0.02)
    monkeypatch.setattr(settings, "AI_CALL_IDLE_PROMPT_SECONDS", 0.2)

    async def run():
        agent = _receptionist(mock_db, owner_id, socket)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        for _ in range(6):  # the caller keeps talking, so nobody is "still there?"-ed
            await asyncio.sleep(0.06)
            await socket.emit({"type": "input_audio_buffer.speech_started"})
        assert not any("gone quiet" in (e.get("response") or {}).get("instructions", "") for e in socket.of_type("response.create"))
        await agent.close()

    asyncio.run(run())


def test_noise_reduction_is_on_for_phone_handsets():
    assert realtime.audio_session_config("coral")["input"]["noise_reduction"] == {"type": "near_field"}
