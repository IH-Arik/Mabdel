from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException
from app.workflows.graph import run_assistant_workflow

from ._base import SmartFlowBase
from .conversation_service import ConversationService


class WorkflowService(SmartFlowBase):
    def __init__(self, db: AsyncIOMotorDatabase, conversation_service: ConversationService | None = None) -> None:
        super().__init__(db)
        self.conversation_service = conversation_service or ConversationService(db)

    async def process_voice_command(
        self,
        user_id: str,
        transcript: str | None,
        audio_url: str | None,
        audio_base64: str | None = None,
        audio_mime_type: str = "audio/wav",
        audio_filename: str = "voice.wav",
        response_mode: str = "both",
        voice_id: str | None = None,
    ) -> dict:
        transcription = self.ai_service.transcribe_voice(
            transcript=transcript,
            audio_url=audio_url,
            audio_base64=audio_base64,
            audio_mime_type=audio_mime_type,
            audio_filename=audio_filename,
        )
        ai_result = await self.conversation_service.chat_with_ai(
            user_id,
            transcription["transcript"],
            response_mode=response_mode,
            voice_id=voice_id,
        )
        history = await self.log_ai_command(
            user_id=user_id,
            command_text=transcription["transcript"],
            command_type="voice",
            status="completed",
            is_replayable=True,
        )
        return {
            "state": transcription["state"],
            "transcript": transcription["transcript"],
            "ai_response": ai_result["ai_message"]["content"],
            "history_id": history["id"],
            "workflow": ai_result.get("workflow"),
            "navigation": ai_result.get("navigation"),
            "audio": ai_result.get("audio"),
        }

    async def process_workflow_prefill(self, user_id: str, payload: dict) -> dict:
        transcription = self.ai_service.transcribe_voice(
            transcript=payload.get("transcript"),
            audio_url=payload.get("audio_url"),
            audio_base64=payload.get("audio_base64"),
            audio_mime_type=payload.get("audio_mime_type", "audio/wav"),
            audio_filename=payload.get("audio_filename", "voice.wav"),
        )
        transcript = transcription["transcript"]
        workflow_state = run_assistant_workflow(transcript)
        intent = payload.get("workflow_intent") or workflow_state.intent
        if intent not in {"invoice", "bulk_message", "calendar", "lease", "agreement", "contact"}:
            raise AppException(
                status_code=400,
                code="AI_WORKFLOW_UNSUPPORTED",
                message="This voice command does not map to a supported creation workflow.",
                details={"intent": intent, "supported_intents": ["invoice", "bulk_message", "calendar", "lease", "agreement", "contact"]},
            )
        current_values = payload.get("current_values") or {}
        prefill = await self._build_workflow_prefill(
            intent=intent,
            transcript=transcript,
            current_values=current_values,
            user_id=user_id,
            workflow_output=workflow_state.output,
        )
        missing_fields = self._workflow_missing_fields(intent, prefill)
        config = self._workflow_create_config(intent)
        await self.log_ai_command(
            user_id=user_id,
            command_text=transcript,
            command_type=intent,
            status="completed",
            is_replayable=True,
            preview_payload={
                "workflow": {"engine": workflow_state.output.get("workflow_engine"), "intent": intent},
                "navigation": self.ai_service._navigation_for_intent(intent, transcript),
                "prefill": prefill,
                "missing_fields": missing_fields,
            },
        )
        return {
            "state": transcription["state"],
            "transcript": transcript,
            "workflow": {
                "engine": workflow_state.output.get("workflow_engine"),
                "intent": intent,
                "summary": workflow_state.summary if workflow_state.intent == intent else f"{self._workflow_label(intent)} workflow prepared.",
            },
            "navigation": self.ai_service._navigation_for_intent(intent, transcript),
            "prefill": prefill,
            "missing_fields": missing_fields,
            "ready_to_create": not missing_fields,
            "create_endpoint": config["endpoint"],
            "create_method": "POST",
            "submit_label": config["submit_label"],
            "next_action": "create" if not missing_fields else "review_form",
        }

    async def list_ai_voices(self) -> list[dict]:
        return self.ai_service.list_voice_presets()
