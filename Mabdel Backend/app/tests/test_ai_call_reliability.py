from __future__ import annotations

import asyncio
import base64
import io
import wave

from app.services.ai_phone_agent import (
    MAX_CONSECUTIVE_FAILURES,
    AIPhoneAgent,
    is_outbound_call,
    other_party_number,
)
from app.services.call_phrases import phrase
from app.services.call_service import CallService
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow_service import SmartFlowService


def _make_agent(flow_service: SmartFlowService) -> AIPhoneAgent:
    agent = AIPhoneAgent("call_reliability_1", GoCustifyAIService(), flow_service)
    agent.user_id = "guest"
    return agent


def _short_wav_base64(num_samples: int = 3000) -> str:
    """A minimal 24kHz mono 16-bit silent WAV, matching what OpenAI TTS returns —
    enough samples that stream_audio_to_telnyx produces multiple 160-byte chunks."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(24000)
        wav_file.writeframes(b"\x00\x00" * num_samples)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── Recording disclosure ─────────────────────────────────────────────────


def test_greeting_includes_recording_disclosure(mock_db, monkeypatch):
    captured_texts: list[str] = []

    async def fake_synthesize(self, text, voice_id=None):
        captured_texts.append(text)
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)
        agent.stream_sid = "MZ_test"  # set by the "start" event before a real greet() call
        sent: list[dict] = []

        async def send_callback(message):
            sent.append(message)

        await agent.greet(send_callback)
        return sent

    sent = asyncio.run(_run())
    assert captured_texts, "synthesize_speech should have been called for the greeting"
    disclosure = phrase("recording_disclosure", "en")
    assert disclosure in captured_texts[0]
    assert sent, "greeting audio should have been streamed to Telnyx"


def test_recording_disclosure_is_spoken_right_after_naming_the_business(mock_db, monkeypatch):
    """Client requirement: the disclosure must land immediately after the business is
    introduced — not before it (caller hears "will be recorded" before even knowing
    who they've reached) and not after the whole pitch (reads like an afterthought
    tacked onto the end, after the "how can I help you" question)."""
    captured_texts: list[str] = []

    async def fake_synthesize(self, text, voice_id=None):
        captured_texts.append(text)
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def fake_get_business_name(self):
        return "Apex Dental"

    monkeypatch.setattr(AIPhoneAgent, "_get_business_name", fake_get_business_name)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)
        agent.stream_sid = "MZ_test"

        async def send_callback(_message):
            return None

        await agent.greet(send_callback)

    asyncio.run(_run())

    greeting = captured_texts[0]
    business_index = greeting.index("Apex Dental")
    disclosure_index = greeting.index(phrase("recording_disclosure", "en"))
    pitch_index = greeting.index("How can I help you today?")

    assert business_index < disclosure_index < pitch_index, (
        f"expected business name, then disclosure, then pitch — got: {greeting!r}"
    )


# ── Dead-air failsafe ────────────────────────────────────────────────────


def test_speak_retries_once_before_giving_up(mock_db, monkeypatch):
    call_count = 0

    async def fake_synthesize(self, text, voice_id=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {"audio_base64": None, "status": "generation_failed"}
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)

        async def send_callback(message):
            pass

        ok = await agent._speak("hello there", send_callback)
        return ok, agent.consecutive_failures, agent.should_hangup

    ok, failures, should_hangup = asyncio.run(_run())
    assert call_count == 2  # first attempt failed, retry succeeded
    assert ok is True
    assert failures == 0
    assert should_hangup is False


def test_repeated_tts_failure_triggers_apology_and_hangup(mock_db, monkeypatch):
    async def fake_synthesize(self, text, voice_id=None):
        return {"audio_base64": None, "status": "generation_failed"}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)

        async def send_callback(message):
            pass

        results = []
        for _ in range(MAX_CONSECUTIVE_FAILURES):
            results.append(await agent._speak("hello there", send_callback))
        return results, agent.consecutive_failures, agent.should_hangup

    results, failures, should_hangup = asyncio.run(_run())
    assert all(result is False for result in results)
    assert failures == MAX_CONSECUTIVE_FAILURES
    assert should_hangup is True


def test_repeated_transcription_failure_triggers_hangup(mock_db, monkeypatch):
    def fake_transcribe(self, audio_base64, audio_mime_type, audio_filename):
        return None, None, "connection to OpenAI failed"

    async def fake_synthesize(self, text, voice_id=None):
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "_transcribe_with_language", fake_transcribe)
    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)

        async def send_callback(message):
            pass

        for _ in range(MAX_CONSECUTIVE_FAILURES):
            agent.audio_buffer.extend(b"\xff" * 8000)  # fake mu-law audio to process
            await agent.process_and_respond(send_callback)
        return agent.consecutive_failures, agent.should_hangup

    failures, should_hangup = asyncio.run(_run())
    assert failures == MAX_CONSECUTIVE_FAILURES
    assert should_hangup is True


def test_transient_no_speech_does_not_count_as_failure(mock_db, monkeypatch):
    """A silent/empty transcript (nobody spoke) is not a pipeline failure and must
    not count toward the dead-air failsafe."""

    def fake_transcribe(self, audio_base64, audio_mime_type, audio_filename):
        return None, None, "OpenAI returned an empty transcript."

    monkeypatch.setattr(GoCustifyAIService, "_transcribe_with_language", fake_transcribe)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)

        async def send_callback(message):
            pass

        for _ in range(MAX_CONSECUTIVE_FAILURES + 2):
            agent.audio_buffer.extend(b"\xff" * 8000)
            await agent.process_and_respond(send_callback)
        return agent.consecutive_failures, agent.should_hangup

    failures, should_hangup = asyncio.run(_run())
    assert failures == 0
    assert should_hangup is False


# ── Barge-in ──────────────────────────────────────────────────────────────


def test_stream_audio_stops_early_on_barge_in(mock_db, monkeypatch):
    async def fake_synthesize(self, text, voice_id=None):
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)
        agent.stream_sid = "MZ_test"
        sent_chunks: list[dict] = []

        async def send_callback(message):
            sent_chunks.append(message)
            if len(sent_chunks) == 1:
                # Simulate calls.py detecting a real caller interruption mid-speech.
                agent.barge_in_triggered = True

        audio_b64 = _short_wav_base64(num_samples=6000)  # enough for several 20ms chunks
        agent.audio_buffer.extend(b"leftover-caller-speech")
        await agent.stream_audio_to_telnyx(audio_b64, send_callback)
        return sent_chunks, agent.is_speaking, agent.barge_in_triggered, bytes(agent.audio_buffer)

    sent_chunks, is_speaking, barge_in_triggered, remaining_buffer = asyncio.run(_run())
    assert len(sent_chunks) == 1  # stopped after the interrupt instead of streaming the full reply
    assert is_speaking is False
    assert barge_in_triggered is False  # reset after being consumed
    assert remaining_buffer == b"leftover-caller-speech"  # caller's interrupt speech was preserved, not wiped


def test_stream_audio_clears_buffer_when_no_barge_in(mock_db, monkeypatch):
    async def fake_synthesize(self, text, voice_id=None):
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)
        agent.stream_sid = "MZ_test"
        agent.audio_buffer.extend(b"stale-echo-noise")

        async def send_callback(message):
            pass

        audio_b64 = _short_wav_base64()
        await agent.stream_audio_to_telnyx(audio_b64, send_callback)
        return bytes(agent.audio_buffer)

    remaining_buffer = asyncio.run(_run())
    assert remaining_buffer == b""  # normal completion still clears any buffered echo/noise


# ── Call recording ────────────────────────────────────────────────────────


def _fake_telnyx_client(monkeypatch, recorded_calls: dict):
    class FakeActions:
        def answer(self, call_control_id, **kwargs):
            recorded_calls.setdefault("answer", []).append((call_control_id, kwargs))

        def start_streaming(self, call_control_id, **kwargs):
            recorded_calls.setdefault("start_streaming", []).append((call_control_id, kwargs))

        def start_recording(self, call_control_id, **kwargs):
            recorded_calls.setdefault("start_recording", []).append((call_control_id, kwargs))

    class FakeCalls:
        actions = FakeActions()

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.calls = FakeCalls()

    import app.services.call_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeClient, "TelnyxError": Exception}))
    monkeypatch.setattr(module.settings, "TELNYX_API_KEY", "test-key")


def test_answering_into_ai_stream_starts_recording(monkeypatch):
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)
    call_service = CallService()

    asyncio.run(call_service.answer_call("v2:rec-test", websocket_url="wss://example.test/stream"))

    assert len(recorded_calls.get("answer", [])) == 1
    assert len(recorded_calls.get("start_recording", [])) == 1
    call_control_id, kwargs = recorded_calls["start_recording"][0]
    assert call_control_id == "v2:rec-test"
    assert kwargs == {"channels": "single", "format": "mp3"}


def test_answering_without_ai_stream_does_not_start_recording(monkeypatch):
    """Calls handed off to a human in the browser (no websocket_url) aren't recorded —
    only AI-handled calls, which is what the recording+transcript pipeline is for."""
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)
    call_service = CallService()

    asyncio.run(call_service.answer_call("v2:no-rec-test", websocket_url=None))

    assert len(recorded_calls.get("answer", [])) == 1
    assert "start_recording" not in recorded_calls


def test_start_streaming_starts_recording(monkeypatch):
    """Covers the outbound-AI-call and transfer-to-AI paths, which join the AI via
    start_streaming rather than answer_call."""
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)
    call_service = CallService()

    result = asyncio.run(call_service.start_streaming("v2:outbound-rec-test", websocket_url="wss://example.test/stream"))

    assert result is True
    assert len(recorded_calls.get("start_streaming", [])) == 1
    assert len(recorded_calls.get("start_recording", [])) == 1
    call_control_id, kwargs = recorded_calls["start_recording"][0]
    assert call_control_id == "v2:outbound-rec-test"
    assert kwargs == {"channels": "single", "format": "mp3"}


# ── Bidirectional audio playback ─────────────────────────────────────────
# The AI was inaudible on every call because these parameters were wrong. The fakes
# above take **kwargs, so they happily accept arguments the real SDK rejects — these
# tests check the arguments against the real Telnyx signatures instead.


def _real_param_names(method) -> set[str]:
    import inspect

    from telnyx.resources.calls.actions import ActionsResource

    return set(inspect.signature(getattr(ActionsResource, method)).parameters)


def test_answer_into_ai_stream_targets_the_callers_own_leg(monkeypatch):
    """stream_bidirectional_target_legs defaults to "opposite" — the far side of a
    bridged call. An AI call is a single unbridged leg, so the default sends every AI
    audio frame to a leg that does not exist and the caller hears pure silence."""
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)

    asyncio.run(CallService().answer_call("v2:legs-test", websocket_url="wss://example.test/stream"))

    _, kwargs = recorded_calls["answer"][0]
    assert kwargs["stream_bidirectional_target_legs"] == "self"
    assert kwargs["stream_bidirectional_mode"] == "rtp"
    assert kwargs["stream_bidirectional_codec"] == "PCMU"


def test_start_streaming_targets_the_callers_own_leg(monkeypatch):
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)

    asyncio.run(CallService().start_streaming("v2:legs-test-2", websocket_url="wss://example.test/stream"))

    _, kwargs = recorded_calls["start_streaming"][0]
    assert kwargs["stream_bidirectional_target_legs"] == "self"
    assert kwargs["stream_bidirectional_mode"] == "rtp"
    assert kwargs["stream_bidirectional_codec"] == "PCMU"


def test_streaming_arguments_are_accepted_by_the_real_telnyx_sdk(monkeypatch):
    """send_silence_when_idle is answer-only. Passing it to start_streaming raised
    TypeError — not TelnyxError — so it escaped the handler and the outbound AI call
    never reached Telnyx at all."""
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)
    call_service = CallService()

    asyncio.run(call_service.answer_call("v2:sig-1", websocket_url="wss://example.test/stream"))
    asyncio.run(call_service.start_streaming("v2:sig-2", websocket_url="wss://example.test/stream"))

    for action, method in (("answer", "answer"), ("start_streaming", "start_streaming")):
        _, kwargs = recorded_calls[action][0]
        unsupported = set(kwargs) - _real_param_names(method)
        assert not unsupported, f"{action}() passed arguments the Telnyx SDK rejects: {sorted(unsupported)}"


def test_start_streaming_survives_an_unsupported_argument(monkeypatch):
    """A bad parameter raises TypeError, which must be contained: previously it
    propagated out and took the whole webhook handler down with it."""
    recorded_calls: dict = {}
    _fake_telnyx_client(monkeypatch, recorded_calls)

    import app.services.call_service as module

    def exploding_start_streaming(call_control_id, **kwargs):
        raise TypeError("got an unexpected keyword argument 'send_silence_when_idle'")

    monkeypatch.setattr(module.telnyx.Client().calls.actions, "start_streaming", exploding_start_streaming)

    assert asyncio.run(CallService().start_streaming("v2:boom", websocket_url="wss://example.test/s")) is False


# ── Outbound calls ("Make AI Call") ──────────────────────────────────────
# An outbound call inverts from_number/phone_number and the greeting. Reading them
# the inbound way stamps meeting requests with the business's own number and makes
# the AI thank the person for a call they never placed.


def test_other_party_is_the_dialled_number_on_outbound_calls():
    inbound = {"direction": "inbound", "from_number": "+15551110000", "phone_number": "+15559990000"}
    assert other_party_number(inbound) == "+15551110000"

    # Placed via /smartflow/calls/outbound: carries call_type, no direction field.
    outbound = {"call_type": "outbound", "from_number": "+15559990000", "phone_number": "+15551110000"}
    assert is_outbound_call(outbound) is True
    assert other_party_number(outbound) == "+15551110000", "must not hand back the business's own number"

    browser_outbound = {"call_type": "outgoing_direct", "from_number": "+15559990000", "phone_number": "+15551110000"}
    assert other_party_number(browser_outbound) == "+15551110000"


def test_outbound_greeting_does_not_thank_them_for_calling(mock_db, monkeypatch):
    spoken: list[str] = []

    async def fake_synthesize(self, text, voice_id=None):
        spoken.append(text)
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run(is_outbound: bool) -> str:
        agent = _make_agent(SmartFlowService(mock_db))
        agent.stream_sid = "MZ_test"
        agent.is_outbound = is_outbound
        await agent.greet(lambda _message: asyncio.sleep(0))
        return spoken[-1]

    inbound_greeting = asyncio.run(_run(False))
    outbound_greeting = asyncio.run(_run(True))

    assert "calling" in inbound_greeting.lower()
    assert "thanks for calling" not in outbound_greeting.lower(), (
        f"outbound AI call thanked the person for calling us: {outbound_greeting!r}"
    )
    assert outbound_greeting != inbound_greeting


def test_media_stream_url_escapes_call_ids_containing_a_slash(monkeypatch):
    """A call_control_id is base64 after "v2:", so it can contain "/" — interpolated
    raw it splits the URL path and the websocket route stops matching."""
    import app.services.call_service as module

    monkeypatch.setattr(module.settings, "PUBLIC_BACKEND_URL", "https://api.example.test")

    prefix = "wss://api.example.test/api/v1/calls/stream/"
    url = CallService().build_media_stream_url("v2:abc/def+ghi==")

    assert url.startswith(prefix)
    assert "/" not in url[len(prefix):], "call id must occupy exactly one path segment"
