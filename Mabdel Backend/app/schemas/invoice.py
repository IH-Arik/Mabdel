from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.pagination import PaginationMeta

InvoiceStatus = Literal["draft", "sent", "viewed", "overdue", "paid", "cancelled"]
InvoiceDeliveryChannel = Literal["email", "link", "manual"]


class InvoiceLineItem(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    details: str | None = Field(default=None, max_length=500)
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(default=0, ge=0)


class InvoiceCreateRequest(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=120)
    client_email: EmailStr | None = None
    billing_address: str | None = Field(default=None, max_length=500)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    issue_date: date | None = None
    due_date: date | None = None
    tax_rate: float = Field(default=0, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)
    items: list[InvoiceLineItem] = Field(default_factory=list, min_length=1)


class InvoiceUpdateRequest(BaseModel):
    client_name: str | None = Field(default=None, min_length=2, max_length=120)
    client_email: EmailStr | None = None
    billing_address: str | None = Field(default=None, max_length=500)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    issue_date: date | None = None
    due_date: date | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)
    status: InvoiceStatus | None = None
    items: list[InvoiceLineItem] | None = Field(default=None, min_length=1)


class InvoiceSendRequest(BaseModel):
    recipient_email: EmailStr | None = None
    message: str | None = Field(default=None, max_length=1000)
    channel: InvoiceDeliveryChannel = "email"


class InvoiceShareRequest(BaseModel):
    recipient_email: EmailStr | None = None
    message: str | None = Field(default=None, max_length=1000)
    channel: InvoiceDeliveryChannel = "link"


class InvoiceReminderRequest(BaseModel):
    recipient_email: EmailStr | None = None
    message: str | None = Field(default=None, max_length=1000)
    channel: InvoiceDeliveryChannel = "email"


class InvoiceStatusUpdateRequest(BaseModel):
    status: Literal["viewed", "paid", "cancelled"]
    note: str | None = Field(default=None, max_length=500)


class InvoiceLineItemResponse(BaseModel):
    id: int
    description: str
    details: str | None = None
    quantity: float
    unit_price: float
    line_total: float
    sort_order: int


class InvoiceTimelineEventResponse(BaseModel):
    id: int
    event_type: str
    title: str
    description: str | None = None
    channel: str | None = None
    created_at: datetime


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    client_name: str
    client_email: EmailStr | None = None
    billing_address: str | None = None
    currency: str
    issue_date: date
    due_date: date
    subtotal: float
    tax_rate: float
    tax_amount: float
    total_amount: float
    notes: str | None = None
    status: InvoiceStatus
    sent_at: datetime | None = None
    viewed_at: datetime | None = None
    paid_at: datetime | None = None
    share_url: str | None = None
    total_items: int
    items: list[InvoiceLineItemResponse]
    timeline: list[InvoiceTimelineEventResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class InvoiceListItemResponse(BaseModel):
    id: str
    invoice_number: str
    client_name: str
    client_email: EmailStr | None = None
    currency: str
    due_date: date
    total_amount: float
    status: InvoiceStatus
    issue_date: date
    sent_at: datetime | None = None


class InvoiceSummaryResponse(BaseModel):
    total_outstanding: float
    total_invoices: int
    sent_invoices: int
    overdue_invoices: int
    draft_invoices: int


class InvoiceListResponse(BaseModel):
    items: list[InvoiceListItemResponse]
    pagination: PaginationMeta
    summary: InvoiceSummaryResponse


class InvoiceShareResponse(BaseModel):
    invoice_id: int
    channel: InvoiceDeliveryChannel
    recipient_email: EmailStr | None = None
    share_url: str | None = None
    status: InvoiceStatus


class InvoiceDeleteResponse(BaseModel):
    deleted: bool = True
    invoice_id: int
