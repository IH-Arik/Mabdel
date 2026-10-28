from __future__ import annotations

import re
import secrets
from datetime import date, datetime, timezone

from bson import ObjectId

from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.helpers import utc_now


class CalendarMixin:
    async def _serialize_calendar_event(self, event: dict | None) -> dict:
        safe = self._to_public(event)
        user_id = safe.get("user_id", "")
        attendees = await self._hydrate_calendar_attendees(user_id, safe.get("contact_ids", []))
        external_attendees = []
        for attendee in safe.get("external_attendees", []) or []:
            external_attendees.append(
                {
                    "id": attendee.get("email") or attendee.get("name") or "external",
                    "name": attendee.get("name") or attendee.get("email") or "External Attendee",
                    "email": attendee.get("email"),
                    "phone": None,
                    "avatar_url": None,
                    "initials": self._contact_initials(attendee.get("name") or attendee.get("email") or "EA"),
                    "source": "external",
                }
            )
        attendees.extend(external_attendees)
        safe["attendees"] = attendees
        safe["attendee_count"] = len(attendees)
        safe["meeting_mode"] = safe.get("meeting_mode", "offline")
        safe["location"] = safe.get("location")
        safe["meeting_link"] = safe.get("meeting_link")
        safe["notify_via_push"] = safe.get("notify_via_push", True)
        safe["notify_via_email"] = safe.get("notify_via_email", False)
        safe["notify_via_sms"] = safe.get("notify_via_sms", False)
        safe["timezone"] = safe.get("timezone", "UTC")
        safe["status"] = safe.get("status", "scheduled")
        safe["sync_status"] = safe.get("sync_status", "local")
        safe["calendar_source"] = safe.get("calendar_source", "mabdel")
        safe["google_calendar_id"] = safe.get("google_calendar_id")
        safe["google_calendar_name"] = safe.get("google_calendar_name")
        safe["zoom_meeting_id"] = safe.get("zoom_meeting_id")
        safe["share_url"] = self._calendar_share_url(safe["share_token"]) if safe.get("share_token") else None
        safe["provider_id"] = safe.get("provider_id")
        safe["provider_name"] = await self._name_for_id(self.db.providers, safe["provider_id"])
        safe["appointment_type_id"] = safe.get("appointment_type_id")
        safe["appointment_type_name"] = await self._name_for_id(self.db.appointment_types, safe["appointment_type_id"])
        safe.pop("share_token", None)
        safe.pop("user_id", None)
        return safe

    @staticmethod
    async def _name_for_id(collection, document_id: str | None) -> str | None:
        """A provider's or appointment type's current name, for display - the event
        keeps working even after the provider is renamed or removed (the id just stops
        resolving to a name, the booking itself is untouched)."""
        if not document_id or not ObjectId.is_valid(document_id):
            return None
        document = await collection.find_one({"_id": ObjectId(document_id)}, {"name": 1})
        return document.get("name") if document else None

    async def _hydrate_calendar_attendees(self, user_id: str, contact_ids: list[str]) -> list[dict]:
        attendees: list[dict] = []
        team_ids = await self._resolve_team_user_ids(user_id) if contact_ids else []
        for contact_id in contact_ids:
            if not ObjectId.is_valid(contact_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": {"$in": team_ids}})
            if not contact:
                continue
            attendees.append(
                {
                    "id": str(contact["_id"]),
                    "name": contact.get("name", "Unknown Contact"),
                    "email": contact.get("email"),
                    "phone": contact.get("phone"),
                    "avatar_url": contact.get("avatar_url"),
                    "initials": self._contact_initials(contact.get("name")),
                }
            )
        return attendees

    def _validate_calendar_event_payload(self, payload: dict) -> None:
        starts_at = payload.get("starts_at")
        ends_at = payload.get("ends_at")
        if not starts_at or not ends_at:
            raise AppException(status_code=400, code="CALENDAR_TIMING_REQUIRED", message="Meeting start and end time are required.")
        if ends_at <= starts_at:
            raise AppException(status_code=400, code="CALENDAR_INVALID_RANGE", message="Meeting end time must be later than start time.")
        if payload.get("meeting_mode") == "online" and payload.get("location") and not payload.get("meeting_link"):
            return

    async def _assert_calendar_slot_available(
        self,
        user_id: str,
        starts_at: datetime,
        ends_at: datetime,
        exclude_event_id: str | None = None,
        provider_id: str | None = None,
        location_id: str | None = None,
    ) -> None:
        if location_id and not provider_id:
            return  # Physical capacity is checked by SchedulingResources.
        clashing: dict = {
            "starts_at": {"$lt": ends_at},
            "ends_at": {"$gt": starts_at},
            "status": {"$ne": "cancelled"},
        }
        if exclude_event_id and ObjectId.is_valid(exclude_event_id):
            clashing["_id"] = {"$ne": ObjectId(exclude_event_id)}
        # A provider named on the event only clashes with that same provider's own
        # bookings - two different providers can be booked for the same time, same as
        # the AI receptionist's own availability check. No provider named: the old
        # org-wide pooled check (every teammate's calendar as one shared block).
        if provider_id:
            scope: dict = {"user_id": {"$in": await self._resolve_team_user_ids(user_id)}, "provider_id": provider_id}
        else:
            scope = await self._calendar_visibility_filter(user_id)
        filters: dict = {"$and": [scope, clashing]}
        existing = await self.db.calendar_events.find_one(filters)
        if existing:
            raise AppException(
                status_code=409,
                code="CALENDAR_CONFLICT",
                message="Another meeting already exists in this time slot.",
                details={"event_id": str(existing["_id"]), "title": existing.get("title")},
            )

    @staticmethod
    def _parse_date_boundary(value: str, *, end_of_day: bool) -> datetime:
        parsed_date = datetime.strptime(value, "%Y-%m-%d").date()
        if end_of_day:
            return datetime.combine(parsed_date, datetime.max.time()).replace(microsecond=0)
        return datetime.combine(parsed_date, datetime.min.time())

    @staticmethod
    def _generate_meeting_link() -> str:
        base = settings.PUBLIC_BACKEND_URL.rstrip("/")
        return f"{base}/meet/{secrets.token_urlsafe(12)}"

    @staticmethod
    def _calendar_share_url(share_token: str) -> str:
        base = settings.PUBLIC_BACKEND_URL.rstrip("/")
        return f"{base}/calendar/share/{share_token}"

    @staticmethod
    def _format_event_time(event: dict) -> str:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        value = event["starts_at"]
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        try:
            zone = ZoneInfo(event.get("timezone") or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            zone = ZoneInfo("UTC")
        return value.astimezone(zone).strftime("%b %d, %Y %I:%M %p %Z")

    def _calendar_share_text(self, event: dict, message: str | None, share_url: str) -> str:
        starts_at = self._format_event_time(event)
        lines = [f"You're invited to {event['title']}.", f"Starts: {starts_at}"]
        if event.get("meeting_link"):
            lines.append(f"Join link: {event['meeting_link']}")
        if event.get("location"):
            lines.append(f"Location: {event['location']}")
        if message:
            lines.append("")
            lines.append(message)
        lines.append("")
        lines.append(f"View details: {share_url}")
        return "\n".join(lines)

    def _calendar_share_html(self, event: dict, message: str | None, share_url: str) -> str:
        from html import escape

        starts_at = escape(self._format_event_time(event))
        location_html = f"<p><strong>Location:</strong> {escape(str(event['location']))}</p>" if event.get("location") else ""
        link = escape(str(event["meeting_link"]), quote=True) if event.get("meeting_link") else ""
        meeting_link_html = f'<p><strong>Join link:</strong> <a href="{link}">{link}</a></p>' if link else ""
        note_html = f"<p>{escape(message)}</p>" if message else ""
        return (
            f"<h2>{escape(str(event['title']))}</h2>"
            f"<p><strong>Starts:</strong> {starts_at}</p>"
            f"{location_html}"
            f"{meeting_link_html}"
            f"{note_html}"
            f'<p><a href="{escape(share_url, quote=True)}">View meeting details</a></p>'
        )

    async def _create_calendar_event_notifications(self, user_id: str, event: dict, *, action: str) -> None:
        if not event.get("notify_via_push", True):
            return
        starts_at = self._format_event_time(event)
        action_map = {
            "created": ("Meeting scheduled", f"{event['title']} is scheduled for {starts_at}."),
            "updated": ("Meeting updated", f"{event['title']} was updated. Starts at {starts_at}."),
            "shared": ("Meeting shared", f"{event['title']} was shared successfully."),
        }
        title, body = action_map.get(action, ("Meeting update", event["title"]))
        await self.create_notification(user_id=user_id, notification_type="calendar", title=title, body=body)

    @staticmethod
    def _appointment_snapshot(document: dict) -> dict:
        """What actually matters in an audit trail: when it is, who it's with, whether
        it's still on. Not the whole document - sync metadata and the like would just
        be noise here."""
        return {
            "starts_at": document.get("starts_at"),
            "ends_at": document.get("ends_at"),
            "status": document.get("status", "scheduled"),
            "provider_id": document.get("provider_id"),
            "appointment_type_id": document.get("appointment_type_id"),
        }

    async def _record_appointment_history(
        self,
        event: dict,
        *,
        action: str,
        actor: str,
        before: dict | None = None,
        after: dict | None = None,
    ) -> None:
        """A durable log of every create/reschedule/cancel on an appointment - kept in
        its own collection (not embedded on the event) so it survives the event being
        deleted, and one document per change instead of an ever-growing array."""
        await self.db.calendar_history.insert_one(
            {
                "event_id": str(event["_id"]),
                "owner_user_id": str(event.get("user_id")),
                "title": event.get("title"),
                "action": action,
                "actor": actor,
                "before": before,
                "after": after,
                "at": utc_now(),
            }
        )

    async def get_calendar_event_history(self, user_id: str, event_id: str) -> list[dict]:
        """Org-wide, like the event itself - and works even after the appointment was
        cancelled and the event document is gone, since this never depends on it."""
        team_ids = await self._resolve_team_user_ids(user_id)
        entries = await self.db.calendar_history.find(
            {"event_id": event_id, "owner_user_id": {"$in": team_ids}}
        ).sort("at", 1).to_list(length=200)
        if not entries:
            return []
        actor_names: dict[str, str] = {}
        for entry in entries:
            actor = entry.get("actor")
            if actor and actor != "ai_agent" and actor not in actor_names and ObjectId.is_valid(actor):
                user = await self.db.users.find_one({"_id": ObjectId(actor)}, {"full_name": 1, "email": 1})
                actor_names[actor] = (user or {}).get("full_name") or (user or {}).get("email") or "A team member"
        results = []
        for entry in entries:
            actor = entry.get("actor")
            results.append(
                {
                    "id": str(entry["_id"]),
                    "action": entry.get("action"),
                    "actor": "AI Receptionist" if actor == "ai_agent" else actor_names.get(actor, "A team member"),
                    "before": entry.get("before"),
                    "after": entry.get("after"),
                    "at": entry.get("at"),
                }
            )
        return results

