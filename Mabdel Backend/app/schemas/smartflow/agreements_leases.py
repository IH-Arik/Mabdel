from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.schemas.smartflow._types import AgreementType, AgreementPriority, AgreementStatus, AgreementDeliveryChannel, AgreementSignatureProvider, AgreementSmartFieldType, LeasePropertyType, LeaseStatus

class AgreementSmartField(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    field_type: AgreementSmartFieldType
    required: bool = True
    enabled: bool = True
    page: int = Field(default=1, ge=1)
    anchor_text: str | None = Field(default=None, max_length=160)


class AgreementReviewFinding(BaseModel):
    key: str
    title: str
    message: str
    severity: Literal["success", "warning", "error"]
    passed: bool


class AgreementGenerateRequest(BaseModel):
    prompt: str = Field(min_length=10, max_length=3000)
    title: str | None = Field(default=None, min_length=2, max_length=200)
    client_name: str | None = Field(default=None, min_length=2, max_length=120)
    agreement_type: AgreementType = "contract"
    priority: AgreementPriority = "standard"
    start_date: date | None = None
    end_date: date | None = None
    smart_fields: list[AgreementSmartField] = Field(default_factory=list)


class AgreementCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    client_name: str = Field(min_length=2, max_length=120)
    client_email: EmailStr | None = None
    client_phone: str | None = Field(default=None, max_length=40)
    agreement_type: AgreementType = "contract"
    priority: AgreementPriority = "standard"
    start_date: date | None = None
    end_date: date | None = None
    content: str = Field(min_length=20, max_length=50000)
    status: AgreementStatus = "draft"
    smart_fields: list[AgreementSmartField] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_dates(self) -> "AgreementCreateRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date.")
        return self


class AgreementUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    client_name: str | None = Field(default=None, min_length=2, max_length=120)
    client_email: EmailStr | None = None
    client_phone: str | None = Field(default=None, max_length=40)
    agreement_type: AgreementType | None = None
    priority: AgreementPriority | None = None
    start_date: date | None = None
    end_date: date | None = None
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    status: AgreementStatus | None = None
    smart_fields: list[AgreementSmartField] | None = None
    metadata: dict[str, Any] | None = None


class AgreementImproveRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    instruction: str | None = Field(default=None, max_length=1000)


class AgreementReviewRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    agreement_type: AgreementType = "contract"


class AgreementSendSignatureRequest(BaseModel):
    recipient_name: str | None = Field(default=None, min_length=2, max_length=120)
    recipient_email: EmailStr | None = None
    channel: AgreementDeliveryChannel = "link"
    message: str | None = Field(default=None, max_length=1000)
    provider: AgreementSignatureProvider = "native"
    signing_order: int | None = Field(default=1, ge=1, le=99)
    return_url: str | None = Field(default=None, max_length=1000)
    embedded_signing: bool = False
    signer_name: str | None = Field(default=None, min_length=2, max_length=120)
    signer_email: EmailStr | None = None
    signers: list[dict[str, Any]] = Field(default_factory=list)


class AgreementSignRequest(BaseModel):
    signer_name: str = Field(min_length=2, max_length=120)
    signer_email: EmailStr | None = None
    signature_text: str | None = Field(default=None, min_length=1, max_length=300)
    signature_url: str | None = Field(default=None, min_length=5, max_length=1000)

    @model_validator(mode="after")
    def validate_signature(self) -> "AgreementSignRequest":
        if not self.signature_text and not self.signature_url:
            raise ValueError("signature_text or signature_url is required.")
        return self


class AgreementRenewRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    reset_signature: bool = True


class LeaseSignatureFields(BaseModel):
    tenant_signature: bool = True
    landlord_signature: bool = True


class LeaseBasePayload(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    prompt: str | None = Field(default=None, min_length=3, max_length=3000)
    property_address: str | None = Field(default=None, min_length=2, max_length=300)
    property_type: LeasePropertyType = "apartment"
    self_role: Literal["landlord", "tenant"] = "landlord"
    landlord_name: str | None = Field(default=None, min_length=2, max_length=120)
    landlord_email: EmailStr | None = None
    tenant_name: str | None = Field(default=None, min_length=2, max_length=120)
    tenant_email: EmailStr | None = None
    tenant_phone: str | None = Field(default=None, max_length=40)
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    security_deposit_cents: int | None = Field(default=None, ge=0)
    security_deposit: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    rent_due_day: int = Field(default=1, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    custom_terms: str | None = Field(default=None, max_length=12000)
    signature_fields: LeaseSignatureFields = Field(default_factory=LeaseSignatureFields)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency_code(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def validate_lease_dates(self) -> "LeaseBasePayload":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date.")
        return self


class LeaseGenerateRequest(LeaseBasePayload):
    prompt: str = Field(min_length=3, max_length=3000)


class LeaseCreateRequest(LeaseBasePayload):
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    status: LeaseStatus = "draft"


class LeaseUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    property_address: str | None = Field(default=None, min_length=2, max_length=300)
    property_type: LeasePropertyType | None = None
    self_role: Literal["landlord", "tenant"] | None = None
    landlord_name: str | None = Field(default=None, min_length=2, max_length=120)
    landlord_email: EmailStr | None = None
    tenant_name: str | None = Field(default=None, min_length=2, max_length=120)
    tenant_email: EmailStr | None = None
    tenant_phone: str | None = Field(default=None, max_length=40)
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    security_deposit_cents: int | None = Field(default=None, ge=0)
    security_deposit: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    rent_due_day: int | None = Field(default=None, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    custom_terms: str | None = Field(default=None, max_length=12000)
    signature_fields: LeaseSignatureFields | None = None
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    status: LeaseStatus | None = None
    metadata: dict[str, Any] | None = None
    regenerate_content: bool = False

    @field_validator("currency")
    @classmethod
    def normalize_currency_code(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None

    @model_validator(mode="after")
    def validate_lease_dates(self) -> "LeaseUpdateRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date.")
        return self


class LeaseReviewRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    property_address: str | None = Field(default=None, max_length=300)
    landlord_name: str | None = Field(default=None, max_length=120)
    tenant_name: str | None = Field(default=None, max_length=120)
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    security_deposit_cents: int | None = Field(default=None, ge=0)
    security_deposit: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    rent_due_day: int | None = Field(default=None, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    custom_terms: str | None = Field(default=None, max_length=12000)
    signature_fields: LeaseSignatureFields = Field(default_factory=LeaseSignatureFields)


class LeaseEnhanceTermsRequest(BaseModel):
    custom_terms: str | None = Field(default=None, max_length=12000)
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    focus: Literal["balanced", "tenant", "landlord", "compliance"] = "balanced"


class LeaseRenewRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    reset_signature: bool = True


class AgreementDraftResponse(BaseModel):
    title: str
    client_name: str
    agreement_type: AgreementType
    priority: AgreementPriority
    content: str
    smart_fields: list[AgreementSmartField]
    ai_review: list[AgreementReviewFinding]


class AgreementSignatureRequestResponse(BaseModel):
    agreement_id: str
    status: AgreementStatus
    channel: AgreementDeliveryChannel
    recipient_name: str | None = None
    recipient_email: EmailStr | None = None
    signature_request_url: str
    expires_at: datetime | None = None


class AgreementResponse(BaseModel):
    id: str
    agreement_number: str
    title: str
    client_name: str
    client_email: EmailStr | None = None
    client_phone: str | None = None
    agreement_type: AgreementType
    agreement_type_label: str
    priority: AgreementPriority
    status: AgreementStatus
    status_label: str
    status_tone: str
    content: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    smart_fields: list[AgreementSmartField] = Field(default_factory=list)
    ai_review: list[AgreementReviewFinding] = Field(default_factory=list)
    signature_provider: AgreementSignatureProvider | None = None
    provider_status: str | None = None
    provider_envelope_id: str | None = None
    provider_error: str | None = None
    provider_signing_url: str | None = None
    signed_pdf_url: str | None = None
    completion_certificate_url: str | None = None
    signature_request_url: str | None = None
    pdf_url: str
    actions: list[str] = Field(default_factory=list)
    sent_at: datetime | None = None
    signed_at: datetime | None = None
    expired_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AgreementProviderStatusResponse(BaseModel):
    provider: AgreementSignatureProvider
    connected: bool = False
    connection_status: Literal["connected", "disconnected", "needs_reauth", "misconfigured", "error"] = "disconnected"
    account_id: str | None = None
    account_name: str | None = None
    base_uri: str | None = None
    auth_url: str | None = None
    last_error: str | None = None
    connected_at: datetime | None = None


class AgreementSummaryResponse(BaseModel):
    total_agreements: int
    draft_agreements: int
    pending_signature_agreements: int
    signed_agreements: int
    expired_agreements: int
    cancelled_agreements: int
