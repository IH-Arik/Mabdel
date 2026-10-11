from __future__ import annotations

import asyncio

from app.core.exceptions import AppException
from app.services.call_phrases import SUPPORTED_LANGUAGES
from app.utils.helpers import utc_now

from ._base import SmartFlowBase

# Keys the Website's AI Config tab writes with - the 6 free-text fields plus one
# per SMS-wording kind. Kept in one place so the endpoint, the batch "generate
# everything for this business type" action, and GoCustifyAIService's per-field
# instructions all agree on the same set.
RECEPTIONIST_COMPOSABLE_FIELDS = (
    "greeting_inbound", "greeting_outbound", "closing_message",
    "custom_instructions", "knowledge_base", "cancellation_policy",
    "sms_booked", "sms_pending", "sms_rescheduled", "sms_cancelled",
    "sms_declined", "sms_cancellation_declined", "sms_reminder",
)

# Reading out eleven options would be absurd on a real call, and there are only so
# many keys a caller will listen through before giving up.
MAX_LANGUAGE_MENU_OPTIONS = 4
MAX_CUSTOM_INSTRUCTIONS_CHARS = 2000
MAX_GREETING_CHARS = 500
MAX_CLOSING_MESSAGE_CHARS = 500

# A starting point for every business - plain-language, editable, regeneratable, or
# deletable. Every business gets these out of the box rather than an empty list, same
# spirit as the built-in (but overridable) greeting/closing text.
DEFAULT_OUTBOUND_CALL_PURPOSES = [
    {
        "id": "appointment_reminder", "name": "Appointment Reminder", "active": True,
        "opening_message": "Hi, this is a quick reminder call about your upcoming appointment.",
        "objective": "Make sure the customer knows their appointment is coming up and can still make it.",
        "questions_to_ask": ["Can you still make it at that time?"],
        "allowed_actions": ["Reschedule the appointment if they can't make it", "Confirm the appointment"],
        "closing_message": "Great, we'll see you then. Thanks for your time!",
        "follow_up_sms": "{business}: thanks for taking our call. Call us anytime if you need to reschedule.",
    },
    {
        "id": "appointment_confirmation", "name": "Appointment Confirmation", "active": True,
        "opening_message": "Hi, I'm calling to confirm your upcoming appointment with us.",
        "objective": "Get a clear yes/no on whether the customer is still coming.",
        "questions_to_ask": ["Are you still able to make this appointment?"],
        "allowed_actions": ["Confirm the appointment", "Reschedule the appointment", "Cancel the appointment"],
        "closing_message": "Thank you for confirming, we look forward to seeing you.",
        "follow_up_sms": "{business}: thanks for confirming! We'll see you soon.",
    },
    {
        "id": "missed_call_callback", "name": "Missed-Call Callback", "active": True,
        "opening_message": "Hi, I'm calling you back - we noticed we missed your call earlier.",
        "objective": "Find out what the customer originally needed and help with it, or get them to the right person.",
        "questions_to_ask": ["What were you calling about earlier?"],
        "allowed_actions": ["Answer questions", "Book an appointment", "Transfer to a team member", "Take a message"],
        "closing_message": "Thanks for your patience, let us know if you need anything else.",
        "follow_up_sms": None,
    },
    {
        "id": "lead_follow_up", "name": "Lead Follow-Up", "active": True,
        "opening_message": "Hi, I'm following up on your recent interest in our services.",
        "objective": "Re-engage the lead, answer questions, and move them toward booking.",
        "questions_to_ask": ["Are you still interested?", "Do you have any questions I can answer?"],
        "allowed_actions": ["Answer pricing questions", "Book an appointment", "Take a message"],
        "closing_message": "Thanks for your time, feel free to call us anytime with questions.",
        "follow_up_sms": "{business}: thanks for your interest! Call us anytime with questions.",
    },
    {
        "id": "estimate_follow_up", "name": "Estimate/Quote Follow-Up", "active": True,
        "opening_message": "Hi, I'm calling to follow up on the estimate we sent over.",
        "objective": "Check if the customer has questions about the estimate and help them decide.",
        "questions_to_ask": ["Did you have a chance to review the estimate?", "Do you have any questions about it?"],
        "allowed_actions": ["Answer pricing questions", "Book an appointment", "Take a message"],
        "closing_message": "Thanks for considering us, let us know if you'd like to move forward.",
        "follow_up_sms": "{business}: following up on your estimate - call us anytime with questions.",
    },
    {
        "id": "customer_reactivation", "name": "Customer Reactivation", "active": True,
        "opening_message": "Hi, it's been a while since your last visit and we wanted to check in.",
        "objective": "Reconnect with a past customer and invite them back.",
        "questions_to_ask": ["Would you like to book another appointment?"],
        "allowed_actions": ["Book an appointment", "Answer pricing questions", "Take a message"],
        "closing_message": "It was great reconnecting, hope to see you again soon.",
        "follow_up_sms": "{business}: great to reconnect! Call us anytime to book.",
    },
    {
        "id": "service_reminder", "name": "Service Reminder", "active": True,
        "opening_message": "Hi, it's time for your regular service and we wanted to reach out.",
        "objective": "Remind the customer their service is due and help them schedule it.",
        "questions_to_ask": ["Would you like to schedule your service now?"],
        "allowed_actions": ["Book an appointment", "Reschedule", "Take a message"],
        "closing_message": "Thanks, we'll get that scheduled for you.",
        "follow_up_sms": "{business}: reminder that your service is due - call us to schedule.",
    },
    {
        "id": "custom_campaign", "name": "Custom Outbound Campaign", "active": True,
        "opening_message": None,
        "objective": None,
        "questions_to_ask": [],
        "allowed_actions": [],
        "closing_message": None,
        "follow_up_sms": None,
    },
]


class AICallSettingsService(SmartFlowBase):
    """Per-business persona for the AI phone agent.

    Stored on the ``organizations`` document beside ``business_hours``, and read the
    same way (merge over defaults), so a business that has never opened the settings
    screen still behaves exactly as it did before this feature existed.
    """

    DEFAULT_AI_CALL_SETTINGS = {
        "assistant_name": None,
        "voice_id": "female_warm",
        "business_type": None,
        "custom_instructions": None,
        "greeting_inbound": None,
        "greeting_outbound": None,
        "closing_message": None,
        "language_menu_enabled": False,
        "language_menu": [],
        "knowledge_base": None,
        "transfer_number": None,
        "voice_engine": "realtime",
        "sms_confirmations_enabled": True,
        "appointment_reminders_enabled": False,
        "appointment_reminder_hours_before": 24,
        "sms_wording": {},
        "cancellation_policy": None,
        "call_routing_rules": [],
        "emergency_keywords": [],
        "emergency_response_mode": "take_message",
        "emergency_alert_phone": None,
        "outbound_call_purposes": DEFAULT_OUTBOUND_CALL_PURPOSES,
    }

    async def get_settings(self, user_id: str) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        org = org or {}
        # These three live on the organization itself (the booking service reads them
        # there). require_meeting_approval covers new bookings; an org that has never
        # touched the newer per-action switches keeps its old behavior exactly -
        # reschedules fall back to that same flag, cancellations default to immediate
        # (their long-standing behavior, since a cancellation never used to need
        # approval at all).
        require_meeting_approval = bool(org.get("require_meeting_approval", False))
        return {
            **self.merge_settings(org.get("ai_call_settings")),
            "require_meeting_approval": require_meeting_approval,
            "require_approval_for_reschedules": bool(org.get("require_approval_for_reschedules", require_meeting_approval)),
            "require_approval_for_cancellations": bool(org.get("require_approval_for_cancellations", False)),
        }

    @classmethod
    def merge_settings(cls, stored: dict | None) -> dict:
        return {**cls.DEFAULT_AI_CALL_SETTINGS, **(stored or {})}

    async def get_settings_for_organization(self, organization_id: str | None) -> dict:
        """Used on a live call, where the organization is already resolved."""
        if not organization_id:
            return self.merge_settings(None)
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        return self.merge_settings((org or {}).get("ai_call_settings"))

    async def update_settings(self, user_id: str, payload: dict) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id:
            raise AppException(
                status_code=422,
                code="NO_ORGANIZATION",
                message="Your account isn't part of an organization yet.",
            )

        current = await self.get_settings(user_id)
        # Only keys the caller actually sent are applied, so a PATCH of one field
        # never silently blanks the rest. None is a meaningful value here — it clears
        # a custom greeting back to the built-in one — so it is not filtered out.
        merged = {**current, **payload}
        merged["language_menu"] = self._validate_language_menu(merged.get("language_menu"))
        if merged.get("transfer_number"):
            merged["transfer_number"] = self._normalize_phone_value(merged["transfer_number"]) or None
        if merged.get("emergency_alert_phone"):
            merged["emergency_alert_phone"] = self._normalize_phone_value(merged["emergency_alert_phone"]) or None
        if merged.get("emergency_response_mode") not in ("take_message", "direct_to_911"):
            merged["emergency_response_mode"] = "take_message"
        if merged.get("voice_engine") not in ("realtime", "classic"):
            merged["voice_engine"] = "realtime"
        require_approval = bool(merged.pop("require_meeting_approval", False))
        require_approval_for_reschedules = bool(merged.pop("require_approval_for_reschedules", False))
        require_approval_for_cancellations = bool(merged.pop("require_approval_for_cancellations", False))

        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {
                    "ai_call_settings": merged,
                    "require_meeting_approval": require_approval,
                    "require_approval_for_reschedules": require_approval_for_reschedules,
                    "require_approval_for_cancellations": require_approval_for_cancellations,
                    "updated_at": utc_now(),
                },
                "$setOnInsert": {"organization_id": organization_id, "created_at": utc_now()},
            },
            upsert=True,
        )
        return {
            **merged,
            "require_meeting_approval": require_approval,
            "require_approval_for_reschedules": require_approval_for_reschedules,
            "require_approval_for_cancellations": require_approval_for_cancellations,
        }

    @staticmethod
    def _validate_language_menu(menu: list | None) -> list[dict]:
        """Keeps the menu playable: real digits, supported languages, no duplicate
        keys (a caller pressing 1 must map to exactly one language)."""
        if not menu:
            return []
        cleaned: list[dict] = []
        seen_digits: set[str] = set()
        for entry in menu:
            if not isinstance(entry, dict):
                continue
            digit = str(entry.get("digit") or "").strip()
            language = str(entry.get("language") or "").strip().lower()
            if digit not in {"1", "2", "3", "4", "5", "6", "7", "8", "9"}:
                continue
            if language not in SUPPORTED_LANGUAGES:
                continue
            if digit in seen_digits:
                continue
            seen_digits.add(digit)
            cleaned.append({"digit": digit, "language": language})
            if len(cleaned) >= MAX_LANGUAGE_MENU_OPTIONS:
                break
        return cleaned

    async def _resolve_business_name(self, user_id: str) -> str:
        profile = await self.db.business_profiles.find_one({"user_id": user_id}, {"business_name": 1})
        if profile and profile.get("business_name"):
            return profile["business_name"]
        organization_id = await self._resolve_organization_id(user_id)
        org = await self.db.organizations.find_one({"organization_id": organization_id}, {"business_name": 1}) if organization_id else None
        if org and org.get("business_name"):
            return org["business_name"]
        return ""

    async def compose_receptionist_fields(
        self,
        user_id: str,
        *,
        fields: list[str],
        action: str,
        business_type: str = "",
        current_texts: dict[str, str] | None = None,
    ) -> dict[str, str | None]:
        """Draft or improve one or more AI Receptionist settings fields at once - a
        single field for a per-field "Generate"/"Improve" button, or every field at
        once when the owner changes Business Type. Fields the model couldn't write
        (unavailable, or an "improve" on empty text) come back as None rather than
        failing the whole batch, so one bad field doesn't block the others."""
        wanted = [field for field in dict.fromkeys(fields) if field in RECEPTIONIST_COMPOSABLE_FIELDS]
        if not wanted:
            raise AppException(status_code=400, code="RECEPTIONIST_FIELD_INVALID", message="Unknown field(s) requested.")
        if action not in ("draft", "improve"):
            raise AppException(status_code=400, code="RECEPTIONIST_FIELD_ACTION_INVALID", message="Unknown action.")
        business_name = await self._resolve_business_name(user_id)
        current_texts = current_texts or {}

        async def _one(field: str) -> tuple[str, str | None]:
            text = await asyncio.to_thread(
                self.ai_service.compose_receptionist_field,
                field,
                action=action,
                business_type=business_type,
                business_name=business_name,
                current_text=current_texts.get(field, ""),
            )
            return field, text

        results = await asyncio.gather(*(_one(field) for field in wanted))
        return dict(results)
