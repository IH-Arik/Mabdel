"""What the AI receptionist can do with appointments: find open times (on any day the
caller names), book, look up the caller's own appointments, move them and cancel them.

Everything goes through CalendarService so the business's connected calendar
(Google/Zoom/Microsoft/CalDAV) stays in sync, and every change texts the customer
(see AppointmentNotifier). A caller can only touch appointments booked under their
own phone number.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from bson import ObjectId

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from ._base import SmartFlowBase
from .appointment_notifications import format_when
from .calendar_service import CalendarService
from .call_meeting_request_service import CallMeetingRequestService
from .provider_service import ProviderService

PARTS_OF_DAY = {"morning": (0, 12), "afternoon": (12, 17), "evening": (17, 24)}
MAX_BOOKING_DAYS_AHEAD = 180


class AppointmentService(SmartFlowBase):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.calendar = CalendarService(db)
        self.requests = CallMeetingRequestService(db)
        self.providers = ProviderService(db)

    async def _hours(self, owner_id: str) -> tuple[dict, object]:
        hours = await self.calendar.get_business_hours(owner_id)
        return hours, self.calendar._resolve_zoneinfo(hours.get("timezone"))

    async def _resolve_provider_and_type(
        self, owner_id: str, provider_name: str | None, appointment_type_name: str | None
    ) -> tuple[dict | None, dict | None]:
        """Matches what the caller (or the team, editing a booking) said against the
        business's own providers/appointment types. A name that doesn't match anything
        is treated the same as not naming one - the business may not have set these up,
        or the model may have misheard; failing the whole booking over it would be worse
        than just not narrowing by provider/duration."""
        provider = await self.providers.resolve_provider_by_name(owner_id, provider_name) if provider_name else None
        appointment_type = (
            await self.providers.resolve_appointment_type_by_name(owner_id, appointment_type_name) if appointment_type_name else None
        )
        return provider, appointment_type

    @staticmethod
    def _parse_day(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            raise AppException(status_code=400, code="APPOINTMENT_BAD_DATE", message="Use a date like 2026-09-29.")

    async def available_slots(
        self, owner_id: str, *, day: str | None = None, part_of_day: str | None = None, count: int = 3,
        provider_name: str | None = None, appointment_type_name: str | None = None,
    ) -> dict:
        """Open times on the day asked for, or the next days with space."""
        hours, tz = await self._hours(owner_id)
        provider, appointment_type = await self._resolve_provider_and_type(owner_id, provider_name, appointment_type_name)
        provider_id = provider["id"] if provider else None
        duration_minutes = appointment_type["duration_minutes"] if appointment_type else None
        today = self.calendar._now(tz).date()
        wanted = self._parse_day(day)
        days = [wanted] if wanted else [today + timedelta(days=offset) for offset in range(14)]
        low, high = PARTS_OF_DAY.get((part_of_day or "").lower(), (0, 24))
        slots: list[dict] = []
        for current in days:
            if current < today:
                continue
            for label in await self.calendar.find_free_slots(owner_id, current, provider_id=provider_id, duration_minutes=duration_minutes):
                hour = int(label[:2])
                if not (low <= hour < high):
                    continue
                start = await self.calendar.localize_business_slot(owner_id, current.isoformat(), label)
                slots.append({"date": current.isoformat(), "time": label, "spoken": format_when(start, hours.get("timezone"))})
                if len(slots) >= count:
                    break
            if len(slots) >= count:
                break
        open_days = [
            ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index] for index in sorted(hours["days"])
        ]
        result = {
            "slots": slots,
            "business_hours": f"{', '.join(open_days)} {hours['start_hour']:02d}:00-{hours['end_hour']:02d}:00 ({hours.get('timezone') or 'UTC'})",
            "today": today.isoformat(),
        }
        if provider_name:
            result["provider"] = provider["name"] if provider else None  # None: say so, don't pretend it matched
        if appointment_type_name:
            result["appointment_type"] = appointment_type["name"] if appointment_type else None
        return result

    async def _slot_bounds(
        self, owner_id: str, day: str, time: str, *, provider_id: str | None = None, duration_minutes: int | None = None
    ) -> tuple[datetime, datetime]:
        hours, tz = await self._hours(owner_id)
        wanted = self._parse_day(day)
        if wanted is None:
            raise AppException(status_code=400, code="APPOINTMENT_BAD_DATE", message="Use a date like 2026-09-29.")
        # The model supplies the date; find_free_slots would happily call a past day free.
        today = self.calendar._now(tz).date()
        if wanted < today:
            raise AppException(status_code=409, code="APPOINTMENT_DATE_PASSED", message="That date has already passed.")
        if wanted > today + timedelta(days=MAX_BOOKING_DAYS_AHEAD):
            raise AppException(status_code=409, code="APPOINTMENT_TOO_FAR", message="That is too far ahead to book by phone.")
        if time not in await self.calendar.find_free_slots(owner_id, wanted, provider_id=provider_id, duration_minutes=duration_minutes):
            raise AppException(status_code=409, code="APPOINTMENT_SLOT_UNAVAILABLE", message="That time is not available.")
        start = await self.calendar.localize_business_slot(owner_id, wanted.isoformat(), time)
        reserve_minutes = duration_minutes or max(15, int(hours.get("slot_minutes") or 60))
        return start, start + timedelta(minutes=reserve_minutes)

    async def book(
        self, owner_id: str, *, name: str, phone: str | None, email: str | None, day: str, time: str,
        call_sid: str | None = None, language: str | None = None,
        provider_name: str | None = None, appointment_type_name: str | None = None,
    ) -> dict:
        provider, appointment_type = await self._resolve_provider_and_type(owner_id, provider_name, appointment_type_name)
        try:
            start, end = await self._slot_bounds(
                owner_id, day, time,
                provider_id=provider["id"] if provider else None,
                duration_minutes=appointment_type["duration_minutes"] if appointment_type else None,
            )
        except AppException as exc:
            return {"outcome": "unavailable", "reason": exc.message}
        result = await self.requests.book_or_request_meeting_for_user(
            owner_id,
            call_sid=call_sid,
            caller_name=name,
            caller_email=email,
            caller_phone=phone,
            requested_start=start,
            requested_end=end,
            language=language,
            provider=provider,
            appointment_type=appointment_type,
        )
        hours, _ = await self._hours(owner_id)
        return {
            "outcome": result.get("booking_outcome", "pending"),
            "when": format_when(start, hours.get("timezone")),
            "appointment_id": result.get("calendar_event_id"),
        }

    async def find_upcoming(self, owner_id: str, phone: str | None) -> dict:
        number = self._normalize_phone_value(phone or "")
        if not number:
            return {"appointments": [], "pending_requests": []}
        team_ids = await self._resolve_team_user_ids(owner_id)
        hours, tz = await self._hours(owner_id)
        now = self.calendar._now(tz).astimezone(timezone.utc).replace(tzinfo=None)
        events = await self.db.calendar_events.find(
            {"user_id": {"$in": team_ids}, "customer.phone": number, "status": {"$ne": "cancelled"}, "starts_at": {"$gte": now}}
        ).sort("starts_at", 1).to_list(10)
        organization_id = await self._resolve_organization_id(owner_id)
        pending = await self.db.call_meeting_requests.find(
            {"organization_id": organization_id, "caller_phone": {"$in": [number, phone]}, "status": "pending", "requested_start": {"$gte": now}}
        ).to_list(10)
        return {
            "appointments": [
                {"appointment_id": str(event["_id"]), "when": format_when(event["starts_at"], hours.get("timezone")), "title": event.get("title")}
                for event in events
            ],
            "pending_requests": [format_when(item["requested_start"], hours.get("timezone")) for item in pending],
        }

    async def _remember_language(self, event: dict, language: str | None) -> None:
        """The customer texts are written in the language the caller spoke on this call."""
        if language and (event.get("customer") or {}).get("language") != language:
            await self.db.calendar_events.update_one({"_id": event["_id"]}, {"$set": {"customer.language": language}})

    async def _callers_event(self, owner_id: str, appointment_id: str, phone: str | None) -> dict:
        number = self._normalize_phone_value(phone or "")
        if not number or not ObjectId.is_valid(appointment_id or ""):
            raise AppException(status_code=404, code="APPOINTMENT_NOT_FOUND", message="No appointment found for this caller.")
        team_ids = await self._resolve_team_user_ids(owner_id)
        event = await self.db.calendar_events.find_one(
            {"_id": ObjectId(appointment_id), "user_id": {"$in": team_ids}, "customer.phone": number}
        )
        if not event:
            raise AppException(status_code=404, code="APPOINTMENT_NOT_FOUND", message="No appointment found for this caller.")
        return event

    async def reschedule(
        self, owner_id: str, *, appointment_id: str, phone: str | None, day: str, time: str,
        call_sid: str | None = None, language: str | None = None,
    ) -> dict:
        try:
            event = await self._callers_event(owner_id, appointment_id, phone)
            # Keep the same provider and the same length the appointment already had -
            # a reschedule doesn't change who it's with or how long it takes.
            provider_id = event.get("provider_id")
            existing_minutes = int((event["ends_at"] - event["starts_at"]).total_seconds() // 60) if event.get("ends_at") and event.get("starts_at") else None
            start, end = await self._slot_bounds(owner_id, day, time, provider_id=provider_id, duration_minutes=existing_minutes)
        except AppException as exc:
            return {"outcome": "not_possible", "reason": exc.message}
        hours, _ = await self._hours(owner_id)
        when = format_when(start, hours.get("timezone"))
        await self._remember_language(event, language)
        organization_id = await self._resolve_organization_id(owner_id)
        if await self.requests.approval_required(organization_id, "reschedule"):
            customer = event.get("customer") or {}
            await self.requests.create_pending_request(
                organization_id=organization_id,
                call_sid=call_sid,
                caller_name=customer.get("name") or "Phone caller",
                caller_email=customer.get("email"),
                caller_phone=customer.get("phone"),
                requested_start=start,
                requested_end=end,
                language=language or customer.get("language"),
                kind="reschedule",
                calendar_event_id=str(event["_id"]),
                provider_id=provider_id,
                appointment_type_id=event.get("appointment_type_id"),
            )
            return {"outcome": "pending", "when": when}
        await self.calendar.update_calendar_event(str(event["user_id"]), str(event["_id"]), {"starts_at": start, "ends_at": end}, actor="ai_agent")
        return {"outcome": "rescheduled", "when": when}

    async def cancel(
        self, owner_id: str, *, appointment_id: str, phone: str | None, call_sid: str | None = None, language: str | None = None
    ) -> dict:
        """Cancels immediately unless the business has turned on approval for
        cancellations specifically - most businesses want these instant, but some
        (e.g. a cancellation fee policy) want a human to confirm first."""
        try:
            event = await self._callers_event(owner_id, appointment_id, phone)
        except AppException as exc:
            return {"outcome": "not_possible", "reason": exc.message}
        hours, _ = await self._hours(owner_id)
        when = format_when(event["starts_at"], hours.get("timezone"))
        await self._remember_language(event, language)
        organization_id = await self._resolve_organization_id(owner_id)
        if await self.requests.approval_required(organization_id, "cancel"):
            customer = event.get("customer") or {}
            await self.requests.create_pending_request(
                organization_id=organization_id,
                call_sid=call_sid,
                caller_name=customer.get("name") or "Phone caller",
                caller_email=customer.get("email"),
                caller_phone=customer.get("phone"),
                requested_start=event["starts_at"],
                requested_end=event["ends_at"],
                language=language or customer.get("language"),
                kind="cancel",
                calendar_event_id=str(event["_id"]),
                provider_id=event.get("provider_id"),
                appointment_type_id=event.get("appointment_type_id"),
            )
            return {"outcome": "pending_cancellation", "when": when}
        await self.calendar.delete_calendar_event(str(event["user_id"]), str(event["_id"]), actor="ai_agent")
        return {"outcome": "cancelled", "when": when}

    async def send_due_reminders(self, *, now: datetime | None = None, window_minutes: int = 15) -> int:
        """Texts customers whose appointment is now inside their business's configured
        reminder window (e.g. 24h before) and hasn't been reminded yet. Meant to be
        called by a periodic job every ``window_minutes`` - a wider poll interval than
        the window would skip appointments landing in the gap between runs."""
        from .appointment_notifications import AppointmentNotifier

        now = now or utc_now()
        sent = 0
        async for org in self.db.organizations.find({"ai_call_settings.appointment_reminders_enabled": True}):
            settings = org.get("ai_call_settings") or {}
            hours_before = settings.get("appointment_reminder_hours_before") or 24
            window_start = now + timedelta(hours=hours_before)
            window_end = window_start + timedelta(minutes=window_minutes)
            team_ids = [
                str(user["_id"])
                async for user in self.db.users.find({"organization_id": org["organization_id"]}, {"_id": 1})
            ]
            if not team_ids:
                continue
            async for event in self.db.calendar_events.find(
                {
                    "user_id": {"$in": team_ids},
                    "status": {"$ne": "cancelled"},
                    "starts_at": {"$gte": window_start, "$lt": window_end},
                    "customer.phone": {"$exists": True, "$ne": None},
                    "reminder_sent_at": None,
                }
            ):
                customer = event.get("customer") or {}
                message_id = await AppointmentNotifier(self.db).notify(
                    str(event["user_id"]),
                    kind="reminder",
                    phone=customer.get("phone"),
                    name=customer.get("name"),
                    starts_at=event["starts_at"],
                    language=customer.get("language"),
                    meeting_link=event.get("meeting_link"),
                )
                if message_id:
                    await self.db.calendar_events.update_one({"_id": event["_id"]}, {"$set": {"reminder_sent_at": now}})
                    sent += 1
        return sent

