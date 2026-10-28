from __future__ import annotations

from datetime import date, datetime, timedelta

from bson import ObjectId

from app.utils.helpers import utc_now


class CallMixin:
    async def _serialize_call_log(self, call: dict | None) -> dict:
        safe = self._to_public(call)
        contact = await self._call_contact(safe)
        contact_name = safe.get("contact_name") or (contact or {}).get("name")
        phone_number = safe.get("phone_number") or (contact or {}).get("phone") or safe.get("from_number")
        safe["contact"] = contact
        safe["contact_name"] = contact_name
        safe["phone_number"] = phone_number
        safe["duration"] = int(safe.get("duration") or 0)
        safe["duration_label"] = self._duration_label(safe["duration"])
        safe["call_type_label"] = self._call_type_label(safe.get("call_type"), safe.get("ai_ready"))
        safe["status_label"] = self._call_status_label(safe.get("status"), safe.get("call_type"))
        safe["status_tone"] = self._call_status_tone(safe.get("status"), safe.get("call_type"))
        timestamp_val = safe.get("timestamp") or safe.get("created_at")
        safe["display_time_label"] = self._call_time_label(timestamp_val)
        safe["date_bucket"] = self._date_bucket(timestamp_val)
        safe["recording_available"] = bool(safe.get("recording_url"))
        safe["transcript_available"] = bool(safe.get("transcript"))
        safe["ai_summary"] = safe.get("ai_summary") or None
        safe["ai_summary_available"] = bool(safe.get("ai_summary"))
        safe["speaker_segments"] = safe.get("speaker_segments", [])
        safe["repeat_count"] = await self._call_repeat_count(safe)
        safe["initials"] = self._contact_initials(contact_name or phone_number)
        safe["actions"] = self._call_actions(safe)
        safe["disposition"] = safe.get("disposition")
        safe["disposition_label"] = self._call_disposition_label(safe.get("disposition"))
        safe.setdefault("ai_ready", False)
        safe.setdefault("callback_requested", False)
        safe.pop("user_id", None)
        return safe

    async def _call_contact(self, call: dict) -> dict | None:
        contact_id = call.get("contact_id")
        user_id = call.get("user_id")
        if contact_id and user_id and ObjectId.is_valid(contact_id):
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if contact:
                return self._serialize_contact(contact)
        return None

    async def _call_repeat_count(self, call: dict) -> int:
        user_id = call.get("user_id")
        if not user_id:
            return 1
        filters = {"user_id": user_id}
        if call.get("contact_id"):
            filters["contact_id"] = call["contact_id"]
        elif call.get("phone_number"):
            filters["phone_number"] = call["phone_number"]
        else:
            return 1
        return max(1, await self.db.call_logs.count_documents(filters))

    @staticmethod
    def _duration_label(seconds: int) -> str:
        if seconds <= 0:
            return "--"
        minutes, remainder = divmod(seconds, 60)
        if minutes:
            return f"{minutes}m {remainder:02d}s"
        return f"{remainder}s"

    @staticmethod
    def _call_type_label(call_type: str | None, ai_ready: bool | None = False) -> str:
        if call_type == "missed":
            return "Missed Call"
        if call_type == "outbound":
            return "Outgoing Call"
        if call_type in {"incoming", "incoming_automated"}:
            return "Incoming Automated" if ai_ready or call_type == "incoming_automated" else "Incoming Call"
        if call_type == "scheduled":
            return "Scheduled Call"
        return "Completed Call"

    @staticmethod
    def _call_status_label(status: str | None, call_type: str | None = None) -> str:
        if status == "callback":
            return "Callback Requested"
        if status == "missed" or call_type == "missed":
            return "Missed"
        if status == "completed":
            return "Recorded"
        return (status or "completed").replace("_", " ").title()

    @staticmethod
    def _call_status_tone(status: str | None, call_type: str | None = None) -> str:
        if status == "missed" or call_type == "missed":
            return "danger"
        if status in {"completed", "callback"}:
            return "success"
        if status in {"queued", "initiated", "ringing", "in_progress", "ai_ready"}:
            return "info"
        return "muted"

    @staticmethod
    def _call_actions(call: dict) -> list[str]:
        actions: list[str] = []
        if call.get("transcript"):
            actions.append("transcript")
        if call.get("ai_summary") or call.get("ai_ready"):
            actions.append("ai_summary")
        if call.get("recording_url"):
            actions.append("recording")
        if call.get("phone_number") or call.get("contact_id"):
            actions.append("call_back")
            actions.append("message")
        return actions

    _DISPOSITION_LABELS = {
        "pending_approval": "Awaiting approval",
        "booked": "Booked",
        "rescheduled": "Rescheduled",
        "cancelled": "Cancelled",
        "transferred": "Transferred",
        "message_taken": "Message taken",
        "faq_only": "Questions only",
    }

    @classmethod
    def _call_disposition_label(cls, disposition: str | None) -> str | None:
        if not disposition:
            return None
        return cls._DISPOSITION_LABELS.get(disposition, disposition.replace("_", " ").title())

    @staticmethod
    def _default_call_ai_summary(call: dict) -> dict:
        transcript = (call.get("transcript") or "").strip()
        if transcript:
            return {
                "purpose": transcript[:180],
                "key_points": [],
                "action_items": [],
                "highlights": [],
            }
        return {"purpose": None, "key_points": [], "action_items": [], "highlights": []}

    @staticmethod
    def _call_time_label(value) -> str | None:
        if not value:
            return None
        timestamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        bucket = CallMixin._date_bucket(timestamp)
        time_label = timestamp.strftime("%I:%M %p").lstrip("0")
        if bucket == "today":
            return f"Today {time_label}"
        if bucket == "yesterday":
            return f"Yesterday {time_label}"
        return timestamp.strftime("%b %d, %Y %I:%M %p").replace(" 0", " ")

    @staticmethod
    def _date_bucket(value) -> str:
        if not value:
            return "older"
        timestamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        today = utc_now().date()
        call_date = timestamp.date()
        if call_date == today:
            return "today"
        if call_date == today - timedelta(days=1):
            return "yesterday"
        return "older"

    @staticmethod
    def _call_direction(call: dict) -> str:
        """missed / outbound / incoming — the same rule the Calls page uses per row."""
        call_type = str(call.get("call_type") or "").lower()
        if call.get("status") == "missed" or call_type == "missed":
            return "missed"
        if call_type in {"outbound", "outgoing_direct", "outgoing_automated"} or call.get("direction") == "outbound":
            return "outbound"
        return "incoming"

    def _call_history_summary(self, calls: list[dict]) -> dict:
        # Direction counts and average duration are computed here over *every* call.
        # The Calls page used to count them itself from the one page of rows it had
        # loaded, so with 20 recent test calls to one number it showed "Inbound 0"
        # next to a server-side "Total 106" — inbound calls looked like they were
        # never recorded, when they were only on later pages.
        directions = [self._call_direction(call) for call in calls]
        durations = []
        for call in calls:
            try:
                seconds = int(float(call.get("duration") or 0))
            except (TypeError, ValueError):
                continue
            if seconds > 0:
                durations.append(seconds)
        return {
            "total_calls": len(calls),
            "inbound_calls": directions.count("incoming"),
            "outbound_calls": directions.count("outbound"),
            "avg_duration": round(sum(durations) / len(durations)) if durations else 0,
            "missed_calls": sum(1 for call in calls if call.get("status") == "missed" or call.get("call_type") == "missed"),
            "recorded_calls": sum(1 for call in calls if call.get("recording_url")),
            "transcribed_calls": sum(1 for call in calls if call.get("transcript")),
            "ai_summary_calls": sum(1 for call in calls if call.get("ai_summary") or call.get("ai_ready")),
            "callback_requested_calls": sum(1 for call in calls if call.get("callback_requested")),
        }

    @staticmethod
    def _derive_call_status(payload: dict) -> str:
        if payload.get("status"):
            return str(payload["status"])
        if payload.get("callback_requested"):
            return "callback"
        if payload.get("ai_ready"):
            return "ai_ready"
        if payload.get("call_type") == "missed":
            return "missed"
        return "completed"

