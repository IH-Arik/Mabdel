from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import require_permission, require_subscription
from app.schemas.ai import AICommandRequest, AICommandResponse
from app.services.ai_service import AIService
from app.utils.responses import success_response

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/command")
async def run_ai_command(
    payload: AICommandRequest,
    current_user: dict = Depends(require_permission("ai_tools", "use")),
    _: dict = Depends(require_subscription),
) -> dict:
    result: AICommandResponse = await AIService().handle_command(payload)
    return success_response(data=result.model_dump(), message="AI command processed successfully.")
