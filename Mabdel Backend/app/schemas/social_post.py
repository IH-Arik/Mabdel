from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SocialPlatform = Literal["facebook", "instagram", "linkedin", "x"]


class SocialPostCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=63206)
    platforms: list[SocialPlatform] = Field(..., min_length=1)
    media_url: str | None = None
    scheduled_at: datetime | None = None


class PlatformPostResult(BaseModel):
    platform: SocialPlatform
    status: Literal["published", "scheduled", "failed", "not_connected"]
    post_id: str | None = None
    error: str | None = None


class SocialPostResponse(BaseModel):
    id: str
    content: str
    platforms: list[SocialPlatform]
    media_url: str | None
    scheduled_at: datetime | None
    results: list[PlatformPostResult]
    created_at: datetime
