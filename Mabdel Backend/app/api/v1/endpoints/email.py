from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import require_permission
from app.schemas.email import EmailDraftRequest, EmailDraftResponse
from app.services.ai_service import AIService
from app.utils.responses import success_response

router = APIRouter(prefix="/email", tags=["Email"])


@router.post("/draft")
async def draft_email(
    payload: EmailDraftRequest,
    current_user: dict = Depends(require_permission("ai_tools", "use")),
) -> dict:
    result: EmailDraftResponse = AIService().draft_email(payload)
    return success_response(data=result.model_dump(), message="Email draft generated successfully.")
