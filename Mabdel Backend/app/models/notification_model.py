from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationModel(BaseModel):
    id: str | None = Field(None, alias="_id")
    user_id: str
    title: str
    message: str
    type: str = "info"  # info, success, warning, error
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
