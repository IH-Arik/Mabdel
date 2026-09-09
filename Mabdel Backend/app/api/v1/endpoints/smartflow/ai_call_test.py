from __future__ import annotations

import logging
import time
import uuid

from fastapi import Depends

from app.core.exceptions import AppException
from app.dependencies import require_permission
from app.schemas.smartflow import (
    AICallTestMessageRequest,
    AICallTestMessageResponse,
    AICallTestStartResponse,
)
from app.services.ai_phone_agent import AIPhoneAgent
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router

logger = logging.getLogger(__name__)

# "Test AI" simulator: lets a business owner hold a real, text-only conversation with
# their configured AI phone agent to preview how it will respond before real callers
# do. This reuses AIPhoneAgent._advance_conversation verbatim (the exact logic a real
# call runs) with is_simulation=True, so no Telnyx/audio/websocket code is involved
# and no real calendar bookings, call_meeting_requests, notifications or call_logs
# documents are ever created — see AIPhoneAgent._submit_pending_request.
#
# Sessions are held in-process, mirroring the existing `active_sessions` dict pattern
# calls.py already uses for live call agents (see app/api/v1/endpoints/calls.py). A
# simulated conversation is short-lived, single-user scratch state that never needs to
# survive a process restart or be queried by anyone else — a database collection would
# just be persistence overhead for something meant to be thrown away, so a bounded,
# TTL-swept in-memory dict is the right amount of durability for it.
SIMULATION_SESSION_TTL_SECONDS = 30 * 60  # idle sessions are swept after 30 minutes
MAX_SIMULATION_SESSIONS = 500  # hard cap so an abandoned-session leak can't grow unbounded

simulation_sessions: dict[str, dict] = {}


def _sweep_expired_sessions() -> None:
    now = time.monotonic()
    expired = [
        session_id
        for session_id, entry in simulation_sessions.items()
        if now - entry["last_activity"] > SIMULATION_SESSION_TTL_SECONDS
    ]
    for session_id in expired:
        simulation_sessions.pop(session_id, None)
    # Belt-and-suspenders cap: if somehow still oversized after the TTL sweep (e.g.
    # many concurrent testers), drop the oldest sessions rather than grow forever.
    if len(simulation_sessions) > MAX_SIMULATION_SESSIONS:
        oldest = sorted(simulation_sessions.items(), key=lambda kv: kv[1]["last_activity"])
        for session_id, _entry in oldest[: len(simulation_sessions) - MAX_SIMULATION_SESSIONS]:
            simulation_sessions.pop(session_id, None)


@router.post("/ai-call-settings/test/start")
async def start_ai_call_test(
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    """Starts a new simulated call: a fresh AIPhoneAgent (is_simulation=True) loaded
    with this organization's real ai_call_settings/business_profiles, so the preview
    behaves exactly like a real inbound call would. Returns the greeting text the AI
    would open with — composed the same way a real call's greeting is (see
    AIPhoneAgent._compose_greeting_text), just without any audio synthesis."""
    _sweep_expired_sessions()

    user_id = str(current_user["_id"])
    session_id = uuid.uuid4().hex
    agent = AIPhoneAgent(f"sim_{session_id}", GoCustifyAIService(), service, is_simulation=True)
    agent.user_id = user_id
    agent.greeted = True  # this path composes the greeting text itself, not via greet()

    try:
        greeting = await agent._compose_greeting_text()
    except Exception:
        logger.warning("Test AI: failed to compose greeting for user %s", user_id, exc_info=True)
        raise AppException(
            status_code=500,
            code="AI_CALL_TEST_START_FAILED",
            message="Could not start a test conversation. Please try again.",
        )

    simulation_sessions[session_id] = {
        "agent": agent,
        "user_id": user_id,
        "last_activity": time.monotonic(),
    }

    return success_response(
        data=AICallTestStartResponse(session_id=session_id, greeting=greeting).model_dump(),
        message="Test AI conversation started.",
    )


def _get_owned_session(session_id: str, user_id: str) -> dict:
    _sweep_expired_sessions()
    entry = simulation_sessions.get(session_id)
    if not entry or entry["user_id"] != user_id:
        raise AppException(
            status_code=404,
            code="AI_CALL_TEST_SESSION_NOT_FOUND",
            message="This test conversation has ended or does not exist. Start a new one.",
        )
    return entry


@router.post("/ai-call-settings/test/{session_id}/message")
async def send_ai_call_test_message(
    session_id: str,
    payload: AICallTestMessageRequest,
    current_user: dict = Depends(require_permission("calls", "manage")),
) -> dict:
    """Feeds the caller's simulated text straight into the same
    AIPhoneAgent._advance_conversation the real call websocket handler drives — no
    mock/fake conversation logic, so the preview is representative. Returns the AI's
    reply text plus whether the simulated call would now hang up (should_hangup),
    e.g. after a booking is confirmed and the business's closing_message is spoken."""
    entry = _get_owned_session(session_id, str(current_user["_id"]))
    agent: AIPhoneAgent = entry["agent"]
    entry["last_activity"] = time.monotonic()

    try:
        reply = await agent._advance_conversation(payload.message)
    except Exception:
        logger.exception("Test AI: session %s failed to advance conversation", session_id)
        raise AppException(
            status_code=500,
            code="AI_CALL_TEST_MESSAGE_FAILED",
            message="The test AI could not respond. Please try again.",
        )

    return success_response(
        data=AICallTestMessageResponse(reply=reply, ended=agent.should_hangup).model_dump(),
        message="Test AI replied.",
    )


@router.delete("/ai-call-settings/test/{session_id}")
async def end_ai_call_test(
    session_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
) -> dict:
    """Ends (or resets) a test conversation — drops the held AIPhoneAgent instance."""
    _get_owned_session(session_id, str(current_user["_id"]))
    simulation_sessions.pop(session_id, None)
    return success_response(data=None, message="Test AI conversation ended.")
