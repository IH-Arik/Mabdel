from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class AvailabilitySlotEntry(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class AvailabilitySlotBulkCreate(BaseModel):
    slots: list[AvailabilitySlotEntry] = Field(..., min_length=1, max_length=200)


class BookSlotRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(None, max_length=32)
    notes: str | None = Field(None, max_length=2000)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
