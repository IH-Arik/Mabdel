from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RefreshTokenModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    user_id: str
    token: str
    expires_at: datetime
    is_revoked: bool = False
    created_at: datetime
