from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AICommandRequest(BaseModel):
    command: str = Field(..., min_length=2, max_length=1000)
    user_id: str | None = None


class AICommandResponse(BaseModel):
    intent: Literal["invoice", "email", "bulk_message", "calendar", "lease", "agreement", "group", "call", "unknown"]
    summary: str
    action_required: bool = False
    output: dict = Field(default_factory=dict)
