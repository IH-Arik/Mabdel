from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, WebSocket
from fastapi.responses import JSONResponse
import asyncio
import time

from app.dependencies import get_current_user, get_mongo_database
from app.schemas.call import CallActionRequest
from app.services.call_service import CallService
from app.services.smartflow_service import SmartFlowService
from app.services.telnyx_web_voice_service import TelnyxWebVoiceService
from app.utils.responses import success_response
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.ai_phone_agent import AIPhoneAgent, is_outbound_call, other_party_number
from app.services.gocustify_ai_service import GoCustifyAIService
from app.core.exceptions import AppException
from app.utils.audio import utc_now
from app.utils.helpers import resolve_organization_user_ids
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Calls"])
call_service = CallService()
ai_service = GoCustifyAIService()

# Active AI sessions for calls
active_sessions: dict[str, AIPhoneAgent] = {}

# How long to wait for a keypad language choice before greeting in the default
# language. Long enough to hear the menu and press a key, short enough that a caller
# who ignores it isn't left listening to silence.
LANGUAGE_MENU_TIMEOUT_SECONDS = 6.0

# How long to ring a team member's browser (via a fresh outbound leg to their SIP
# identity, see _handle_incoming_call) before giving up and answering into the AI —
# roughly 3-4 rings. Keyed by the RING LEG's own call_control_id (not the original
# inbound call's), so call.answered/call.hangup webhooks for that leg can look up
# which inbound call to bridge into or fall back to AI for.
BROWSER_RING_TIMEOUT_SECONDS = 18
pending_browser_rings: dict[str, str] = {}


def get_smartflow_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SmartFlowService:
    return SmartFlowService(db)


def get_voice_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> TelnyxWebVoiceService:
    return TelnyxWebVoiceService(db)


@router.post("/calls/{call_sid}/action")
async def call_action(
    call_sid: str,
    request: CallActionRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    User action on a live call (receive, transfer_to_ai, cancel).

    ``call_sid`` here is the Telnyx ``call_control_id``.
    Secured by JWT authentication.
    """
    user_id = str(current_user["_id"])
    user = current_user

    # If request specifies a user_id, ensure caller has access (same user or same organization)
    if request.user_id and request.user_id != user_id:
        target_user = await service.db.users.find_one({"_id": request.user_id})
        if not target_user:
            try:
                target_user = await service.db.users.find_one({"_id": ObjectId(request.user_id)})
            except Exception:
                target_user = None

        if target_user:
            curr_org = current_user.get("organization_id")
            target_org = target_user.get("organization_id")
            if curr_org and target_org and curr_org == target_org:
                user = target_user
            else:
                raise AppException(status_code=403, code="FORBIDDEN_USER_ACTION", message="Not authorized to perform actions for this user")

    if request.action == "receive":
        forward_to = user.get("forwarding_number") or user.get("phone_number")
        if not forward_to:
            raise AppException(status_code=400, code="NO_FORWARDING_NUMBER", message="No forwarding number configured in profile")
        success = await call_service.transfer_call(call_sid, to_number=forward_to)
    elif request.action == "transfer_to_ai":
        if call_sid in pending_browser_rings:
            # call_sid is a browser ring leg that's still ringing (unanswered) --
            # start_streaming below only works on an already-answered call, so
            # instead: stop ringing the browser and answer the ORIGINAL inbound
            # call straight into the AI, same as the ring-timeout fallback but
            # triggered immediately by the team member's explicit choice rather
            # than waiting out BROWSER_RING_TIMEOUT_SECONDS.
            inbound_call_id = pending_browser_rings.pop(call_sid)
            await call_service.hangup_call(call_sid)
            await call_service.answer_call(
                inbound_call_id, websocket_url=call_service.build_media_stream_url(inbound_call_id)
            )
            success = True
        else:
            success = await call_service.start_streaming(call_sid, websocket_url=call_service.build_media_stream_url(call_sid))
    elif request.action == "cancel":
        success = await call_service.hangup_call(call_sid)
    else:
        raise AppException(status_code=400, code="INVALID_ACTION", message="Invalid action")

    if not success:
        raise AppException(status_code=502, code="TELNYX_UPDATE_FAILED", message="Failed to update call via Telnyx")

    return success_response(message=f"Call action '{request.action}' executed successfully.")



@router.post("/calls/webhook")
async def telnyx_call_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    service: SmartFlowService = Depends(get_smartflow_service),
    voice_service: TelnyxWebVoiceService = Depends(get_voice_service),
) -> Response:
    """
    Single Call Control webhook — Telnyx posts every voice event here, tagged by
    ``event_type`` (call.initiated, call.answered, call.hangup, streaming.started, ...).
    This also covers browser (WebRTC) calls now: On-Demand Credentials share this same
    webhook, so there's no separate client-reported "session sync" endpoint anymore —
    call_logs update from this one authoritative source for every call, phone or browser.

    Also mounted, unprefixed, at ``/webhooks/telnyx/voice`` (see
    ``app.api.telnyx_webhook_alias``) to match the URL already registered on the
    Telnyx Voice Application — TELNYX_WEBHOOK_URL in .env — so switching this over
    doesn't require re-registering the webhook in the Telnyx portal.
    """
    return await handle_telnyx_call_webhook(request, background_tasks, service, voice_service)


async def handle_telnyx_call_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    service: SmartFlowService,
    voice_service: TelnyxWebVoiceService,
) -> Response:
    raw_body = await request.body()
    await call_service.validate_telnyx_request(request, raw_body)
    event = call_service.parse_webhook_event(raw_body)
    payload = event.payload
    call_id = payload.call_control_id or "unknown"

    logger.info("Telnyx webhook: event_type=%s call_id=%s", event.event_type, call_id)

    if event.event_type == "call.initiated":
        if payload.direction == "incoming":
            await _handle_incoming_call(call_id, payload, service, voice_service)
        elif payload.direction == "outgoing":
            await _handle_outgoing_call_initiated(call_id, payload, service)
    elif event.event_type == "call.hangup":
        if call_id in pending_browser_rings:
            background_tasks.add_task(_handle_browser_ring_hangup, call_id, payload)
        else:
            # The caller may have abandoned the call while a browser ring was still
            # outstanding for it — stop ringing the team member for a call that's
            # already gone rather than leaving it to time out on its own.
            orphaned_ring_leg = next(
                (leg_id for leg_id, inbound_id in pending_browser_rings.items() if inbound_id == call_id), None
            )
            if orphaned_ring_leg:
                pending_browser_rings.pop(orphaned_ring_leg, None)
                background_tasks.add_task(call_service.hangup_call, orphaned_ring_leg)
            background_tasks.add_task(_handle_call_status, service, call_id, event.event_type, payload)
    elif event.event_type in {"call.answered", "call.bridged"}:
        if call_id in pending_browser_rings:
            background_tasks.add_task(_handle_browser_ring_answered, call_id)
        else:
            background_tasks.add_task(_handle_call_status, service, call_id, event.event_type, payload)
    elif event.event_type == "call.dtmf.received":
        _handle_keypad_digit(call_id, payload.digit)
    elif event.event_type == "call.recording.saved":
        recording_url = ((payload.recording_urls or {}).get("mp3")) or (payload.recording_urls or {}).get("wav")
        call_log = await service.db.call_logs.find_one({"twilio_call_sid": call_id})
        if call_log and recording_url:
            await service.db.call_logs.update_one({"_id": call_log["_id"]}, {"$set": {"recording_url": recording_url}})
            background_tasks.add_task(_process_recording, service.db, call_id, call_log["user_id"], recording_url)

    # Telnyx expects a 200 with an empty body to acknowledge the event.
    return JSONResponse(content={}, status_code=200)


def _handle_keypad_digit(call_id: str, digit: str | None) -> None:
    """Applies a keypad language choice to the live AI session.

    ``active_sessions`` is held in this module by the WebSocket handler, and the
    single uvicorn worker means the webhook reaches the very same object. A digit for
    a call with no live AI session (a human-answered call, or one that already hung
    up) is simply ignored — as is a digit that isn't on the configured menu, so a
    stray keypress never switches the caller to a language nobody offered.
    """
    if not digit:
        return
    agent = active_sessions.get(call_id)
    if not agent:
        return
    if not agent.set_language_from_digit(digit):
        logger.info("Call %s: keypad digit %s is not on the language menu, ignoring", call_id, digit)


async def _handle_incoming_call(
    call_id: str,
    payload,
    service: SmartFlowService,
    voice_service: TelnyxWebVoiceService,
) -> None:
    to_number = payload.to_number
    from_number = payload.from_number

    # One number per business now, not per user — resolve the organization that owns
    # this number, then ring whoever on that team is live in the browser.
    org = await service.db.organizations.find_one({"telnyx_phone_number": to_number}) if to_number else None
    owner = None
    team_user_ids: list[str] = []
    if org:
        owner = await service.db.users.find_one(
            {"organization_id": org["organization_id"], "$or": [{"primary_role": "owner"}, {"role": "owner"}]}
        )
        team_user_ids = await resolve_organization_user_ids(service.db, org["organization_id"])

    legacy_user = None
    if not org and to_number:
        # Pre-migration fallback: a number that was never backfilled into organizations.
        legacy_user = await service.db.users.find_one({"phone_number": to_number})

    active_registration = (
        await voice_service.get_latest_active_registration_for_users(team_user_ids) if team_user_ids else None
    )

    logger.info(
        "Telnyx incoming call: call_id=%s from=%s to=%s org=%s at=%s",
        call_id,
        from_number,
        to_number,
        (org or {}).get("organization_id"),
        utc_now().isoformat(),
    )
    attribution_user = owner or legacy_user
    if not attribution_user:
        logger.warning("Incoming call to %s: no matching organization found, routing as guest", to_number)
    user_id = str(attribution_user["_id"]) if attribution_user else "guest"

    now = utc_now()
    await service.db.call_logs.insert_one(
        {
            "user_id": user_id,
            "twilio_call_sid": call_id,
            "from_number": from_number,
            "phone_number": to_number,
            "status": "ringing",
            "direction": "inbound",
            "timestamp": now.isoformat(),
            "created_at": now,
        }
    )

    if user_id != "guest":
        notify_user_id = active_registration["user_id"] if active_registration else user_id
        try:
            caller_number = from_number or "Unknown"
            await service.create_notification(
                user_id=notify_user_id,
                notification_type="incoming_call",
                title="Incoming Call",
                body=f"Call from {caller_number}",
                metadata={"call_sid": call_id, "caller_number": caller_number, "caller_name": caller_number},
            )
        except Exception:
            logger.warning("Push notification for incoming call failed", exc_info=True)

    if active_registration and active_registration.get("identity"):
        # Someone on the team is live in the browser dialer — ring their WebRTC
        # session with a real, separate call leg (so the browser gets an actual
        # telnyx.notification it can show the Messenger-style incoming-call popup
        # for) rather than answering the inbound call immediately. If they pick up
        # within BROWSER_RING_TIMEOUT_SECONDS, _handle_browser_ring_answered bridges
        # the two legs; if not, _handle_browser_ring_hangup falls back to the AI —
        # the original inbound call is left untouched (unanswered, still "ringing"
        # from the caller's side) until one of those resolves it.
        sip_target = f"sip:{active_registration['identity']}@sip.telnyx.com"
        ring_leg_id = await call_service.ring_browser(
            sip_target=sip_target,
            from_number=to_number,
            timeout_secs=BROWSER_RING_TIMEOUT_SECONDS,
            client_state=call_service.encode_client_state({"purpose": "browser_ring", "inbound_call_id": call_id}),
        )
        if ring_leg_id:
            pending_browser_rings[ring_leg_id] = call_id
            return
        logger.warning("Call %s: could not ring browser (%s), falling back to AI.", call_id, sip_target)

    # No one's live in the browser (or the bridge failed) — answer straight into the AI agent.
    await call_service.answer_call(call_id, websocket_url=call_service.build_media_stream_url(call_id))


async def _handle_browser_ring_answered(ring_leg_id: str) -> None:
    """The team member picked up in their browser — bridge that leg into the
    original inbound call, which has been sitting unanswered (still "ringing" to
    the caller) this whole time."""
    inbound_call_id = pending_browser_rings.pop(ring_leg_id, None)
    if not inbound_call_id:
        return
    bridged = await call_service.bridge_calls(ring_leg_id, with_call_control_id=inbound_call_id)
    if not bridged:
        logger.warning(
            "Call %s: browser answered but bridging to inbound call %s failed, falling back to AI.",
            ring_leg_id, inbound_call_id,
        )
        await call_service.answer_call(inbound_call_id, websocket_url=call_service.build_media_stream_url(inbound_call_id))


async def _handle_browser_ring_hangup(ring_leg_id: str, payload) -> None:
    """The browser ring leg ended before anyone answered it. Two genuinely different
    cases, both arriving as call.hangup on the ring leg:
    - hangup_cause "timeout" — Telnyx's own timeout_secs on the dial fired because
      nobody answered in time. Falls back to AI, same as always.
    - anything else (e.g. "call_rejected") — the team member explicitly declined via
      the Reject button. That must NOT hand the caller to AI (confirmed with the
      user: reject means neither the human nor the AI picks up) — hang up the
      original call too, a true decline. An explicit AI handoff is a separate,
      deliberate action (see the "transfer_to_ai" branch of call_action below),
      not something a decline should trigger as a side effect.
    """
    inbound_call_id = pending_browser_rings.pop(ring_leg_id, None)
    if not inbound_call_id:
        return
    hangup_cause = (getattr(payload, "hangup_cause", None) or "").strip().lower()
    if hangup_cause == "timeout":
        logger.info("Call %s: browser ring timed out, falling back to AI.", inbound_call_id)
        await call_service.answer_call(inbound_call_id, websocket_url=call_service.build_media_stream_url(inbound_call_id))
    else:
        logger.info("Call %s: browser explicitly declined (%s), ending the call.", inbound_call_id, hangup_cause)
        await call_service.hangup_call(inbound_call_id)


async def _handle_outgoing_call_initiated(call_id: str, payload, service: SmartFlowService) -> None:
    """Browser-originated outbound calls dial Telnyx directly from the WebRTC SDK —
    there's no REST round-trip to our backend beforehand, so this webhook is the first
    time we learn about them. client_state (set by the browser via newCall) carries who
    placed it. Calls started through /smartflow/calls/outbound already have their log
    row, so this is a no-op for those (matched by call_control_id, not recreated)."""
    existing = await service.db.call_logs.find_one({"twilio_call_sid": call_id})
    if existing:
        return

    state = call_service.decode_client_state(payload.client_state)
    user_id = state.get("user_id")
    if not user_id:
        logger.warning("Call %s: outgoing call with no matching call_log and no client_state user_id.", call_id)
        return

    now = utc_now()
    await service.db.call_logs.insert_one(
        {
            "user_id": user_id,
            "twilio_call_sid": call_id,
            "contact_name": state.get("display_name") or payload.to_number,
            "phone_number": payload.to_number,
            "from_number": payload.from_number,
            "status": "initiated",
            "direction": "outbound",
            "call_type": "outgoing_direct",
            "timestamp": now.isoformat(),
            "created_at": now,
        }
    )


async def _handle_call_status(service: SmartFlowService, call_id: str, event_type: str, payload) -> None:
    call = await service.db.call_logs.find_one({"twilio_call_sid": call_id})
    if not call:
        return
    normalized = call_service.normalize_call_status(event_type, payload.hangup_cause)
    updates: dict = {"status": normalized}
    if payload.call_duration_secs is not None:
        updates["duration"] = max(0, int(payload.call_duration_secs))
    await service.update_call_log_from_provider_callback(
        user_id=call["user_id"],
        call_log_id=str(call["_id"]),
        twilio_call_sid=call_id,
        call_status=normalized,
        call_duration=str(updates.get("duration")) if "duration" in updates else None,
        from_number=payload.from_number,
        to_number=payload.to_number,
    )
    
    # If this is an outbound automated AI call and the PSTN leg is now live, connect
    # the AI stream once. Some carriers/Telnyx flows surface the stable connected state
    # as `call.bridged` rather than only `call.answered`.
    should_start_ai_stream = (
        event_type in {"call.answered", "call.bridged"}
        and call.get("call_type") == "outbound"
        and call.get("ai_ready")
        and not call.get("ai_stream_started")
    )
    if should_start_ai_stream:
        logger.info("Outbound call %s answered: starting streaming to AI", call_id)
        try:
            started = await call_service.start_streaming(call_id, websocket_url=call_service.build_media_stream_url(call_id))
            if started:
                await service.db.call_logs.update_one(
                    {"_id": call["_id"]},
                    {"$set": {"ai_stream_started": True, "updated_at": utc_now()}},
                )
        except Exception as e:
            logger.error("Failed to start outbound streaming for call %s: %s", call_id, e)


async def _process_recording(
    db,
    call_id: str,
    user_id: str,
    recording_url: str,
) -> None:
    try:
        import base64
        import httpx

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(recording_url)
        if resp.status_code >= 400:
            logger.error("Call %s: Failed to download recording (%s)", call_id, resp.status_code)
            return

        audio_b64 = base64.b64encode(resp.content).decode("utf-8")

        # _transcribe_audio_with_openai is a blocking OpenAI SDK call; off the event
        # loop thread so a post-call recording transcription can't stall a live call's
        # own Whisper turn if both happen to land at the same moment.
        transcript, error = await asyncio.to_thread(
            ai_service._transcribe_audio_with_openai,
            audio_base64=audio_b64,
            audio_mime_type="audio/mpeg",
            audio_filename=f"recording_{call_id}.mp3",
        )
        if not transcript:
            logger.error("Call %s: Transcription failed — %s", call_id, error)
            return

        summary = ai_service.summarize_call(transcript)

        await db.call_logs.update_one(
            {"twilio_call_sid": call_id, "user_id": user_id},
            {
                "$set": {
                    "recording_transcript": transcript,
                    "ai_summary": summary,
                    "processed_at": utc_now(),
                }
            },
        )
        logger.info("Call %s: Recording transcribed and summarized.", call_id)
    except Exception:
        logger.exception("Call %s: Recording processing error", call_id)


@router.get("/calls/{call_sid}/transcript")
async def get_live_call_transcript(
    call_sid: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    Returns the live transcript of an AI-handled call by provider call ID.
    Polled by the mobile app during an active AI call session.
    """
    user_id = str(current_user["_id"])
    call_log = await service.db.call_logs.find_one({"twilio_call_sid": call_sid})
    if not call_log:
        return success_response(
            data={"call_sid": call_sid, "speaker_segments": [], "transcript_available": False},
            message="Call log not found yet.",
        )

    log_user_id = str(call_log.get("user_id") or "")
    if log_user_id != user_id and log_user_id != "guest":
        team_user_ids = []
        if current_user.get("organization_id"):
            team_user_ids = await resolve_organization_user_ids(service.db, current_user["organization_id"])
        if log_user_id not in team_user_ids:
            raise AppException(status_code=403, code="FORBIDDEN_CALL_ACCESS", message="Not authorized to view transcript for this call")

    return success_response(
        data={
            "call_sid": call_sid,
            "call_log_id": str(call_log["_id"]),
            "speaker_segments": call_log.get("speaker_segments", []),
            "transcript_available": bool(call_log.get("speaker_segments")),
        },
        message="Live transcript fetched.",
    )


@router.websocket("/calls/stream/{call_id}", name="call_stream")
async def call_stream(websocket: WebSocket, call_id: str) -> None:
    """
    Receive live audio chunks, send AI audio reply.
    """
    await websocket.accept()

    # Initialize AI Agent for this call
    db = await get_mongo_database()
    flow_service = SmartFlowService(db)

    # Resolve the business owner from the call log created by the incoming webhook.
    call_log = await db.call_logs.find_one({"twilio_call_sid": call_id})
    if call_log and call_log.get("user_id") and call_log["user_id"] != "guest":
        user_id_val = call_log["user_id"]
    else:
        fallback_user = await db.users.find_one({})
        user_id_val = str(fallback_user["_id"]) if fallback_user else "guest"

    agent = AIPhoneAgent(call_id, ai_service, flow_service)
    agent.user_id = user_id_val
    # On an outbound call the business is the from_number — the person the AI is
    # talking to is the number we dialled, so this has to follow the direction.
    agent.is_outbound = is_outbound_call(call_log)
    agent.caller_phone = other_party_number(call_log)
    active_sessions[call_id] = agent

    greeting_task = None
    send_failed = False
    speech_duration_ms = 0
    silence_duration_ms = 0
    has_speech = False
    barge_in_speech_ms = 0
    ENERGY_THRESHOLD = 350.0  # RMS threshold for mu-law speech detection
    # Real phone lines echo the AI's own voice back to us with no acoustic echo
    # cancellation on our side — a naive barge-in check reliably self-triggers within
    # ~100-200ms of every utterance, cutting the AI off almost immediately. A grace
    # period (skip detection right as speech starts, while echo is loudest/most
    # correlated) plus a stricter threshold and longer sustained-speech requirement
    # cuts false positives down to something that needs a real, deliberate interruption.
    BARGE_IN_GRACE_SECONDS = 0.6
    BARGE_IN_ENERGY_THRESHOLD = ENERGY_THRESHOLD * 1.8
    BARGE_IN_THRESHOLD_MS = 600  # sustained real speech while AI is talking counts as an interrupt

    async def send_to_telnyx(message: dict):
        try:
            await websocket.send_json(message)
        except Exception:
            # One failure per audio chunk would flood the log, so only the first is
            # reported — but it must not stay silent: this swallowing is what hid the
            # AI's audio never reaching the caller.
            nonlocal send_failed
            if not send_failed:
                send_failed = True
                logger.warning("Call %s: failed sending audio frame to Telnyx", call_id, exc_info=True)

    async def _open_call(agent):
        """Language menu (when configured) before the greeting, so the greeting itself
        is already in the caller's language.

        If nobody presses a key within the window we greet in the default language and
        leave language_locked False, so Whisper's existing auto-detection still runs on
        their first sentence — the menu can only add signal, never strand a caller.
        """
        if await agent.offer_language_menu(send_to_telnyx):
            waited = 0.0
            while waited < LANGUAGE_MENU_TIMEOUT_SECONDS and not agent.language_menu_answered:
                await asyncio.sleep(0.2)
                waited += 0.2
            if not agent.language_menu_answered:
                logger.info("Call %s: no keypad selection, falling back to auto-detect", call_id)
        await agent.greet(send_to_telnyx)

    async def run_turn_and_maybe_hangup(coro):
        """Runs a greet()/process_and_respond() call, then hangs up the call if the
        agent hit repeated OpenAI failures and gave up (see AIPhoneAgent._speak) —
        otherwise a broken pipeline just leaves the caller on dead air forever."""
        await coro
        if agent.should_hangup:
            await call_service.hangup_call(call_id)

    try:
        from app.utils.audio import mulaw_rms_energy
        import base64

        while True:
            raw_message = await websocket.receive()
            if raw_message.get("type") == "websocket.disconnect":
                break

            text_payload = raw_message.get("text")
            if text_payload is None:
                continue

            stream_message = call_service.parse_stream_message(text_payload)
            if stream_message is None:
                continue

            if stream_message.event == "connected":
                pass  # Telnyx sends this first — no reply needed

            elif stream_message.event == "start":
                agent.stream_sid = stream_message.stream_id
                logger.info("Call %s: Telnyx stream started (stream_sid=%s)", call_id, agent.stream_sid)
                # Greet the user in the background to avoid blocking the message loop
                greeting_task = asyncio.create_task(run_turn_and_maybe_hangup(_open_call(agent)))

            elif stream_message.event == "media":
                if stream_message.media and "payload" in stream_message.media:
                    audio_chunk = base64.b64decode(stream_message.media["payload"])
                    energy = mulaw_rms_energy(audio_chunk)

                    if agent.is_speaking:
                        # AI audio is on the line — watch for a real caller interruption
                        # rather than blindly discarding everything (that let the AI talk
                        # over the caller with no way to break in). Skip detection during
                        # the grace window right after speech starts — that's when line
                        # echo of the AI's own voice is loudest and most likely to false-
                        # trigger, since we have no acoustic echo cancellation here.
                        started_at = agent.speaking_started_at
                        in_grace_period = started_at is None or (time.monotonic() - started_at) < BARGE_IN_GRACE_SECONDS
                        if not in_grace_period and energy >= BARGE_IN_ENERGY_THRESHOLD:
                            barge_in_speech_ms += 20
                            agent.audio_buffer.extend(audio_chunk)
                            if barge_in_speech_ms >= BARGE_IN_THRESHOLD_MS:
                                agent.barge_in_triggered = True
                                speech_duration_ms = barge_in_speech_ms
                                silence_duration_ms = 0
                                has_speech = True
                                barge_in_speech_ms = 0
                        else:
                            barge_in_speech_ms = 0
                            agent.audio_buffer.clear()
                        continue

                    # Echo suppression while the AI is transcribing/thinking — there's no
                    # audible AI speech yet for the caller to interrupt during this gap.
                    if agent.is_processing:
                        agent.audio_buffer.clear()
                        speech_duration_ms = 0
                        silence_duration_ms = 0
                        has_speech = False
                        barge_in_speech_ms = 0
                        continue

                    if energy >= ENERGY_THRESHOLD:
                        # Speech detected!
                        speech_duration_ms += 20
                        silence_duration_ms = 0
                        has_speech = True
                        agent.audio_buffer.extend(audio_chunk)
                    else:
                        # Quiet/Silence chunk
                        if has_speech:
                            # Keep up to 400ms trailing silence for natural cadence
                            if silence_duration_ms < 400:
                                agent.audio_buffer.extend(audio_chunk)
                            silence_duration_ms += 20

                            # Trigger response after 600ms of silence if caller spoke at least
                            # 300ms. Was 750ms — every ms here is pure added latency before the
                            # AI even starts processing, on top of the Whisper/GPT/TTS round
                            # trip; 600ms is still enough of a gap that a caller's normal
                            # mid-sentence breath doesn't get mistaken for them finishing.
                            if silence_duration_ms >= 600 and speech_duration_ms >= 300:
                                speech_duration_ms = 0
                                silence_duration_ms = 0
                                has_speech = False
                                asyncio.create_task(run_turn_and_maybe_hangup(agent.process_and_respond(send_to_telnyx)))

                    # Hard cap: force-process if buffer grows over 10 seconds of active speech
                    if len(agent.audio_buffer) >= 8000 * 10 and not agent.is_processing:
                        speech_duration_ms = 0
                        silence_duration_ms = 0
                        has_speech = False
                        asyncio.create_task(run_turn_and_maybe_hangup(agent.process_and_respond(send_to_telnyx)))

            elif stream_message.event == "error":
                # Telnyx reports stream problems (bad codec, malformed frames, rejected
                # parameters) here. Dropping it silently is what made the "AI is mute"
                # failure so hard to trace — the stream just ended with no explanation.
                logger.error("Call %s: Telnyx stream error: %s", call_id, text_payload)
                break

            elif stream_message.event == "stop":
                break

    finally:
        if greeting_task:
            greeting_task.cancel()
        agent = active_sessions.get(call_id)
        if agent:
            await agent.finalize_session()
        active_sessions.pop(call_id, None)
        try:
            await websocket.close()
        except Exception:
            pass
