from __future__ import annotations

import asyncio
import json

from app.services.realtime_receptionist import DEFAULT_EMERGENCY_KEYWORDS
from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _greeting_done, _receptionist, _until


def test_a_builtin_phrase_is_detected_case_insensitively(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-match@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    matched = asyncio.run(agent._matched_emergency_keyword("I think my dad is having a HEART ATTACK right now"))

    assert matched == "heart attack"


def test_ordinary_speech_matches_nothing(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-no-match@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    matched = asyncio.run(agent._matched_emergency_keyword("I'd like to book a cleaning for next Tuesday"))

    assert matched is None


def test_a_business_specific_keyword_is_also_detected(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-custom@example.com", emergency_keywords=["water leak"])
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    matched = asyncio.run(agent._matched_emergency_keyword("there's a water leak flooding the kitchen"))

    assert matched == "water leak"


def test_every_default_keyword_is_lowercase_so_matching_is_consistent():
    assert all(keyword == keyword.lower() for keyword in DEFAULT_EMERGENCY_KEYWORDS)


def test_a_live_call_hearing_an_emergency_phrase_notifies_the_team_and_transfers(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-live@example.com", transfer_number="+15559990000")
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({
            "type": "conversation.item.input_audio_transcription.completed",
            "transcript": "Help, I can't breathe!",
        })
        await _until(lambda: len(control.transfers) == 1)
        assert agent.emergency_escalated is True
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    notification = asyncio.run(mock_db.notifications.find_one({"user_id": owner_id, "type": "call"}))
    assert notification and "URGENT" in notification["title"]
    log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "call-rt"}))
    captured = [item for item in log["captured_requests"] if item.get("intent") == "emergency_escalation"]
    assert captured and captured[0]["matched_keyword"] == "can't breathe"


def test_escalation_only_fires_once_per_call_even_if_mentioned_twice(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-once@example.com", transfer_number="+15559990000")
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "there's a gas leak"})
        await _until(lambda: len(control.transfers) == 1)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "I still smell gas"})
        await asyncio.sleep(0.05)
        assert len(control.transfers) == 1  # not transferred a second time
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "call-rt"}))
    escalations = [item for item in log["captured_requests"] if item.get("intent") == "emergency_escalation"]
    assert len(escalations) == 1


def test_with_no_transfer_number_the_team_is_still_notified(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-no-transfer@example.com")
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "he's unconscious, please help"})
        await asyncio.sleep(0.1)
        assert control.transfers == []  # nothing to transfer to
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    notification = asyncio.run(mock_db.notifications.find_one({"user_id": owner_id, "type": "call"}))
    assert notification is not None


def test_an_emergency_texts_every_team_members_own_phone_by_default(client, mock_db, monkeypatch):
    from bson import ObjectId

    owner_id = _business(client, mock_db, monkeypatch, "emergency-sms-team@example.com")
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(owner_id)}, {"$set": {"phone_number": "+15557778888"}}))
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "there's a gas leak"})
        await _until(lambda: len(control.sms_sent) == 1)
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    [sms] = control.sms_sent
    assert sms["to_number"] == "+15557778888"
    assert "URGENT" in sms["message"] and "gas leak" in sms["message"].lower()
    assert sms["from_number"] == "+15550009999"  # the business's own Telnyx number


def test_an_emergency_alert_phone_overrides_the_per_member_default(client, mock_db, monkeypatch):
    from bson import ObjectId

    owner_id = _business(client, mock_db, monkeypatch, "emergency-sms-override@example.com", emergency_alert_phone="+15551112222")
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(owner_id)}, {"$set": {"phone_number": "+15557778888"}}))
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "there's a gas leak"})
        await _until(lambda: len(control.sms_sent) == 1)
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    [sms] = control.sms_sent
    assert sms["to_number"] == "+15551112222"  # the configured alert number, not the member's own phone


def test_a_team_member_with_no_phone_on_file_is_skipped_without_error(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-sms-no-phone@example.com")
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "there's a gas leak"})
        await asyncio.sleep(0.1)
        assert control.sms_sent == []  # nobody had a phone number on file - no crash either
        assert agent.emergency_escalated is True
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())


def test_direct_to_911_mode_speaks_the_911_instruction_instead_of_transferring(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "emergency-911-mode@example.com",
        transfer_number="+15559990000", emergency_response_mode="direct_to_911",
    )
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "chest pain, please help"})
        await _until(lambda: len(socket.of_type("response.create")) >= 1)
        await asyncio.sleep(0.1)
        assert control.transfers == []  # 911 mode never transfers
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    forced = [event for event in socket.of_type("response.create") if "911" in (event.get("response") or {}).get("instructions", "")]
    assert forced, "expected a response.create with 911 instructions"


def test_take_message_mode_is_the_default_and_still_transfers(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "emergency-default-mode@example.com", transfer_number="+15559990000")
    socket = FakeOpenAI()
    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, socket, control=control)
        await agent.connect()
        await agent.start(lambda message: _noop())
        await _greeting_done(socket)
        await socket.emit({"type": "conversation.item.input_audio_transcription.completed", "transcript": "chest pain"})
        await _until(lambda: len(control.transfers) == 1)
        await agent.close()

    asyncio.run(mock_db.call_logs.insert_one({"twilio_call_sid": "call-rt", "user_id": owner_id}))
    asyncio.run(run())

    assert control.transfers == [("call-rt", "+15559990000")]


async def _noop():
    return None
