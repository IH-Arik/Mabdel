from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator
from app.schemas.smartflow._types import AIResponseState, VoiceState, AIResponseMode, CommandType, CommandStatus, AIWorkflowIntent
from app.schemas.smartflow.messages import MessageResponse

class AIChatRequest(BaseModel):
    content: str = Field(min_length=1)
    response_mode: AIResponseMode = "text"
    voice_id: str | None = None
    conversation_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_message_fields(cls, data: Any) -> Any:
        if isinstance(data, dict) and not data.get("content"):
            data = {**data, "content": data.get("transcript") or data.get("prompt") or ""}
        return data


class AISynthesizeSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice_id: str | None = None


class AIVoiceOption(BaseModel):
    id: str
    label: str
    gender: Literal["male", "female", "neutral"]
    style: str
    provider_voice: str


class AIChatResponse(BaseModel):
    conversation_id: str
    state: AIResponseState
    user_message: MessageResponse
    ai_message: MessageResponse
    workflow: dict[str, Any] | None = None
    navigation: dict[str, Any] | None = None
    audio: dict[str, Any] | None = None


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)


class ImageGenerationResponse(BaseModel):
    image_url: str


class VoiceCommandRequest(BaseModel):
    transcript: str | None = None
    audio_url: str | None = None
    audio_base64: str | None = None
    audio_mime_type: str = "audio/wav"
    audio_filename: str = "voice.wav"
    response_mode: AIResponseMode = "both"
    voice_id: str | None = None


class VoiceCommandResponse(BaseModel):
    state: VoiceState
    transcript: str
    ai_response: str
    history_id: str
    workflow: dict[str, Any] | None = None
    navigation: dict[str, Any] | None = None
    audio: dict[str, Any] | None = None


class AIWorkflowPrefillRequest(VoiceCommandRequest):
    workflow_intent: AIWorkflowIntent | None = None
    current_values: dict[str, Any] = Field(default_factory=dict)


class AIWorkflowPrefillResponse(BaseModel):
    state: VoiceState
    transcript: str
    workflow: dict[str, Any]
    navigation: dict[str, Any]
    prefill: dict[str, Any]
    missing_fields: list[str] = Field(default_factory=list)
    ready_to_create: bool = False
    create_endpoint: str
    create_method: Literal["POST"] = "POST"
    submit_label: str
    next_action: Literal["review_form", "create"] = "review_form"
class AICommandHistoryItem(BaseModel):
    id: str
    user_id: str
    command_text: str
    command_type: CommandType
    status: CommandStatus
    timestamp: datetime
    is_replayable: bool = True
    command_type_label: str
    status_label: str
    icon: str
    accent_tone: str
    date_bucket: Literal["today", "yesterday", "older"]
    related_resource: dict[str, Any] | None = None
    preview_payload: dict[str, Any] | None = None
