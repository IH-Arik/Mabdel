from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class OnboardingSlideResponse(BaseModel):
    id: int
    title: str
    subtitle: str | None = None
    description: str | None = None
    image_url: str | None = None
    sort_order: int


class OnboardingIdentifier(BaseModel):
    user_id: str | None = Field(default=None, examples=["user_123"])
    device_id: str | None = Field(default=None, examples=["device_abc"])

    @model_validator(mode="after")
    def validate_identifier(self) -> "OnboardingIdentifier":
        if not self.user_id and not self.device_id:
            raise ValueError("Either user_id or device_id must be provided.")
        return self


class OnboardingProgressUpsertRequest(OnboardingIdentifier):
    current_step: int = Field(default=0, ge=0, examples=[1])


class OnboardingActionRequest(OnboardingIdentifier):
    current_step: int = Field(default=0, ge=0, examples=[2])


class OnboardingProgressResponse(BaseModel):
    id: int | None = None
    user_id: str | None = None
    device_id: str | None = None
    current_step: int = 0
    is_completed: bool = False
    is_skipped: bool = False
    completed_at: datetime | None = None
    skipped_at: datetime | None = None
    last_seen_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
