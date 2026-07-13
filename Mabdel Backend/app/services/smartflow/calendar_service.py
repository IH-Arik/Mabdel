from __future__ import annotations

import secrets
from datetime import date, datetime

from app.core.exceptions import AppException
from app.services.email_service import EmailService
from app.utils.helpers import utc_now
from pymongo import ReturnDocument

from ._base import SmartFlowBase
from .google_calendar_service import GoogleCalendarService


class CalendarService(SmartFlowBase):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.google_calendar_service = GoogleCalendarService(db)

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

    async def find_free_slots(self, user_id: str, day: date) -> list[str]:
        # Simple implementation: 9 AM to 5 PM, 1 hour slots
        start_of_day = datetime.combine(day, datetime.min.time())
        end_of_day = datetime.combine(day, datetime.max.time())

        events = await self.db.calendar_events.find({
            "user_id": user_id,
            "starts_at": {"$gte": start_of_day, "$lte": end_of_day}
        }).to_list(length=100)

        # Mock available slots for now
        all_slots = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
        busy_slots = []
        for event in events:
            if "starts_at" in event and isinstance(event["starts_at"], datetime):
                busy_slots.append(event["starts_at"].strftime("%H:%M"))

        return [slot for slot in all_slots if slot not in busy_slots]

    async def get_calendar_event(self, user_id: str, event_id: str) -> dict:
        event = await self._get_owned_document(self.db.calendar_events, user_id, event_id, "EVENT_NOT_FOUND")
        return await self._serialize_calendar_event(event)

    async def create_calendar_event(self, user_id: str, payload: dict) -> dict:
        self._validate_calendar_event_payload(payload)
        await self._assert_calendar_slot_available(user_id, payload["starts_at"], payload["ends_at"])
        if payload.get("meeting_mode") == "online" and not payload.get("meeting_link"):
            payload["meeting_link"] = self._generate_meeting_link()
        google_event = await self.google_calendar_service.create_remote_event(user_id, payload)
        if google_event:
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
        document = {
            "user_id": user_id,
            **payload,
            "sync_status": payload.get("sync_status") or ("synced" if payload.get("google_event_id") else "local"),
            "share_token": None,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
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
        if merged.get("meeting_mode") == "online" and not merged.get("meeting_link"):
            clean_updates["meeting_link"] = self._generate_meeting_link()
            merged["meeting_link"] = clean_updates["meeting_link"]
        google_event = None
        google_event_id = event.get("google_event_id")
        if google_event_id:
            google_event = await self.google_calendar_service.update_remote_event(user_id, google_event_id, merged)
        else:
            google_event = await self.google_calendar_service.create_remote_event(user_id, merged)
            if google_event:
                clean_updates["google_event_id"] = google_event.get("id")
                google_event_id = google_event.get("id")
        if google_event:
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
        if "google_event_id" in clean_updates:
            clean_updates["sync_status"] = "synced" if clean_updates["google_event_id"] else "local"
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
        await self.db.calendar_events.delete_one({"_id": event["_id"]})
