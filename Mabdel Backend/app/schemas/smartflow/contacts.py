from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, model_validator
from app.schemas.smartflow._types import PlatformType

class PlatformIdentity(BaseModel):
    platform: PlatformType
    external_id: str = Field(min_length=1, max_length=255)
    handle: str | None = None


class ContactCreateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=1000)
    company: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=300)
    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=3000)
    presence: str | None = Field(default=None, max_length=40)
    identities: list[PlatformIdentity] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_contact_name(self) -> "ContactCreateRequest":
        name = (self.name or "").strip()
        first_name = (self.first_name or "").strip()
        last_name = (self.last_name or "").strip()
        if not name and not first_name:
            raise ValueError("name or first_name is required.")
        if not name:
            self.name = " ".join(part for part in [first_name, last_name] if part).strip()
        if not self.first_name and self.name:
            parts = self.name.split(" ", 1)
            self.first_name = parts[0]
            self.last_name = parts[1] if len(parts) > 1 else self.last_name
        return self


class ContactUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=1000)
    company: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=300)
    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=3000)
    identities: list[PlatformIdentity] | None = None
    presence: str | None = Field(default=None, max_length=40)


class ContactImportEntry(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=300)
    notes: str | None = Field(default=None, max_length=3000)
    company: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)


class ContactImportRequest(BaseModel):
    contacts: list[ContactImportEntry] = Field(default_factory=list, max_length=500)


class ContactResponse(BaseModel):
    id: str
    name: str
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    company: str | None = None
    job_title: str | None = None
    address: str | None = None
    date_of_birth: date | None = None
    notes: str | None = None
    identities: list[PlatformIdentity] = Field(default_factory=list)
    presence: str = "offline"
    presence_label: str = "Offline"
    is_online: bool = False
    initials: str = "NA"
    primary_detail: str | None = None
    source: str | None = None
    created_at: datetime
    updated_at: datetime
