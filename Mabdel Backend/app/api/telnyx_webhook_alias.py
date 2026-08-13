"""Root-level alias for the Telnyx voice webhook.

The Telnyx Voice Application (TELNYX_VOICE_APPLICATION_ID in .env) already has
TELNYX_WEBHOOK_URL — ``/webhooks/telnyx/voice``, no ``/api/v1`` prefix — registered
as its webhook_event_url from before this integration was wired into the backend.
This router is mounted unprefixed in app.main so that URL keeps working without a
trip back to the Telnyx portal; the real handler lives in
``app.api.v1.endpoints.calls``.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.v1.endpoints.calls import get_smartflow_service, get_voice_service, handle_telnyx_call_webhook
from app.services.smartflow_service import SmartFlowService
from app.services.telnyx_web_voice_service import TelnyxWebVoiceService

router = APIRouter(tags=["Calls"])


@router.post("/webhooks/telnyx/voice")
async def telnyx_call_webhook_alias(
    request: Request,
    background_tasks: BackgroundTasks,
    service: SmartFlowService = Depends(get_smartflow_service),
    voice_service: TelnyxWebVoiceService = Depends(get_voice_service),
) -> Response:
    return await handle_telnyx_call_webhook(request, background_tasks, service, voice_service)
