from __future__ import annotations

from fastapi import APIRouter

from app.schemas.ai import AICommandRequest, AICommandResponse
from app.services.ai_service import AIService
from app.utils.responses import success_response

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/command")
async def run_ai_command(payload: AICommandRequest) -> dict:
    result: AICommandResponse = AIService().handle_command(payload)
    return success_response(data=result.model_dump(), message="AI command processed successfully.")
