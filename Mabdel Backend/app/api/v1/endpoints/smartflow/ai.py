from __future__ import annotations

import base64
from typing import Any

from fastapi import Depends, File, Form, Query, Request, UploadFile
from pydantic import ValidationError

from app.core.exceptions import AppException
from app.dependencies import get_current_user
from app.schemas.smartflow import (
    AIChatRequest,
    AIWorkflowPrefillRequest,
    ImageGenerationRequest,
    VoiceCommandRequest,
    VoiceCommandResponse,
)
from app.schemas.common import ApiResponse
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response
import logging

from ._deps import get_smartflow_service
from ._router import router

logger = logging.getLogger(__name__)


@router.post("/ai/chat")
async def ai_chat(
    request: Request,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    try:
        body = await request.json()
        payload = AIChatRequest.model_validate(body)
    except ValidationError as exc:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Validation error.",
            details=exc.errors(),
        ) from exc
    data = await service.chat_with_ai(
        str(current_user["_id"]),
        payload.content,
        response_mode=payload.response_mode,
        voice_id=payload.voice_id,
    )
    return success_response(data=data, message="AI response generated successfully.")


@router.post("/ai/generate-image")
async def generate_ai_image(
    payload: ImageGenerationRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.generate_ai_image(str(current_user["_id"]), payload.prompt)
    return success_response(data=data, message="AI Image generated successfully.")


@router.get("/ai/voices")
async def list_ai_voices(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_ai_voices()
    return success_response(data=data, message="AI voices fetched successfully.")


@router.get("/ai/history")
async def list_ai_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    command_type: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: str | None = None,
    date_to: str | None = None,
    replayable_only: bool = False,
    group_by: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_ai_history(
        str(current_user["_id"]),
        page,
        page_size,
        search,
        command_type,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        replayable_only=replayable_only,
        group_by=group_by,
    )
    return success_response(data=data, message="AI command history fetched successfully.")


@router.post("/ai/history/{history_id}/replay")
async def replay_ai_history(
    history_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.replay_ai_command(str(current_user["_id"]), history_id)
    return success_response(data=data, message="AI command replayed successfully.")


@router.post("/voice/transcribe", response_model=ApiResponse[VoiceCommandResponse])
async def transcribe_voice(
    payload: VoiceCommandRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Any:
    data = await service.process_voice_command(
        str(current_user["_id"]),
        payload.transcript,
        payload.audio_url,
        audio_base64=payload.audio_base64,
        audio_mime_type=payload.audio_mime_type,
        audio_filename=payload.audio_filename,
        response_mode=payload.response_mode,
        voice_id=payload.voice_id,
    )
    return success_response(data=data, message="Voice command processed successfully.")


@router.post("/ai/voice-chat", response_model=ApiResponse[VoiceCommandResponse])
async def ai_voice_chat(
    payload: VoiceCommandRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Any:
    data = await service.process_voice_command(
        str(current_user["_id"]),
        payload.transcript,
        payload.audio_url,
        audio_base64=payload.audio_base64,
        audio_mime_type=payload.audio_mime_type,
        audio_filename=payload.audio_filename,
        response_mode=payload.response_mode,
        voice_id=payload.voice_id,
    )
    return success_response(data=data, message="AI voice chat processed successfully.")


@router.post("/ai/voice-chat-upload", response_model=ApiResponse[VoiceCommandResponse])
async def ai_voice_chat_upload(
    audio_file: UploadFile = File(...),
    response_mode: str = Form(default="audio"),
    voice_id: str | None = Form(default=None),
    transcript: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Any:
    audio_bytes = await audio_file.read()
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else None
    data = await service.process_voice_command(
        str(current_user["_id"]),
        transcript,
        None,
        audio_base64=audio_base64,
        audio_mime_type=audio_file.content_type or "audio/wav",
        audio_filename=audio_file.filename or "voice.wav",
        response_mode=response_mode,
        voice_id=voice_id,
    )
    return success_response(data=data, message="AI voice chat processed successfully.")


@router.post("/ai/workflow-prefill")
async def ai_workflow_prefill(
    payload: AIWorkflowPrefillRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    try:
        data = await service.process_workflow_prefill(str(current_user["_id"]), payload.model_dump())
        return success_response(data=data, message="AI workflow form prefill generated successfully.")
    except Exception as exc:
        logger.error(f"AI Workflow Prefill Error: {exc}", exc_info=True)
        raise
