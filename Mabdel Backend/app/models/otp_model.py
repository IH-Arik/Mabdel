from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OTPCodeModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    email: EmailStr
    code: str
    purpose: Literal["signup", "forgot_password"]
    attempts: int = 0
    is_used: bool = False
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
