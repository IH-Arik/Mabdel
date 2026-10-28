from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field
from app.schemas.smartflow._types import DocumentType

class DocumentCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    type: DocumentType = "others"
    file_url: str = Field(min_length=5)
    contact_id: str | None = None
    conversation_id: str | None = None


class DocumentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    type: DocumentType | None = None
    file_url: str | None = Field(default=None, min_length=5)
    contact_id: str | None = None
    conversation_id: str | None = None


class DocumentResponse(BaseModel):
    id: str
    name: str
    type: DocumentType
    file_url: str
    preview_url: str
    contact_id: str | None = None
    conversation_id: str | None = None
    created_at: datetime
