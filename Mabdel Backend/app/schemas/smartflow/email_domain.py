from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator
from app.schemas.smartflow._types import EmailDomainMode, EmailDomainStatus

class EmailDomainDnsRecord(BaseModel):
    name: str
    type: str
    value: str
    ttl: int = 300
    priority: int | None = None
    purpose: str = ""


class EmailDomainResponse(BaseModel):
    id: str
    domain: str
    mode: EmailDomainMode
    status: EmailDomainStatus
    dns_records: list[EmailDomainDnsRecord] = Field(default_factory=list)
    dns_auto_provisioned: bool = False
    requires_manual_dns: bool = False
    default_prefix: str
    from_name: str | None = None
    example_address: str | None = None
    inbound_enabled: bool = True
    last_error: str | None = None
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class EmailDomainRequest(BaseModel):
    business_name: str | None = Field(default=None, max_length=120)
    custom_domain: str | None = Field(default=None, max_length=253)
    from_name: str | None = Field(default=None, max_length=100)
    default_prefix: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def _require_one_source(self) -> "EmailDomainRequest":
        if not (self.business_name or "").strip() and not (self.custom_domain or "").strip():
            raise ValueError("Provide either a business name or a custom domain.")
        return self


class EmailDomainSettingsUpdateRequest(BaseModel):
    from_name: str | None = Field(default=None, max_length=100)
    default_prefix: str | None = Field(default=None, max_length=64)


class EmailDomainAvailabilityResponse(BaseModel):
    domain: str
    mode: EmailDomainMode
    available: bool
