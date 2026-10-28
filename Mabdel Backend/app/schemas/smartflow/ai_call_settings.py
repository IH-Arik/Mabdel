from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

class DailyBreak(BaseModel):
    start_hour: int = Field(ge=0, le=23)
    end_hour: int = Field(ge=1, le=24)

    @field_validator("end_hour")
    @classmethod
    def _validate_order(cls, value: int, info) -> int:
        start = info.data.get("start_hour")
        if start is not None and value <= start:
            raise ValueError("end_hour must be later than start_hour.")
        return value


class BusinessHoursResponse(BaseModel):
    timezone: str = "UTC"
    days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    start_hour: int = Field(default=9, ge=0, le=23)
    end_hour: int = Field(default=17, ge=1, le=24)
    slot_minutes: int = Field(default=60, ge=15, le=240)
    blocked_dates: list[str] = Field(default_factory=list)
    daily_breaks: list[DailyBreak] = Field(default_factory=list)


class BusinessHoursUpdateRequest(BaseModel):
    timezone: str | None = Field(default=None, max_length=64)
    days: list[int] | None = None
    start_hour: int | None = Field(default=None, ge=0, le=23)
    end_hour: int | None = Field(default=None, ge=1, le=24)
    slot_minutes: int | None = Field(default=None, ge=15, le=240)
    blocked_dates: list[str] | None = Field(default=None, max_length=366)
    daily_breaks: list[DailyBreak] | None = Field(default=None, max_length=10)

    @field_validator("days")
    @classmethod
    def _validate_days(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and any(day < 0 or day > 6 for day in value):
            raise ValueError("days must be 0 (Monday) through 6 (Sunday).")
        return value

    @field_validator("blocked_dates")
    @classmethod
    def _validate_blocked_dates(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        cleaned = []
        for raw in value:
            try:
                datetime.strptime(raw, "%Y-%m-%d")
            except ValueError as exc:
                raise ValueError(f"blocked_dates must be YYYY-MM-DD strings, got {raw!r}.") from exc
            cleaned.append(raw)
        return cleaned


class AICallLanguageMenuOption(BaseModel):
    digit: str = Field(pattern=r"^[1-9]$")
    language: str = Field(min_length=2, max_length=5)


AICapabilityState = Literal["disabled", "ai_allowed", "human_approval_required"]


class AICapabilities(BaseModel):
    """Per-capability hard permission the AI receptionist must respect, separate from
    the conversation script - the owner's prompt wording (greetings, playbooks) never
    grants a capability by itself; only these switches do. A field left unset (None)
    means "not explicitly overridden": schedule/reschedule/cancel fall back to the
    legacy approval booleans so an existing business's behavior never silently
    changes, and every other capability defaults to "ai_allowed" (today's actual
    unconditional behavior) until an owner dials it down."""

    schedule: AICapabilityState | None = None
    reschedule: AICapabilityState | None = None
    cancel: AICapabilityState | None = None
    take_message: AICapabilityState | None = None
    transfer_to_human: AICapabilityState | None = None
    send_sms: AICapabilityState | None = None
    send_email: AICapabilityState | None = None
    create_crm_contact: AICapabilityState | None = None
    capture_lead: AICapabilityState | None = None
    send_payment_link: AICapabilityState | None = None
    answer_calls: AICapabilityState | None = None
    outbound_calls: AICapabilityState | None = None
    create_callback: AICapabilityState | None = None
    create_task: AICapabilityState | None = None
    create_service_ticket: AICapabilityState | None = None
    provide_pricing: AICapabilityState | None = None
    provide_quote: AICapabilityState | None = None
    access_account_information: AICapabilityState | None = None
    trigger_workflow: AICapabilityState | None = None
    notify_team: AICapabilityState | None = None


NotifyRole = Literal[
    "owner", "front_desk", "scheduling", "sales", "billing", "insurance", "customer_service",
    "clinical_staff", "attorney_intake", "agent", "dispatch", "manager", "custom_team",
]


class CallRoutingRule(BaseModel):
    """A named playbook: 'when a caller wants X, ask these, book with this provider/
    type, notify this'. The receptionist reads these as guidance, not a rigid script -
    it still uses judgement, the same way a real receptionist would follow a written
    procedure rather than recite it word for word."""

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    trigger_description: str = Field(min_length=1, max_length=200)
    questions_to_ask: list[str] = Field(default_factory=list, max_length=8)
    provider_id: str | None = None
    appointment_type_id: str | None = None
    notify_target: str | None = Field(default=None, max_length=120)
    target_user_ids: list[str] = Field(default_factory=list, max_length=30)
    transfer_number: str | None = Field(default=None, pattern=r"^\+[1-9]\d{6,14}$")
    notify_role: NotifyRole | None = None
    crm_note: str | None = Field(default=None, max_length=200)
    active: bool = True

    @field_validator("questions_to_ask")
    @classmethod
    def _clean_questions(cls, value: list[str]) -> list[str]:
        return [item.strip()[:200] for item in value if item and item.strip()][:8]


class OutboundCallPurpose(BaseModel):
    """A named reason the AI places an outbound call - its own opening line,
    objective, questions, allowed actions, closing line, and optional follow-up SMS.
    Replaces a single generic "purpose" dropdown so the owner can write real guidance
    per call type (e.g. "Appointment Reminder" vs "Lead Follow-Up") without touching
    any backend/API detail - the receptionist still uses judgement, same as a
    CallRoutingRule, it isn't a script read verbatim."""

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    opening_message: str | None = Field(default=None, max_length=500)
    objective: str | None = Field(default=None, max_length=300)
    questions_to_ask: list[str] = Field(default_factory=list, max_length=8)
    allowed_actions: list[str] = Field(default_factory=list, max_length=10)
    closing_message: str | None = Field(default=None, max_length=500)
    follow_up_sms: str | None = Field(default=None, max_length=300)
    active: bool = True

    @field_validator("questions_to_ask")
    @classmethod
    def _clean_questions(cls, value: list[str]) -> list[str]:
        return [item.strip()[:200] for item in value if item and item.strip()][:8]

    @field_validator("allowed_actions")
    @classmethod
    def _clean_actions(cls, value: list[str]) -> list[str]:
        return [item.strip()[:100] for item in value if item and item.strip()][:10]


InsuranceNetworkStatus = Literal["in_network", "out_of_network", "plan_dependent", "unknown"]


class InsurancePlan(BaseModel):
    """Authoritative insurance data the owner configures - the ONLY source the AI may
    answer an insurance question from. A static recognition dictionary of common
    insurer names (see realtime_receptionist.py) only helps the model understand what
    the caller said; it is never itself an answer. Shown in Settings only for the
    Dentist/Medical/Chiropractor business types, where this question comes up."""

    id: str = Field(min_length=1, max_length=64)
    payer: str = Field(min_length=1, max_length=80)
    plan_name: str | None = Field(default=None, max_length=80)
    accepted: bool = True
    network_status: InsuranceNetworkStatus = "unknown"
    verification_required: bool = False
    active: bool = True
    effective_from: date | None = None
    effective_until: date | None = None
    last_verified_at: date | None = None

    @model_validator(mode="after")
    def validate_validity_period(self):
        if self.effective_from and self.effective_until and self.effective_until < self.effective_from:
            raise ValueError("Insurance validity end must be on or after its start")
        if self.last_verified_at and self.last_verified_at > date.today():
            raise ValueError("Last verified date cannot be in the future")
        return self


class SmsWordingOverrides(BaseModel):
    """The owner's own text for each appointment SMS, in place of the built-in one.
    {business} and {when} are filled in when present; a kind left blank keeps using
    the built-in (translated) wording."""

    booked: str | None = Field(default=None, max_length=300)
    pending: str | None = Field(default=None, max_length=300)
    rescheduled: str | None = Field(default=None, max_length=300)
    cancelled: str | None = Field(default=None, max_length=300)
    declined: str | None = Field(default=None, max_length=300)
    reminder: str | None = Field(default=None, max_length=300)
    cancellation_declined: str | None = Field(default=None, max_length=300)

    @field_validator("booked", "pending", "rescheduled", "cancelled", "declined", "reminder")
    @classmethod
    def _clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = "".join(char for char in value if char == "\n" or not (ord(char) < 32 or ord(char) == 127))
        cleaned = cleaned.strip()
        return cleaned or None


class AICallSettingsResponse(BaseModel):
    assistant_name: str | None = None
    voice_id: str = "female_warm"
    business_type: str | None = None
    custom_instructions: str | None = None
    greeting_inbound: str | None = None
    greeting_outbound: str | None = None
    closing_message: str | None = None
    language_menu_enabled: bool = False
    language_menu: list[AICallLanguageMenuOption] = Field(default_factory=list)
    knowledge_base: str | None = None
    transfer_number: str | None = None
    voice_engine: str = "realtime"
    require_meeting_approval: bool = False
    require_approval_for_reschedules: bool = False
    require_approval_for_cancellations: bool = False
    sms_confirmations_enabled: bool = True
    request_sms_events: list[Literal["callback", "quote", "service_ticket", "task", "workflow"]] = Field(default_factory=list, max_length=5)
    appointment_reminders_enabled: bool = False
    appointment_reminder_hours_before: int = 24
    sms_wording: SmsWordingOverrides = Field(default_factory=SmsWordingOverrides)
    cancellation_policy: str | None = None
    call_routing_rules: list[CallRoutingRule] = Field(default_factory=list)
    outbound_call_purposes: list[OutboundCallPurpose] = Field(default_factory=list)
    ai_capabilities: AICapabilities = Field(default_factory=AICapabilities)
    insurance_plans: list[InsurancePlan] = Field(default_factory=list)
    emergency_keywords: list[str] = Field(default_factory=list)
    # "take_message": notify the team and transfer if a number is configured (the
    # original behavior - right for a contractor, lawyer, or most other businesses).
    # "direct_to_911": skip the transfer and have the AI tell the caller, in their own
    # language, to hang up and call 911 - right for a medical practice, where waiting
    # on a transfer could cost real time.
    emergency_response_mode: Literal["take_message", "direct_to_911"] = "take_message"
    # Who gets an SMS (not just an in-app notification) the moment an emergency
    # phrase is detected. Falls back to every team member's own phone number on file
    # when left blank, so a business gets this working without configuring anything.
    emergency_alert_phone: str | None = None


class AICallSettingsUpdateRequest(BaseModel):
    """Every field is optional so the settings screen can PATCH one at a time.

    ``None`` is meaningful for the free-text fields — it clears a custom greeting back
    to the built-in translated one — so the service applies only the keys actually sent
    rather than filtering None out.
    """

    assistant_name: str | None = Field(default=None, max_length=60)
    voice_id: str | None = Field(default=None, max_length=40)
    business_type: str | None = Field(default=None, max_length=80)
    custom_instructions: str | None = Field(default=None, max_length=2000)
    greeting_inbound: str | None = Field(default=None, max_length=500)
    greeting_outbound: str | None = Field(default=None, max_length=500)
    closing_message: str | None = Field(default=None, max_length=500)
    language_menu_enabled: bool | None = None
    language_menu: list[AICallLanguageMenuOption] | None = None
    # What a receptionist would know: services, prices, policies, parking, FAQs.
    knowledge_base: str | None = Field(default=None, max_length=8000)
    # Where the AI hands a caller who asks for a person.
    transfer_number: str | None = Field(default=None, max_length=32)
    voice_engine: Literal["realtime", "classic"] | None = None
    require_meeting_approval: bool | None = None
    require_approval_for_reschedules: bool | None = None
    require_approval_for_cancellations: bool | None = None
    sms_confirmations_enabled: bool | None = None
    request_sms_events: list[Literal["callback", "quote", "service_ticket", "task", "workflow"]] | None = Field(default=None, max_length=5)
    appointment_reminders_enabled: bool | None = None
    # 1 hour to 7 days ahead - outside that range a "reminder" stops meaning anything.
    appointment_reminder_hours_before: int | None = Field(default=None, ge=1, le=168)
    sms_wording: SmsWordingOverrides | None = None
    # What the AI tells a caller who wants to cancel (notice period, fees, etc).
    cancellation_policy: str | None = Field(default=None, max_length=500)
    # Named playbooks: "when a caller wants X, ask these, book with this, notify this".
    call_routing_rules: list[CallRoutingRule] | None = Field(default=None, max_length=20)
    outbound_call_purposes: list[OutboundCallPurpose] | None = Field(default=None, max_length=20)
    ai_capabilities: AICapabilities | None = None
    insurance_plans: list[InsurancePlan] | None = Field(default=None, max_length=50)
    # Business-specific phrases that force an immediate transfer/notification, on top
    # of the built-in universal ones (chest pain, gas leak, etc).
    emergency_keywords: list[str] | None = Field(default=None, max_length=20)
    emergency_response_mode: Literal["take_message", "direct_to_911"] | None = None
    emergency_alert_phone: str | None = Field(default=None, max_length=32)

    @field_validator(
        "assistant_name", "business_type", "custom_instructions",
        "greeting_inbound", "greeting_outbound", "closing_message", "knowledge_base", "cancellation_policy",
    )
    @classmethod
    def _clean_free_text(cls, value: str | None) -> str | None:
        """Strip control characters before this text is spoken aloud or pasted into a
        model prompt: they render as noise in TTS and are a cheap way to smuggle
        structure into the prompt's delimited owner-preferences block."""
        if value is None:
            return None
        cleaned = "".join(char for char in value if char == "\n" or not (ord(char) < 32 or ord(char) == 127))
        cleaned = cleaned.strip()
        return cleaned or None

    @field_validator("emergency_keywords")
    @classmethod
    def _clean_emergency_keywords(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [item.strip()[:80] for item in value if item and item.strip()][:20]
