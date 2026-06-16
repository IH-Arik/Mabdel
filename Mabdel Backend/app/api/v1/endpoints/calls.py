from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, WebSocket
from fastapi.responses import PlainTextResponse
import asyncio

from app.dependencies import get_mongo_database
from app.schemas.call import CallActionRequest, TwilioStatusCallbackPayload, TwilioWebhookPayload
from app.services.call_service import CallService
from app.services.smartflow_service import SmartFlowService
from app.services.twilio_provisioning_service import TwilioProvisioningService
from app.utils.responses import success_response
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.ai_phone_agent import AIPhoneAgent
from app.services.mabdel_ai_service import MabdelAIService
from app.core.exceptions import AppException
from app.utils.audio import utc_now
from bson import ObjectId
import secrets

router = APIRouter(tags=["Calls"])
call_service = CallService()
ai_service = MabdelAIService()

# Active AI sessions for calls
active_sessions: dict[str, AIPhoneAgent] = {}


def get_smartflow_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SmartFlowService:
    return SmartFlowService(db)


@router.post("/calls/{call_sid}/action")
async def call_action(
    call_sid: str,
    request: CallActionRequest,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    User action on a live call (receive, transfer_to_ai, cancel).
    """
    # 1. Get the user's profile to get forwarding number if needed
    user = await service.db.users.find_one({"_id": request.user_id})
    if not user:
        # Try finding by string ID if needed
        from bson import ObjectId
        user = await service.db.users.find_one({"_id": ObjectId(request.user_id)})
    
    if not user:
        raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found")

    twiml = ""
    if request.action == "receive":
        forward_to = user.get("forwarding_number") or user.get("phone_number")
        if not forward_to:
            raise AppException(status_code=400, code="NO_FORWARDING_NUMBER", message="No forwarding number configured in profile")
        twiml = call_service.build_dial_twiml(forward_to)
    elif request.action == "transfer_to_ai":
        twiml = call_service.build_twiml_response(
            websocket_url=call_service.build_media_stream_url(call_sid),
            call_id=call_sid,
        )
    elif request.action == "cancel":
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'
    else:
        raise AppException(status_code=400, code="INVALID_ACTION", message="Invalid action")

    success = await call_service.update_call_twiml(call_sid, twiml)
    if not success:
        raise AppException(status_code=502, code="TWILIO_UPDATE_FAILED", message="Failed to update call via Twilio")

    return success_response(message=f"Call action '{request.action}' executed successfully.")


@router.post("/calls/incoming")
async def incoming_call(
    request: Request,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    """
    Twilio Voice webhook.
    Returns TwiML that plays hold music while waiting for user interaction.
    """
    form_data = await request.form()
    form_payload = {key: str(value) for key, value in form_data.multi_items()} if form_data else {}
    await call_service.validate_twilio_request(request, form_payload)

    payload = TwilioWebhookPayload.model_validate(form_payload) if form_payload else TwilioWebhookPayload()
    call_sid = payload.call_sid or "unknown"

    # Match the called number (To) to the user's Twilio sub-account number first,
    # then their profile phone_number. Falls back to the first user if no match.
    user = None
    if payload.to_number:
        user = await service.db.users.find_one({"twilio_phone_number": payload.to_number})
    if not user and payload.to_number:
        user = await service.db.users.find_one({"phone_number": payload.to_number})
    if not user:
        user = await service.db.users.find_one({})
    user_id = str(user["_id"]) if user else "guest"
    
    # 2. Create initial call log
    await service.db.call_logs.insert_one({
        "user_id": user_id,
        "twilio_call_sid": call_sid,
        "from_number": payload.from_number,
        "phone_number": payload.to_number,
        "status": "ringing",
        "direction": "inbound",
        "created_at": utc_now(),
    })

    # 3. Push notification so the user's phone rings in the app.
    if user_id != "guest":
        try:
            caller_number = payload.from_number or "Unknown"
            await service.create_notification(
                user_id=user_id,
                notification_type="incoming_call",
                title="Incoming Call",
                body=f"Call from {caller_number}",
                metadata={
                    "call_sid": call_sid,
                    "caller_number": caller_number,
                    "caller_name": caller_number,
                },
            )
        except Exception as _exc:
            print(f"Push notification for incoming call failed: {_exc}")

    # 5. Return Hold TwiML with Recording
    twiml = call_service.build_hold_twiml("Welcome to Mabdel. Please wait while I connect you to our team.")
    
    # Enable recording
    # We add attributes to the Response element manually for now or update build_hold_twiml
    twiml = twiml.replace("<Response>", f'<Response record="record-from-answer" recordingStatusCallback="{call_service.build_recording_callback_url(user_id)}">')
    
    return PlainTextResponse(content=twiml, media_type="application/xml")


async def _process_recording(
    db,
    call_sid: str,
    user_id: str,
    recording_url: str,
) -> None:
    try:
        import base64
        import httpx
        from app.core.config import settings

        audio_url = recording_url.rstrip("/") + ".mp3"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                audio_url,
                auth=(settings.TWILIO_ACCOUNT_SID or "", settings.TWILIO_AUTH_TOKEN or ""),
            )
        if resp.status_code >= 400:
            print(f"Call {call_sid}: Failed to download recording ({resp.status_code})")
            return

        audio_b64 = base64.b64encode(resp.content).decode("utf-8")

        transcript, error = ai_service._transcribe_audio_with_openai(
            audio_base64=audio_b64,
            audio_mime_type="audio/mpeg",
            audio_filename=f"recording_{call_sid}.mp3",
        )
        if not transcript:
            print(f"Call {call_sid}: Transcription failed — {error}")
            return

        summary = ai_service.summarize_call(transcript)

        await db.call_logs.update_one(
            {"twilio_call_sid": call_sid, "user_id": user_id},
            {
                "$set": {
                    "recording_transcript": transcript,
                    "ai_summary": summary,
                    "processed_at": utc_now(),
                }
            },
        )
        print(f"Call {call_sid}: Recording transcribed and summarized.")
    except Exception as exc:
        print(f"Call {call_sid}: Recording processing error — {exc}")


@router.post("/calls/recording")
async def recording_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str | None = Query(default=None),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    Twilio recording callback — saves URL then transcribes and summarizes in background.
    """
    form_data = await request.form()
    form_payload = {key: str(value) for key, value in form_data.multi_items()} if form_data else {}

    call_sid = form_payload.get("CallSid")
    recording_url = form_payload.get("RecordingUrl")

    if call_sid and recording_url and user_id:
        await service.db.call_logs.update_one(
            {"twilio_call_sid": call_sid, "user_id": user_id},
            {"$set": {"recording_url": recording_url}},
        )
        background_tasks.add_task(_process_recording, service.db, call_sid, user_id, recording_url)

    return success_response(message="Recording callback received.")


@router.get("/calls/{call_sid}/transcript")
async def get_live_call_transcript(
    call_sid: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    Returns the live transcript of an AI-handled call by Twilio CallSid.
    Polled by the mobile app during an active AI call session.
    """
    call_log = await service.db.call_logs.find_one({"twilio_call_sid": call_sid})
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


@router.post("/calls/status", status_code=200)
async def call_status(
    request: Request,
    user_id: str | None = Query(default=None),
    call_log_id: str | None = Query(default=None),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """
    Twilio status callback webhook.
    """
    form_data = await request.form()
    form_payload = {key: str(value) for key, value in form_data.multi_items()} if form_data else {}
    await call_service.validate_twilio_request(request, form_payload)
    payload = TwilioStatusCallbackPayload.model_validate(form_payload) if form_payload else TwilioStatusCallbackPayload()
    response_data = payload.model_dump()
    if user_id and call_log_id:
        updated_log = await service.update_call_log_from_provider_callback(
            user_id=user_id,
            call_log_id=call_log_id,
            twilio_call_sid=payload.call_sid,
            call_status=payload.call_status,
            call_duration=payload.call_duration,
            from_number=payload.from_number,
            to_number=payload.to_number,
        )
        response_data["call_log"] = updated_log
    return success_response(
        data=response_data,
        message="Twilio call status received successfully.",
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

    # Resolve the business owner from the call log created by /calls/incoming.
    # Falls back to first user if the log isn't found yet.
    call_log = await db.call_logs.find_one({"twilio_call_sid": call_id})
    if call_log and call_log.get("user_id") and call_log["user_id"] != "guest":
        user_id_val = call_log["user_id"]
    else:
        fallback_user = await db.users.find_one({})
        user_id_val = str(fallback_user["_id"]) if fallback_user else "guest"
    
    agent = AIPhoneAgent(call_id, ai_service, flow_service)
    agent.user_id = user_id_val
    active_sessions[call_id] = agent

    greeting_task = None

    async def send_to_twilio(message: dict):
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
                agent.stream_sid = stream_message.stream_sid
                await websocket.send_json(
                    call_service.build_stream_started_event(call_id, stream_sid=stream_message.stream_sid).model_dump()
                )
                # Greet the user in the background to avoid blocking the message loop
                greeting_task = asyncio.create_task(agent.greet(send_to_twilio))
            elif stream_message.event == "media":
                if stream_message.media and "payload" in stream_message.media:
                    # Pass audio to agent for processing
                    await agent.handle_media(
                        stream_message.media["payload"], 
                        stream_message.stream_sid, 
                        send_to_twilio
                    )
                
                await websocket.send_json(
                    call_service.build_audio_ack(
                        call_id,
                        call_service.media_payload_size(stream_message),
                        stream_sid=stream_message.stream_sid,
                    ).model_dump()
                )
            elif stream_message.event == "stop":
                if greeting_task:
                    greeting_task.cancel()
                await websocket.send_json(
                    call_service.build_stream_stopped_event(call_id, stream_sid=stream_message.stream_sid).model_dump()
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
