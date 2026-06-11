from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ContentDisplayStyle = Literal["numbered_list", "sections", "faq"]


class ContentBlock(BaseModel):
    order: int = Field(ge=1)
    heading: str | None = Field(default=None, max_length=160)
    body: str = Field(min_length=1, max_length=4000)


class ContentPageResponse(BaseModel):
    slug: str
    title: str
    display_style: ContentDisplayStyle
    version: str = "1.0"
    blocks: list[ContentBlock]
    updated_at: datetime
