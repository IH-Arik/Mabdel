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

from ._base import SmartFlowBase
from .appointment_notifications import format_when
from .calendar_service import CalendarService
from .call_meeting_request_service import CallMeetingRequestService

PARTS_OF_DAY = {"morning": (0, 12), "afternoon": (12, 17), "evening": (17, 24)}


class AppointmentService(SmartFlowBase):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.calendar = CalendarService(db)
        self.requests = CallMeetingRequestService(db)

    async def _hours(self, owner_id: str) -> tuple[dict, object]:
        hours = await self.calendar.get_business_hours(owner_id)
        return hours, self.calendar._resolve_zoneinfo(hours.get("timezone"))

    @staticmethod
    def _parse_day(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            raise AppException(status_code=400, code="APPOINTMENT_BAD_DATE", message="Use a date like 2026-09-29.")

    async def available_slots(self, owner_id: str, *, day: str | None = None, part_of_day: str | None = None, count: int = 3) -> dict:
        """Open times on the day asked for, or the next days with space."""
        hours, tz = await self._hours(owner_id)
        today = self.calendar._now(tz).date()
        wanted = self._parse_day(day)
        days = [wanted] if wanted else [today + timedelta(days=offset) for offset in range(14)]
        low, high = PARTS_OF_DAY.get((part_of_day or "").lower(), (0, 24))
        slots: list[dict] = []
        for current in days:
            if current < today:
                continue
            for label in await self.calendar.find_free_slots(owner_id, current):
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
        return {
            "slots": slots,
            "business_hours": f"{', '.join(open_days)} {hours['start_hour']:02d}:00-{hours['end_hour']:02d}:00 ({hours.get('timezone') or 'UTC'})",
            "today": today.isoformat(),
        }

    async def _slot_bounds(self, owner_id: str, day: str, time: str) -> tuple[datetime, datetime]:
        hours, _ = await self._hours(owner_id)
        wanted = self._parse_day(day)
        if time not in await self.calendar.find_free_slots(owner_id, wanted):
            raise AppException(status_code=409, code="APPOINTMENT_SLOT_UNAVAILABLE", message="That time is not available.")
        start = await self.calendar.localize_business_slot(owner_id, wanted.isoformat(), time)
        return start, start + timedelta(minutes=max(15, int(hours.get("slot_minutes") or 60)))

    async def book(
        self, owner_id: str, *, name: str, phone: str | None, email: str | None, day: str, time: str,
        call_sid: str | None = None, language: str | None = None,
    ) -> dict:
        try:
            start, end = await self._slot_bounds(owner_id, day, time)
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
            start, end = await self._slot_bounds(owner_id, day, time)
        except AppException as exc:
            return {"outcome": "not_possible", "reason": exc.message}
        hours, _ = await self._hours(owner_id)
        when = format_when(start, hours.get("timezone"))
        organization_id = await self._resolve_organization_id(owner_id)
        if await self.requests.approval_required(organization_id):
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
            )
            return {"outcome": "pending", "when": when}
        await self.calendar.update_calendar_event(str(event["user_id"]), str(event["_id"]), {"starts_at": start, "ends_at": end})
        return {"outcome": "rescheduled", "when": when}

    async def cancel(self, owner_id: str, *, appointment_id: str, phone: str | None) -> dict:
        """Cancelling is always immediate - customers never need approval to cancel."""
        try:
            event = await self._callers_event(owner_id, appointment_id, phone)
        except AppException as exc:
            return {"outcome": "not_possible", "reason": exc.message}
        hours, _ = await self._hours(owner_id)
        when = format_when(event["starts_at"], hours.get("timezone"))
        await self.calendar.delete_calendar_event(str(event["user_id"]), str(event["_id"]))
        return {"outcome": "cancelled", "when": when}

