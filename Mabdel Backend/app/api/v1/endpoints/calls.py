from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, WebSocket
from fastapi.responses import JSONResponse
import asyncio

from app.dependencies import get_current_user, get_mongo_database
from app.schemas.call import CallActionRequest
from app.services.call_service import CallService
from app.services.smartflow_service import SmartFlowService
from app.services.telnyx_web_voice_service import TelnyxWebVoiceService
from app.utils.responses import success_response
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.ai_phone_agent import AIPhoneAgent
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


def get_smartflow_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SmartFlowService:
    return SmartFlowService(db)


def get_voice_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> TelnyxWebVoiceService:
    return TelnyxWebVoiceService(db)


@router.post("/calls/{call_sid}/action")
async def call_action(
    call_sid: str,
    request: CallActionRequest,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    User action on a live call (receive, transfer_to_ai, cancel).

    ``call_sid`` here is the Telnyx ``call_control_id``.
    """
    user = await service.db.users.find_one({"_id": request.user_id})
    if not user:
        user = await service.db.users.find_one({"_id": ObjectId(request.user_id)})

    if not user:
        raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found")

    if request.action == "receive":
        forward_to = user.get("forwarding_number") or user.get("phone_number")
        if not forward_to:
            raise AppException(status_code=400, code="NO_FORWARDING_NUMBER", message="No forwarding number configured in profile")
        success = await call_service.transfer_call(call_sid, to_number=forward_to)
    elif request.action == "transfer_to_ai":
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

    if event.event_type == "call.initiated":
        if payload.direction == "incoming":
            await _handle_incoming_call(call_id, payload, service, voice_service)
        elif payload.direction == "outgoing":
            await _handle_outgoing_call_initiated(call_id, payload, service)
    elif event.event_type == "call.hangup":
        await _handle_call_status(service, call_id, event.event_type, payload)
    elif event.event_type in {"call.answered", "call.bridged"}:
        await _handle_call_status(service, call_id, event.event_type, payload)
    elif event.event_type == "call.recording.saved":
        recording_url = ((payload.recording_urls or {}).get("mp3")) or (payload.recording_urls or {}).get("wav")
        call_log = await service.db.call_logs.find_one({"twilio_call_sid": call_id})
        if call_log and recording_url:
            await service.db.call_logs.update_one({"_id": call_log["_id"]}, {"$set": {"recording_url": recording_url}})
            background_tasks.add_task(_process_recording, service.db, call_id, call_log["user_id"], recording_url)

    # Telnyx expects a 200 with an empty body to acknowledge the event.
    return JSONResponse(content={}, status_code=200)


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

    await service.db.call_logs.insert_one(
        {
            "user_id": user_id,
            "twilio_call_sid": call_id,
            "from_number": from_number,
            "phone_number": to_number,
            "status": "ringing",
            "direction": "inbound",
            "created_at": utc_now(),
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
        # Someone on the team is live in the browser dialer — answer plainly (no AI
        # stream) and bridge straight to their WebRTC session over SIP.
        await call_service.answer_call(call_id)
        sip_target = f"sip:{active_registration['identity']}@sip.telnyx.com"
        bridged = await call_service.transfer_call(call_id, to_number=sip_target)
        if bridged:
            return
        logger.warning("Call %s: transfer to browser (%s) failed, falling back to AI.", call_id, sip_target)

    # No one's live in the browser (or the bridge failed) — answer straight into the AI agent.
    await call_service.answer_call(call_id, websocket_url=call_service.build_media_stream_url(call_id))


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
            "created_at": utc_now(),
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

        transcript, error = ai_service._transcribe_audio_with_openai(
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
    call_log = await service.db.call_logs.find_one({"twilio_call_sid": call_sid, "user_id": user_id})
    if not call_log:
        return success_response(
            data={"call_sid": call_sid, "speaker_segments": [], "transcript_available": False},
            message="Call log not found yet.",
        )
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
    await websocket.send_json(call_service.build_connected_event(call_id).model_dump())

    # Initialize AI Agent for this call
    db = await get_mongo_database()
    flow_service = SmartFlowService(db)

    # Resolve the business owner from the call log created by the incoming webhook.
    # Falls back to first user if the log isn't found yet.
    call_log = await db.call_logs.find_one({"twilio_call_sid": call_id})
    if call_log and call_log.get("user_id") and call_log["user_id"] != "guest":
        user_id_val = call_log["user_id"]
    else:
        fallback_user = await db.users.find_one({})
        user_id_val = str(fallback_user["_id"]) if fallback_user else "guest"

    agent = AIPhoneAgent(call_id, ai_service, flow_service)
    agent.user_id = user_id_val
    agent.caller_phone = (call_log or {}).get("from_number")
    active_sessions[call_id] = agent

    greeting_task = None

    async def send_to_telnyx(message: dict):
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    try:
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

            if stream_message.event == "start":
                agent.stream_sid = stream_message.stream_id
                await websocket.send_json(
                    call_service.build_stream_started_event(call_id, stream_sid=stream_message.stream_id).model_dump()
                )
                # Greet the user in the background to avoid blocking the message loop
                greeting_task = asyncio.create_task(agent.greet(send_to_telnyx))
            elif stream_message.event == "media":
                if stream_message.media and "payload" in stream_message.media:
                    # Pass audio to agent for processing
                    await agent.handle_media(
                        stream_message.media["payload"],
                        stream_message.stream_id,
                        send_to_telnyx,
                    )

                await websocket.send_json(
                    call_service.build_audio_ack(
                        call_id,
                        call_service.media_payload_size(stream_message),
                        stream_sid=stream_message.stream_id,
                    ).model_dump()
                )
            elif stream_message.event == "stop":
                if greeting_task:
                    greeting_task.cancel()
                await websocket.send_json(
                    call_service.build_stream_stopped_event(call_id, stream_sid=stream_message.stream_id).model_dump()
                )
                await agent.finalize_session()
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
