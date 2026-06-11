from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field, EmailStr

T = TypeVar("T")

class BaseResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None


class DashboardStatItem(BaseModel):
    label: str
    value: Any
    trend: float | None = None  # Percentage change
    description: str | None = None


class ChartDataPoint(BaseModel):
    label: str
    value: float


class DashboardSummary(BaseModel):
    stats: list[DashboardStatItem]
    recent_activity: list[dict[str, Any]] | None = None


class UserListItem(BaseModel):
    id: str
    full_name: str
    email: str
    phone_no: str | None = None
    joined_date: datetime | None = None
    created_at: datetime | None = None
    status: str = "active"  # active, blocked, pending
    role: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class GrowthMetrics(BaseModel):
    chart_data: list[ChartDataPoint]
    total_count: int
    growth_rate: float


class NotificationItem(BaseModel):
    id: str
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime


class AdminCreateRequest(BaseModel):
    full_name: str
    email: str
    password: str
    organization_id: str | None = None
    role: str = "admin"  # can be admin or super_admin if authorized


class EarningsSummary(BaseModel):
    today: float
    this_month: float
    total_revenue: float


class TransactionListItem(BaseModel):
    id: str
    full_name: str
    trx_id: str
    plan_name: str
    price: float
    date: datetime
    status: str = "completed"


class TransactionDetails(BaseModel):
    transaction_id: str
    plan_name: str
    date: datetime
    user_name: str
    account_number: str  # Masked, e.g., **** **** 545
    email: str
    amount: float


class SubscriptionPlan(BaseModel):
    id: str
    name: str
    price: float
    interval: str  # month, year
    features: list[str]
    is_active: bool = True


class SubscriptionPlanCreate(BaseModel):
    name: str
    price: float
    interval: str
    features: list[str]


class AIStats(BaseModel):
    total_requests: int
    success_rate: float
    avg_response_time: float # in seconds
    total_tokens_used: int
    task_distribution: list[dict[str, Any]]
    error_breakdown: list[dict[str, Any]]
    usage_trend: list[dict[str, Any]]


class AILog(BaseModel):
    id: str
    user_id: str
    action: str
    status: str
    tokens_used: int
    timestamp: datetime


class UserReportListItem(BaseModel):
    id: str
    report_from: str
    report_from_image: str | None = None
    reason: str
    report_to: str
    report_to_image: str | None = None
    date_time: datetime


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone_no: str | None = None
    avatar_url: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class SettingsContent(BaseModel):
    type: str # privacy_policy, terms_conditions, about_us
    content: str


class ChatConversation(BaseModel):
    id: str
    user_name: str
    avatar_url: str | None = None
    last_message: str
    timestamp: datetime
    unread_count: int = 0


class ChatMessage(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    message: str | None = None
    image_url: str | None = None
    timestamp: datetime
    is_me: bool # To differentiate between admin and user bubbles


class UserReportActionRequest(BaseModel):
    action: str  # warn, disable_user, recover_user
    note: str | None = None


class UserNoteRequest(BaseModel):
    note: str


class SubscriptionFeesUpdateRequest(BaseModel):
    subscriptionMonthlyPrice: float
    subscriptionYearlyPrice: float


class SubscriptionFeesResponse(BaseModel):
    subscriptionMonthlyPrice: float
    subscriptionYearlyPrice: float
