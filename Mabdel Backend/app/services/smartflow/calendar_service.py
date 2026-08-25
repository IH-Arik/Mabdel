from __future__ import annotations

import asyncio
import secrets
from datetime import date, datetime, timedelta, timezone


from app.core.exceptions import AppException
from app.services.email_service import EmailService
from app.utils.helpers import resolve_organization_user_ids, utc_now
from pymongo import ReturnDocument

from ._base import SmartFlowBase
from .caldav_service import CalDAVService
from .google_calendar_service import GoogleCalendarService
from .zoom_calendar_service import ZoomCalendarService


class CalendarService(SmartFlowBase):
    CALENDAR_SYNC_PROVIDERS = ("caldav", "google_business", "zoom")

    def __init__(self, db) -> None:
        super().__init__(db)
        self.google_calendar_service = GoogleCalendarService(db)
        self.caldav_service = CalDAVService(db)
        self.zoom_calendar_service = ZoomCalendarService(db)

    async def get_calendar_provider_settings(self, user_id: str) -> dict:
        """Which calendar provider is the primary two-way sync target, and which
        providers are connected at all. The primary is whatever the user explicitly
        picked (organizations.primary_calendar_provider) — as long as that provider
        is still actually connected — falling back to a legacy auto-priority
        (CalDAV > Google > Zoom) for orgs that never made an explicit choice, so
        upgrading doesn't silently disconnect anyone's existing sync.

        Deliberately batched into as few remote round-trips as possible (this backs
        a page-load endpoint against a remote MongoDB Atlas cluster, where each
        sequential round-trip is real added latency): one query to resolve the org,
        then caldav/team-ids/org-doc concurrently, then a single social_integrations
        query covering both Google and Zoom together instead of two separate
        per-platform lookups."""
        organization_id = await self._resolve_organization_id(user_id)

        async def _team_ids():
            if organization_id:
                return await resolve_organization_user_ids(self.db, organization_id)
            return [user_id]

        async def _org_doc():
            if organization_id:
                return await self.db.organizations.find_one({"organization_id": organization_id})
            return None

        team_ids, caldav_connection, org = await asyncio.gather(
            _team_ids(), self.caldav_service.get_connection(user_id), _org_doc()
        )
        caldav_connected = bool(caldav_connection) and caldav_connection.get("status") == "connected"

        connected_docs = await self.db.social_integrations.find(
            {"user_id": {"$in": team_ids}, "platform": {"$in": ["google_business", "zoom"]}, "status": "connected"},
            {"platform": 1},
        ).to_list(length=10)
        connected_platforms = {doc["platform"] for doc in connected_docs}

        connected = {
            "caldav": caldav_connected,
            "google_business": "google_business" in connected_platforms,
            "zoom": "zoom" in connected_platforms,
        }
        explicit_primary = (org or {}).get("primary_calendar_provider")
        if explicit_primary in self.CALENDAR_SYNC_PROVIDERS and connected.get(explicit_primary):
            primary = explicit_primary
        else:
            primary = next((provider for provider in self.CALENDAR_SYNC_PROVIDERS if connected.get(provider)), None)
        return {"primary_calendar_provider": primary, "connected": connected}

    async def set_primary_calendar_provider(self, user_id: str, provider: str | None) -> dict:
        if provider is not None and provider not in self.CALENDAR_SYNC_PROVIDERS:
            raise AppException(
                status_code=422,
                code="INVALID_CALENDAR_PROVIDER",
                message=f"provider must be one of {', '.join(self.CALENDAR_SYNC_PROVIDERS)}, or null.",
            )
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id:
            raise AppException(status_code=422, code="NO_ORGANIZATION", message="Your account isn't part of an organization yet.")
        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {"primary_calendar_provider": provider, "updated_at": utc_now()},
                "$setOnInsert": {"organization_id": organization_id, "created_at": utc_now()},
            },
            upsert=True,
        )
        return await self.get_calendar_provider_settings(user_id)

    async def _maybe_opportunistic_caldav_sync(self, user_id: str) -> None:
        # Celery beat may not be running in every environment (e.g. local dev without
        # Redis), so also nudge an inbound CalDAV sync inline when the calendar is
        # viewed, throttled to once every 2 minutes per user.
        connection = await self.caldav_service.get_connection(user_id)
        if not connection or connection.get("status") != "connected":
            return
        last_synced_at = connection.get("last_synced_at")
        if isinstance(last_synced_at, datetime):
            threshold = utc_now()
            comparable_threshold = threshold if last_synced_at.tzinfo else threshold.replace(tzinfo=None)
            if (comparable_threshold - last_synced_at).total_seconds() < 120:
                return
        try:
            await self.caldav_service.pull_changes(user_id)
        except Exception:
            pass

    async def list_calendar_events(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        upcoming_only: bool,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        contact_id: str | None = None,
    ) -> dict:
        await self._maybe_opportunistic_caldav_sync(user_id)
        filters: dict = {"user_id": user_id}
        if search:
            filters["title"] = {"$regex": search, "$options": "i"}
        if upcoming_only:
            filters["starts_at"] = {"$gte": utc_now()}
        if date_from or date_to:
            starts_at_filter = filters.get("starts_at", {})
            if not isinstance(starts_at_filter, dict):
                starts_at_filter = {}
            if date_from:
                starts_at_filter["$gte"] = self._parse_date_boundary(date_from, end_of_day=False)
            if date_to:
                starts_at_filter["$lte"] = self._parse_date_boundary(date_to, end_of_day=True)
            filters["starts_at"] = starts_at_filter
        if contact_id:
            filters["contact_ids"] = contact_id
        page_result = await self._paginate(self.db.calendar_events, filters, page, page_size, "starts_at", ascending=True)
        page_result["items"] = [await self._serialize_calendar_event(item) for item in page_result["items"]]
        return page_result

    DEFAULT_BUSINESS_HOURS = {
        "timezone": "UTC",
        "days": [0, 1, 2, 3, 4],  # Mon-Fri (Python weekday: Monday=0)
        "start_hour": 9,
        "end_hour": 17,
        "slot_minutes": 60,
    }

    async def get_business_hours(self, user_id: str) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        hours = (org or {}).get("business_hours")
        return {**self.DEFAULT_BUSINESS_HOURS, **(hours or {})}

    async def update_business_hours(self, user_id: str, payload: dict) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id:
            raise AppException(
                status_code=422,
                code="NO_ORGANIZATION",
                message="Your account isn't part of an organization yet.",
            )
        current = await self.get_business_hours(user_id)
        merged = {**current, **{key: value for key, value in payload.items() if value is not None}}
        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {"business_hours": merged, "updated_at": utc_now()},
                "$setOnInsert": {"organization_id": organization_id, "created_at": utc_now()},
            },
            upsert=True,
        )
        return merged

    async def find_free_slots(self, user_id: str, day: date, *, exclude_datetimes: set[str] | None = None) -> list[str]:
        """Real free/busy: the organization's declared business hours for that weekday
        (in the business's own timezone, at its configured slot size), minus anything
        already on any team member's calendar AND minus any of this organization's own
        *pending* call meeting requests — a soft hold, so two callers (or the same
        caller offered the same slot twice) never both get told the same time is open.
        Not a per-admin declared slot list (that system — admin_availability_slots — is
        the platform's own sales team booking widget, unrelated to individual businesses).
        ``exclude_datetimes`` is a set of "YYYY-MM-DD HH:MM" strings to skip regardless
        of availability — used to avoid re-offering a slot the caller already turned
        down (date-qualified, so declining 9am today doesn't also hide 9am next week)."""
        hours = await self.get_business_hours(user_id)
        if day.weekday() not in hours["days"]:
            return []

        slot_minutes = max(15, int(hours.get("slot_minutes") or 60))
        tz = self._resolve_zoneinfo(hours.get("timezone"))

        # Business hours are defined in local time; calendar_events are stored in UTC
        # (the rest of this codebase's convention), so the open window has to be
        # converted before it can be compared against them.
        local_start = datetime(day.year, day.month, day.day, hours["start_hour"], tzinfo=tz)
        local_end_hour = hours["end_hour"]
        if local_end_hour >= 24:
            local_end = datetime(day.year, day.month, day.day, tzinfo=tz) + timedelta(days=1)
        else:
            local_end = datetime(day.year, day.month, day.day, local_end_hour, tzinfo=tz)

        candidates: list[datetime] = []
        cursor = local_start
        while cursor + timedelta(minutes=slot_minutes) <= local_end:
            candidates.append(cursor)
            cursor += timedelta(minutes=slot_minutes)
        if not candidates:
            return []

        organization_id = await self._resolve_organization_id(user_id)
        team_ids = await self._resolve_team_user_ids(user_id)
        window_start_utc = candidates[0].astimezone(timezone.utc).replace(tzinfo=None)
        window_end_utc = (candidates[-1] + timedelta(minutes=slot_minutes)).astimezone(timezone.utc).replace(tzinfo=None)

        events = await self.db.calendar_events.find(
            {
                "user_id": {"$in": team_ids},
                "status": {"$ne": "cancelled"},
                "starts_at": {"$lt": window_end_utc},
                "ends_at": {"$gt": window_start_utc},
            }
        ).to_list(length=200)
        busy_ranges = [
            (event["starts_at"].replace(tzinfo=timezone.utc), event["ends_at"].replace(tzinfo=timezone.utc))
            for event in events
            if isinstance(event.get("starts_at"), datetime) and isinstance(event.get("ends_at"), datetime)
        ]

        if organization_id:
            pending = await self.db.call_meeting_requests.find(
                {
                    "organization_id": organization_id,
                    "status": "pending",
                    "requested_start": {"$lt": window_end_utc},
                    "requested_end": {"$gt": window_start_utc},
                }
            ).to_list(length=200)
            busy_ranges.extend(
                (item["requested_start"].replace(tzinfo=timezone.utc), item["requested_end"].replace(tzinfo=timezone.utc))
                for item in pending
                if isinstance(item.get("requested_start"), datetime) and isinstance(item.get("requested_end"), datetime)
            )

        exclude_datetimes = exclude_datetimes or set()
        # Only guard against offering an already-passed time *today* — a slot on any
        # other queried day is never in the past relative to "now" in practice (callers
        # are only ever scanned forward from today), and unconditionally comparing
        # against wall-clock time here would also reject explicit past/future dates
        # callers may legitimately query directly.
        now_local = self._now(tz)
        is_today = day == now_local.date()
        free: list[str] = []
        for slot_start in candidates:
            if is_today and slot_start <= now_local:
                continue
            label = slot_start.strftime("%H:%M")
            if f"{day.isoformat()} {label}" in exclude_datetimes:
                continue
            slot_end = slot_start + timedelta(minutes=slot_minutes)
            slot_start_utc = slot_start.astimezone(timezone.utc)
            slot_end_utc = slot_end.astimezone(timezone.utc)
            if any(busy_start < slot_end_utc and busy_end > slot_start_utc for busy_start, busy_end in busy_ranges):
                continue
            free.append(label)
        return free

    @staticmethod
    def _now(tz) -> datetime:
        return datetime.now(tz)

    @staticmethod
    def _resolve_zoneinfo(name: str | None):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            return ZoneInfo(name or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            return ZoneInfo("UTC")

    async def localize_business_slot(self, user_id: str, date_str: str, time_str: str) -> datetime:
        """Convert a "HH:MM" business-local slot (as returned by find_free_slots) into
        the UTC instant everything else in this codebase stores. Needed because the
        slot strings are deliberately local — that's what should be spoken to a caller
        and shown in the business-hours UI, not a UTC-shifted number."""
        hours = await self.get_business_hours(user_id)
        tz = self._resolve_zoneinfo(hours.get("timezone"))
        year, month, day = (int(part) for part in date_str.split("-"))
        hour, minute = (int(part) for part in time_str.split(":"))
        local_dt = datetime(year, month, day, hour, minute, tzinfo=tz)
        return local_dt.astimezone(timezone.utc)

    async def find_next_available_slot(
        self, user_id: str, *, days_ahead: int = 7, exclude_datetimes: set[str] | None = None
    ) -> dict | None:
        """First open slot starting today, scanning forward — used by the AI phone
        agent so it always has something concrete to offer instead of asking the
        caller to pick a day blind. Pass previously-declined slots via
        ``exclude_datetimes`` so a caller who says no isn't offered the same time again."""
        hours = await self.get_business_hours(user_id)
        tz = self._resolve_zoneinfo(hours.get("timezone"))
        today = self._now(tz).date()
        for offset in range(days_ahead):
            candidate_day = today + timedelta(days=offset)
            slots = await self.find_free_slots(user_id, candidate_day, exclude_datetimes=exclude_datetimes)
            if slots:
                return {"date": candidate_day.isoformat(), "time": slots[0]}
        return None

    async def get_calendar_event(self, user_id: str, event_id: str) -> dict:
        event = await self._get_owned_document(self.db.calendar_events, user_id, event_id, "EVENT_NOT_FOUND")
        return await self._serialize_calendar_event(event)

    async def create_calendar_event(self, user_id: str, payload: dict) -> dict:
        self._validate_calendar_event_payload(payload)
        await self._assert_calendar_slot_available(user_id, payload["starts_at"], payload["ends_at"])
        provider_settings = await self.get_calendar_provider_settings(user_id)
        primary = provider_settings["primary_calendar_provider"]
        connected = provider_settings["connected"]
        # Leave meeting_link empty for online meetings when a real-link-capable
        # provider is available: the provider's own create call only requests a real
        # conference link when none was pre-filled, so setting one here would replace
        # it with a local placeholder before the provider ever gets a chance.
        needs_meet_link = payload.get("meeting_mode") == "online" and not payload.get("meeting_link")
        google_event = None
        zoom_meeting = None

        if primary == "google_business":
            try:
                google_event = await self.google_calendar_service.create_remote_event(user_id, payload)
            except AppException:
                google_event = None
                payload["sync_status"] = "error"
        elif primary == "zoom":
            try:
                zoom_meeting = await self.zoom_calendar_service.create_remote_event(user_id, payload)
            except AppException:
                zoom_meeting = None
                payload["sync_status"] = "error"
        elif needs_meet_link:
            # Not the primary synced calendar, but still connected purely to mint a
            # real meeting link — Zoom preferred over Google if both are connected
            # this way (arbitrary but stable tie-break; either produces a real link).
            if connected.get("zoom"):
                try:
                    zoom_meeting = await self.zoom_calendar_service.create_remote_event(user_id, payload)
                except AppException:
                    zoom_meeting = None
            elif connected.get("google_business"):
                try:
                    google_event = await self.google_calendar_service.create_remote_event(user_id, payload)
                except AppException:
                    google_event = None

        if google_event:
            if needs_meet_link:
                payload["meeting_link"] = self.google_calendar_service._extract_meeting_link(google_event)
            if primary == "google_business":
                payload["google_event_id"] = google_event.get("id")
                payload["sync_status"] = "synced"
                payload["calendar_source"] = "mabdel_google_sync"
                payload["provider_metadata"] = {
                    "integration_platform": "google_business",
                    "google_html_link": google_event.get("htmlLink"),
                    "google_status": google_event.get("status"),
                    "google_recurrence": google_event.get("recurrence") or [],
                    "google_updated": google_event.get("updated"),
                    "google_etag": google_event.get("etag"),
                }
        if zoom_meeting:
            if needs_meet_link:
                payload["meeting_link"] = self.zoom_calendar_service._extract_meeting_link(zoom_meeting)
            if primary == "zoom":
                payload["zoom_meeting_id"] = str(zoom_meeting.get("id"))
                payload["sync_status"] = "synced"
                payload["calendar_source"] = "mabdel_zoom_sync"
                payload["provider_metadata"] = {
                    "integration_platform": "zoom",
                    "zoom_join_url": zoom_meeting.get("join_url"),
                    "zoom_start_url": zoom_meeting.get("start_url"),
                }
        if payload.get("meeting_mode") == "online" and not payload.get("meeting_link"):
            payload["meeting_link"] = self._generate_meeting_link()
        document = {
            "user_id": user_id,
            **payload,
            "sync_status": payload.get("sync_status")
            or ("synced" if payload.get("google_event_id") or payload.get("zoom_meeting_id") else "local"),
            "share_token": None,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        if primary == "caldav":
            try:
                caldav_uid = await self.caldav_service.push_event(user_id, document)
            except AppException:
                caldav_uid = None
                document["sync_status"] = "error"
            if caldav_uid:
                document["caldav_uid"] = caldav_uid
                document["sync_status"] = "synced"
                document["calendar_source"] = "caldav_sync"
        result = await self.db.calendar_events.insert_one(document)
        document["_id"] = result.inserted_id
        await self._create_calendar_event_notifications(user_id, document, action="created")
        return await self._serialize_calendar_event(document)

    async def update_calendar_event(self, user_id: str, event_id: str, updates: dict) -> dict:
        event = await self._get_owned_document(self.db.calendar_events, user_id, event_id, "EVENT_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        merged = {**event, **clean_updates}
        self._validate_calendar_event_payload(merged)
        await self._assert_calendar_slot_available(
            user_id,
            merged["starts_at"],
            merged["ends_at"],
            exclude_event_id=str(event["_id"]),
        )
        provider_settings = await self.get_calendar_provider_settings(user_id)
        primary = provider_settings["primary_calendar_provider"]
        connected = provider_settings["connected"]
        google_event = None
        zoom_meeting = None
        google_event_id = event.get("google_event_id")
        zoom_meeting_id = event.get("zoom_meeting_id")
        needs_meet_link = merged.get("meeting_mode") == "online" and not merged.get("meeting_link")

        if primary == "google_business":
            try:
                if google_event_id:
                    google_event = await self.google_calendar_service.update_remote_event(user_id, google_event_id, merged)
                else:
                    google_event = await self.google_calendar_service.create_remote_event(user_id, merged)
                    if google_event:
                        clean_updates["google_event_id"] = google_event.get("id")
                        google_event_id = google_event.get("id")
            except AppException:
                google_event = None
                clean_updates["sync_status"] = "error"
        elif primary == "zoom":
            try:
                if zoom_meeting_id:
                    zoom_meeting = await self.zoom_calendar_service.update_remote_event(user_id, zoom_meeting_id, merged)
                else:
                    zoom_meeting = await self.zoom_calendar_service.create_remote_event(user_id, merged)
                    if zoom_meeting:
                        clean_updates["zoom_meeting_id"] = str(zoom_meeting.get("id"))
                        zoom_meeting_id = zoom_meeting.get("id")
            except AppException:
                zoom_meeting = None
                clean_updates["sync_status"] = "error"
        elif needs_meet_link:
            if connected.get("zoom"):
                try:
                    zoom_meeting = await self.zoom_calendar_service.create_remote_event(user_id, merged)
                except AppException:
                    zoom_meeting = None
            elif connected.get("google_business"):
                try:
                    google_event = await self.google_calendar_service.create_remote_event(user_id, merged)
                except AppException:
                    google_event = None
        if google_event:
            if needs_meet_link:
                real_link = self.google_calendar_service._extract_meeting_link(google_event)
                if real_link:
                    clean_updates["meeting_link"] = real_link
                    merged["meeting_link"] = real_link
            if primary == "google_business":
                clean_updates["sync_status"] = "synced"
                clean_updates["calendar_source"] = "mabdel_google_sync"
                clean_updates["provider_metadata"] = {
                    "integration_platform": "google_business",
                    "google_html_link": google_event.get("htmlLink"),
                    "google_status": google_event.get("status"),
                    "google_recurrence": google_event.get("recurrence") or [],
                    "google_updated": google_event.get("updated"),
                    "google_etag": google_event.get("etag"),
                }
        if zoom_meeting:
            if needs_meet_link:
                real_link = self.zoom_calendar_service._extract_meeting_link(zoom_meeting)
                if real_link:
                    clean_updates["meeting_link"] = real_link
                    merged["meeting_link"] = real_link
            if primary == "zoom":
                clean_updates["sync_status"] = "synced"
                clean_updates["calendar_source"] = "mabdel_zoom_sync"
                clean_updates["provider_metadata"] = {
                    "integration_platform": "zoom",
                    "zoom_join_url": zoom_meeting.get("join_url"),
                    "zoom_start_url": zoom_meeting.get("start_url"),
                }
        if merged.get("meeting_mode") == "online" and not merged.get("meeting_link"):
            clean_updates["meeting_link"] = self._generate_meeting_link()
            merged["meeting_link"] = clean_updates["meeting_link"]
        if "google_event_id" in clean_updates and primary == "google_business":
            clean_updates["sync_status"] = "synced" if clean_updates["google_event_id"] else "local"
        if "zoom_meeting_id" in clean_updates and primary == "zoom":
            clean_updates["sync_status"] = "synced" if clean_updates["zoom_meeting_id"] else "local"
        if primary == "caldav":
            try:
                caldav_uid = await self.caldav_service.push_event(
                    user_id, {**merged, **clean_updates, "caldav_uid": event.get("caldav_uid")}
                )
            except AppException:
                caldav_uid = None
                clean_updates["sync_status"] = "error"
            if caldav_uid:
                clean_updates["caldav_uid"] = caldav_uid
                clean_updates["sync_status"] = "synced"
                clean_updates["calendar_source"] = "caldav_sync"
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.calendar_events.find_one_and_update(
            {"_id": event["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        if updated:
            await self._create_calendar_event_notifications(user_id, updated, action="updated")
        return await self._serialize_calendar_event(updated)

    async def share_calendar_event(self, user_id: str, event_id: str, payload: dict) -> dict:
        event = await self._get_owned_document(self.db.calendar_events, user_id, event_id, "EVENT_NOT_FOUND")
        if not event.get("share_token"):
            event["share_token"] = secrets.token_urlsafe(18)
            await self.db.calendar_events.update_one(
                {"_id": event["_id"]},
                {"$set": {"share_token": event["share_token"], "updated_at": utc_now()}},
            )
        share_url = self._calendar_share_url(event["share_token"])
        recipient_email = payload.get("recipient_email")
        if payload.get("channel") == "email":
            if not recipient_email:
                raise AppException(status_code=400, code="RECIPIENT_EMAIL_REQUIRED", message="Recipient email is required for email sharing.")
            subject = f"Meeting invite: {event['title']}"
            text = self._calendar_share_text(event, payload.get("message"), share_url)
            html = self._calendar_share_html(event, payload.get("message"), share_url)
            await EmailService().send_invoice_email(email=recipient_email, subject=subject, text=text, html=html)
        await self._create_calendar_event_notifications(user_id, event, action="shared")
        return {
            "event_id": str(event["_id"]),
            "channel": payload.get("channel", "link"),
            "recipient_email": recipient_email,
            "share_url": share_url,
        }

    async def delete_calendar_event(self, user_id: str, event_id: str) -> None:
        event = await self._get_owned_document(self.db.calendar_events, user_id, event_id, "EVENT_NOT_FOUND")
        if event.get("google_event_id"):
            await self.google_calendar_service.delete_remote_event(user_id, event.get("google_event_id"))
        if event.get("zoom_meeting_id"):
            await self.zoom_calendar_service.delete_remote_event(user_id, event.get("zoom_meeting_id"))
        if event.get("caldav_uid"):
            await self.caldav_service.delete_event(user_id, event.get("caldav_uid"))
        await self.db.calendar_events.delete_one({"_id": event["_id"]})
