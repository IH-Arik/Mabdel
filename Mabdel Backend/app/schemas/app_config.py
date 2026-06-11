from __future__ import annotations

from pydantic import BaseModel, Field


class AppConfigResponseData(BaseModel):
    app_name: str = Field(examples=["Mabdel AI"])
    maintenance_mode: bool = Field(examples=[False])
    force_update: bool = Field(examples=[False])
    minimum_supported_version: str = Field(examples=["1.0.0"])
    latest_version: str = Field(examples=["1.2.0"])
    default_language: str = Field(examples=["en"])
    onboarding_enabled: bool = Field(examples=[True])
    onboarding_required: bool = Field(examples=[True])
    feature_flags: dict[str, bool] = Field(
        examples=[
            {
                "voice_assistant": True,
                "notifications": True,
                "contacts_sync": True,
            }
        ]
    )
