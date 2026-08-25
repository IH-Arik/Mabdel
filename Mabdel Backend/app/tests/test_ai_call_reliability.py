from __future__ import annotations

import asyncio
import base64
import io
import wave

from app.services.ai_phone_agent import (
    MAX_CONSECUTIVE_FAILURES,
    MU_LAW_SILENCE,
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


def install_fake_streaming_tts(monkeypatch, *, on_call=None, num_samples: int = 3000) -> None:
    """Patches GoCustifyAIService.synthesize_speech_stream, the path AIPhoneAgent._speak
    actually uses now (greet/offer_language_menu/replies all stream audio instead of
    calling the old blocking synthesize_speech, which only the rare apology/hangup
    fallback still uses). Without this, those tests would fall through to the real
    OpenAI streaming TTS call and hang/hit the network.

    `on_call(text, voice_id)`, if given, runs on every invocation — for tests that
    need to inspect what was spoken or which voice was requested.
    """
    pcm = b"\x00\x00" * num_samples  # raw 24kHz 16-bit silence, no WAV header

    async def fake_stream(self, text, voice_id=None):
        if on_call:
            on_call(text, voice_id)
        yield pcm

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech_stream", fake_stream)


def install_failing_streaming_tts(monkeypatch) -> None:
    """Patches synthesize_speech_stream to produce no audio at all — simulates the
    same total-failure case the old code represented as audio_base64=None."""

    async def fake_stream(self, text, voice_id=None):
        return
        yield  # pragma: no cover - makes this an async generator

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech_stream", fake_stream)


# ── Recording disclosure ─────────────────────────────────────────────────


def test_greeting_includes_recording_disclosure(mock_db, monkeypatch):
    captured_texts: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: captured_texts.append(text))

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
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: captured_texts.append(text))

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

    async def fake_stream(self, text, voice_id=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return  # first attempt: no audio at all
        yield b"\x00\x00" * 3000  # retry succeeds

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech_stream", fake_stream)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)
        agent.stream_sid = "MZ_test"  # set by the "start" event before a real call reaches _speak

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
    install_failing_streaming_tts(monkeypatch)  # the main _speak path always fails

    async def fake_synthesize(self, text, voice_id=None):
        # The apology-on-hangup fallback still uses the old blocking synthesize_speech
        # (rare enough that latency doesn't matter there) — also failing here confirms
        # a broken TTS pipeline is handled gracefully rather than raising.
        return {"audio_base64": None, "status": "generation_failed"}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    async def _run():
        flow_service = SmartFlowService(mock_db)
        agent = _make_agent(flow_service)
        agent.stream_sid = "MZ_test"

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
    async def fake_transcribe(self, audio_base64, audio_mime_type, audio_filename):
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

    async def fake_transcribe(self, audio_base64, audio_mime_type, audio_filename):
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
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

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


# ── Response latency ───────────────────────────────────────────────────────
# ~5s of dead air per turn was reported. Two independent fixes: (1) Whisper
# transcription was called without `await` -- a genuinely synchronous, blocking SDK
# call sitting directly in the event loop, stalling every other concurrent call and
# API request for its full duration; and (2) TTS waited for OpenAI's entire audio
# clip before sending a single byte to the caller. These tests cover both.


def test_transcribe_with_language_does_not_block_the_event_loop(mock_db, monkeypatch):
    """The bug: _transcribe_with_language was called without await in
    process_and_respond, even though the underlying OpenAI call is synchronous I/O.
    Proven here the same way synthesize_speech's existing to_thread wrapping would
    be proven: a slow "network" call inside the sync half must not block a
    concurrently-running coroutine on the same event loop."""
    import time

    def slow_sync_call(*args, **kwargs):
        time.sleep(0.3)
        return "transcript", "english", None

    monkeypatch.setattr(
        GoCustifyAIService, "_transcribe_with_language_sync",
        lambda self, *a, **kw: slow_sync_call(*a, **kw),
    )

    async def _run():
        service = GoCustifyAIService()
        other_ran_at = []

        async def other_coroutine():
            other_ran_at.append(asyncio.get_event_loop().time())

        start = asyncio.get_event_loop().time()
        await asyncio.gather(
            service._transcribe_with_language("", "audio/wav", "x.wav"),
            other_coroutine(),
        )
        return other_ran_at[0] - start

    other_coroutine_delay = asyncio.run(_run())
    assert other_coroutine_delay < 0.1, (
        f"a concurrent coroutine was blocked for {other_coroutine_delay:.3f}s by the "
        "transcription call -- it is not actually running off the event loop thread"
    )


def test_transcribe_with_language_still_returns_the_real_result(mock_db, monkeypatch):
    monkeypatch.setattr(
        GoCustifyAIService, "_transcribe_with_language_sync",
        lambda self, *a, **kw: ("hello there", "english", None),
    )
    service = GoCustifyAIService()
    result = asyncio.run(service._transcribe_with_language("", "audio/wav", "x.wav"))
    assert result == ("hello there", "english", None)


def _pcm_from_wav_base64(wav_b64: str) -> bytes:
    audio_bytes = base64.b64decode(wav_b64)
    with io.BytesIO(audio_bytes) as buf:
        with wave.open(buf, "rb") as wav_file:
            return wav_file.readframes(wav_file.getnframes())


def test_streamed_audio_matches_the_old_blocking_path_byte_for_byte(mock_db):
    """The streaming pipeline (24kHz PCM -> 8kHz downsample -> mu-law -> 20ms frames,
    fed incrementally as network chunks arrive) has to produce identical audio to the
    old all-at-once path -- it must only change *when* bytes reach Telnyx, not *what*
    bytes. Chunks are deliberately irregular (not aligned to the 6-byte downsample
    group or the 160-byte frame size) since that boundary-crossing is exactly where a
    streaming rewrite tends to introduce off-by-one bugs. Samples are a non-silent
    ramp (not all-zero) so a dropped tail byte is distinguishable from the trailing
    silence padding -- silent PCM would let that bug pass undetected."""
    from app.utils.audio import pcm_to_mulaw

    num_samples = 6001  # deliberately not a multiple of 3
    pcm_builder = bytearray()
    for i in range(num_samples):
        pcm_builder.extend(((i * 37) % 65536).to_bytes(2, "little", signed=False))
    pcm = bytes(pcm_builder)

    downsampled = bytearray()
    for i in range(0, len(pcm), 6):
        downsampled.extend(pcm[i:i + 2])
    expected_mulaw = pcm_to_mulaw(bytes(downsampled))

    chunks, i, sizes = [], 0, [7, 500, 1, 200, 6, 333]
    while i < len(pcm):
        size = sizes[len(chunks) % len(sizes)]
        chunks.append(pcm[i:i + size])
        i += size

    async def fake_stream(self, text, voice_id=None):
        for c in chunks:
            yield c

    async def _run():
        agent = _make_agent(SmartFlowService(mock_db))
        agent.stream_sid = "MZ_test"
        agent.ai_service.synthesize_speech_stream = fake_stream.__get__(agent.ai_service)
        sent = []

        async def send_callback(message):
            sent.append(base64.b64decode(message["media"]["payload"]))

        sent_any = await agent._stream_pcm_to_telnyx("hello", None, send_callback)
        return sent_any, sent

    sent_any, sent_frames = asyncio.run(_run())
    assert sent_any is True
    assert all(len(f) == 160 for f in sent_frames), "every outbound frame must be exactly 20ms/160 bytes"

    reconstructed = b"".join(sent_frames)
    core = reconstructed[:len(expected_mulaw)]
    assert core == expected_mulaw
    assert all(b == MU_LAW_SILENCE for b in reconstructed[len(expected_mulaw):])


def test_streaming_stops_immediately_on_barge_in(mock_db):
    """A caller interruption must cut playback within roughly one frame, not after
    the whole reply has already streamed out."""

    async def fake_stream(self, text, voice_id=None):
        yield b"\x00\x00" * 24000  # ~1 second of audio -> ~50 outbound frames

    async def _run():
        agent = _make_agent(SmartFlowService(mock_db))
        agent.stream_sid = "MZ_test"
        agent.ai_service.synthesize_speech_stream = fake_stream.__get__(agent.ai_service)
        sent = []

        async def send_callback(message):
            sent.append(message)
            if len(sent) == 3:
                agent.barge_in_triggered = True

        sent_any = await agent._stream_pcm_to_telnyx("hello", None, send_callback)
        return sent_any, sent, agent.is_speaking, agent.barge_in_triggered

    sent_any, sent, is_speaking, barge_in_after = asyncio.run(_run())
    assert sent_any is True
    assert len(sent) <= 4, f"expected playback to stop right after the interrupt, sent {len(sent)} frames"
    assert is_speaking is False
    assert barge_in_after is False


def test_streaming_with_no_audio_produced_returns_false(mock_db):
    """No OPENAI_API_KEY (or any other total failure) yields zero chunks -- _speak's
    retry logic depends on this coming back False rather than raising."""

    async def empty_stream(self, text, voice_id=None):
        return
        yield  # pragma: no cover - keeps this an async generator

    async def _run():
        agent = _make_agent(SmartFlowService(mock_db))
        agent.stream_sid = "MZ_test"
        agent.ai_service.synthesize_speech_stream = empty_stream.__get__(agent.ai_service)
        sent = []

        async def send_callback(message):
            sent.append(message)

        sent_any = await agent._stream_pcm_to_telnyx("hello", None, send_callback)
        return sent_any, sent

    sent_any, sent = asyncio.run(_run())
    assert sent_any is False
    assert sent == []


def test_streaming_without_a_stream_sid_never_calls_tts_at_all(mock_db):
    """If Telnyx's 'start' event hasn't arrived yet, there is nowhere to send audio --
    must fail fast rather than pay for a TTS call whose output can't be delivered."""
    tts_called = False

    async def fake_stream(self, text, voice_id=None):
        nonlocal tts_called
        tts_called = True
        yield b"\x00\x00"

    async def _run():
        agent = _make_agent(SmartFlowService(mock_db))
        agent.stream_sid = None  # 'start' event never arrived
        agent.ai_service.synthesize_speech_stream = fake_stream.__get__(agent.ai_service)

        async def send_callback(message):
            raise AssertionError("must never attempt to send without a stream_sid")

        return await agent._stream_pcm_to_telnyx("hello", None, send_callback)

    sent_any = asyncio.run(_run())
    assert sent_any is False
    assert tts_called is False
