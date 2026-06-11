from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class EmailDraftRequest(BaseModel):
    recipient: EmailStr
    subject_hint: str = Field(..., min_length=2, max_length=160)
    instruction: str = Field(..., min_length=2, max_length=1000)


class EmailDraftResponse(BaseModel):
    recipient: EmailStr
    subject: str
    body: str
