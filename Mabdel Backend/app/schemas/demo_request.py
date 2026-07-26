from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

DemoRequestStatus = Literal["new", "replied", "closed"]


class DemoRequestCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=32)
    email: EmailStr
    message: str = Field(..., min_length=1, max_length=4000)


class DemoRequestReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class DemoRequestStatusUpdateRequest(BaseModel):
    status: DemoRequestStatus


class DemoRequestReply(BaseModel):
    admin_id: str
    admin_name: str
    message: str
    sent_at: datetime


class DemoRequestResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    phone: str
    email: str
    message: str
    status: DemoRequestStatus
    replies: list[DemoRequestReply] = []
    created_at: datetime
    updated_at: datetime
