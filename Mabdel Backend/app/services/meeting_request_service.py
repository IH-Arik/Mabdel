from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.email_service import EmailService
from app.services.smartflow.google_calendar_service import GoogleCalendarService

PROPOSAL_TOKEN_EXPIRE_DAYS = 14


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _fmt(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.strftime("%A, %B %d, %Y at %I:%M %p UTC")


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "first_name": doc.get("first_name", ""),
        "last_name": doc.get("last_name", ""),
        "email": doc.get("email", ""),
        "phone": doc.get("phone", ""),
        "notes": doc.get("notes", ""),
        "status": doc.get("status", "pending"),
        "requested_start": doc.get("requested_start"),
        "requested_end": doc.get("requested_end"),
        "confirmed_start": doc.get("confirmed_start"),
        "confirmed_end": doc.get("confirmed_end"),
        "meeting_link": doc.get("meeting_link"),
        "proposal": doc.get("proposal"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


class MeetingRequestService:
    def __init__(self, db: AsyncIOMotorDatabase, email_service: EmailService | None = None) -> None:
        self.db = db
        self.email_service = email_service or EmailService()
        self.google_calendar_service = GoogleCalendarService(db)

    # ------------------------------------------------------------------
    # Public submit / listing
    # ------------------------------------------------------------------

    async def create_meeting_request(self, payload: dict) -> dict:
        now = _utc_now()
        document = {
            "first_name": payload["first_name"].strip(),
            "last_name": payload["last_name"].strip(),
            "email": str(payload["email"]).strip().lower(),
            "phone": (payload.get("phone") or "").strip(),
            "notes": (payload.get("notes") or "").strip(),
            "status": "pending",
            "requested_start": payload["requested_start"],
            "requested_end": payload["requested_end"],
            "confirmed_start": None,
            "confirmed_end": None,
            "meeting_link": None,
            "proposal": None,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.meeting_requests.insert_one(document)
        document["_id"] = result.inserted_id
        await self._notify_admins(document)
        return _serialize(document)

    async def create_confirmed_booking(
        self, *, admin_id: str, admin_name: str, payload: dict, start: datetime, end: datetime
    ) -> dict:
        """Instant booking against a pre-declared availability slot — skips the
        pending/review step since the admin already signaled they're free."""
        now = _utc_now()
        document = {
            "first_name": payload["first_name"].strip(),
            "last_name": payload["last_name"].strip(),
            "email": str(payload["email"]).strip().lower(),
            "phone": (payload.get("phone") or "").strip(),
            "notes": (payload.get("notes") or "").strip(),
            "status": "confirmed",
            "requested_start": start,
            "requested_end": end,
            "confirmed_start": start,
            "confirmed_end": end,
            "meeting_link": None,
            "proposal": None,
            "confirmed_by": {"admin_id": admin_id, "admin_name": admin_name},
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.meeting_requests.insert_one(document)
        document["_id"] = result.inserted_id

        meeting_link = await self._create_calendar_event(
            admin_id=admin_id,
            requester_name=f"{document['first_name']} {document['last_name']}".strip(),
            requester_email=document["email"],
            start=start,
            end=end,
            notes=document.get("notes"),
        )
        if meeting_link:
            document["meeting_link"] = meeting_link
            await self.db.meeting_requests.update_one({"_id": document["_id"]}, {"$set": {"meeting_link": meeting_link}})

        await self._send_confirmation_email(document)
        return _serialize(document)

    async def list_meeting_requests(self, page: int, page_size: int, status_filter: str | None) -> dict:
        filters: dict = {}
        if status_filter and status_filter != "all":
            filters["status"] = status_filter
        total = await self.db.meeting_requests.count_documents(filters)
        cursor = (
            self.db.meeting_requests.find(filters)
            .sort("created_at", -1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = [_serialize(doc) for doc in await cursor.to_list(length=page_size)]
        return {
            "items": items,
            "pagination": {"page": page, "page_size": page_size, "total": total},
            "summary": {
                "total": await self.db.meeting_requests.count_documents({}),
                "pending": await self.db.meeting_requests.count_documents({"status": "pending"}),
                "proposed": await self.db.meeting_requests.count_documents({"status": "proposed"}),
                "confirmed": await self.db.meeting_requests.count_documents({"status": "confirmed"}),
            },
        }

    async def get_meeting_request(self, request_id: str) -> dict:
        return _serialize(await self._get_or_404(request_id))

    # ------------------------------------------------------------------
    # Admin actions
    # ------------------------------------------------------------------

    async def accept_meeting_request(self, request_id: str, admin_id: str, admin_name: str) -> dict:
        doc = await self._get_or_404(request_id)
        start, end = doc["requested_start"], doc["requested_end"]
        meeting_link = await self._create_calendar_event(
            admin_id=admin_id,
            requester_name=f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip(),
            requester_email=doc["email"],
            start=start,
            end=end,
            notes=doc.get("notes"),
        )
        now = _utc_now()
        updated = await self.db.meeting_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "status": "confirmed",
                    "confirmed_start": start,
                    "confirmed_end": end,
                    "meeting_link": meeting_link,
                    "confirmed_by": {"admin_id": admin_id, "admin_name": admin_name},
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self._send_confirmation_email(updated)
        return _serialize(updated)

    async def propose_new_time(
        self, request_id: str, admin_id: str, admin_name: str, proposed_start: datetime, proposed_end: datetime, note: str | None
    ) -> dict:
        doc = await self._get_or_404(request_id)
        token = secrets.token_urlsafe(24)
        now = _utc_now()
        proposal = {
            "admin_id": admin_id,
            "admin_name": admin_name,
            "proposed_start": proposed_start,
            "proposed_end": proposed_end,
            "note": (note or "").strip(),
            "token": token,
            "expires_at": now + timedelta(days=PROPOSAL_TOKEN_EXPIRE_DAYS),
            "created_at": now,
        }
        updated = await self.db.meeting_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {"$set": {"status": "proposed", "proposal": proposal, "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        await self._send_proposal_email(updated)
        return _serialize(updated)

    async def decline_meeting_request(self, request_id: str, admin_id: str) -> dict:
        doc = await self._get_or_404(request_id)
        updated = await self.db.meeting_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {"$set": {"status": "declined", "updated_at": _utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return _serialize(updated)

    # ------------------------------------------------------------------
    # Public proposal confirmation (no login)
    # ------------------------------------------------------------------

    async def get_proposal_by_token(self, token: str) -> dict:
        doc = await self._get_pending_proposal(token)
        return _serialize(doc)

    async def confirm_proposal(self, token: str) -> dict:
        doc = await self._get_pending_proposal(token)
        proposal = doc["proposal"]
        start, end = proposal["proposed_start"], proposal["proposed_end"]
        meeting_link = await self._create_calendar_event(
            admin_id=proposal["admin_id"],
            requester_name=f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip(),
            requester_email=doc["email"],
            start=start,
            end=end,
            notes=doc.get("notes"),
        )
        now = _utc_now()
        updated = await self.db.meeting_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "status": "confirmed",
                    "confirmed_start": start,
                    "confirmed_end": end,
                    "meeting_link": meeting_link,
                    "confirmed_by": {"admin_id": proposal["admin_id"], "admin_name": proposal["admin_name"]},
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self._send_confirmation_email(updated)
        return _serialize(updated)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_404(self, request_id: str) -> dict:
        if not ObjectId.is_valid(request_id):
            raise AppException(status_code=404, code="MEETING_REQUEST_NOT_FOUND", message="Meeting request was not found.")
        doc = await self.db.meeting_requests.find_one({"_id": ObjectId(request_id)})
        if not doc:
            raise AppException(status_code=404, code="MEETING_REQUEST_NOT_FOUND", message="Meeting request was not found.")
        return doc

    async def _get_pending_proposal(self, token: str) -> dict:
        doc = await self.db.meeting_requests.find_one({"proposal.token": token})
        if not doc:
            raise AppException(status_code=404, code="MEETING_PROPOSAL_NOT_FOUND", message="This scheduling link was not found.")
        if doc.get("status") == "confirmed":
            raise AppException(status_code=409, code="MEETING_ALREADY_CONFIRMED", message="This meeting has already been confirmed.")
        proposal = doc.get("proposal") or {}
        expires_at = proposal.get("expires_at")
        now = _utc_now()
        if expires_at and getattr(expires_at, "tzinfo", None) is None:
            now = now.replace(tzinfo=None)
        if expires_at and expires_at < now:
            raise AppException(status_code=410, code="MEETING_PROPOSAL_EXPIRED", message="This scheduling link has expired.")
        return doc

    async def _create_calendar_event(
        self, *, admin_id: str, requester_name: str, requester_email: str, start: datetime, end: datetime, notes: str | None
    ) -> str | None:
        payload = {
            "title": f"GoCustify AI Demo with {requester_name}",
            "starts_at": start,
            "ends_at": end,
            "description": notes or "Demo request booked via the GoCustify AI website.",
            "meeting_mode": "online",
            "timezone": "UTC",
            "reminder_minutes": 15,
            "google_attendees": [{"email": requester_email, "displayName": requester_name}],
        }
        try:
            google_event = await self.google_calendar_service.create_remote_event(admin_id, payload)
        except AppException:
            google_event = None
        if not google_event:
            return None

        meeting_link = GoogleCalendarService._extract_meeting_link(google_event)
        await self.db.calendar_events.insert_one(
            {
                "user_id": admin_id,
                "title": payload["title"],
                "starts_at": start,
                "ends_at": end,
                "description": payload["description"],
                "location": None,
                "meeting_mode": "online",
                "meeting_link": meeting_link,
                "timezone": "UTC",
                "reminder_minutes": 15,
                "contact_ids": [],
                "google_event_id": google_event.get("id"),
                "sync_status": "synced",
                "calendar_source": "mabdel_google_sync",
                "provider_metadata": {
                    "integration_platform": "google_business",
                    "google_html_link": google_event.get("htmlLink"),
                    "google_status": google_event.get("status"),
                },
                "share_token": None,
                "created_at": _utc_now(),
                "updated_at": _utc_now(),
            }
        )
        return meeting_link

    async def _send_confirmation_email(self, doc: dict) -> None:
        name = doc.get("first_name", "")
        when = _fmt(doc.get("confirmed_start"))
        link = doc.get("meeting_link")
        link_html = f'<p><a href="{link}">{link}</a></p>' if link else "<p>We'll share the video call link shortly.</p>"
        link_text = link if link else "We'll share the video call link shortly."
        subject = "Your GoCustify AI Demo is Confirmed"
        text = f"Hi {name},\n\nYour demo is confirmed for {when}.\n\n{link_text}\n\n— The GoCustify AI Team"
        html = f"<p>Hi {name},</p><p>Your demo is confirmed for <strong>{when}</strong>.</p>{link_html}<p>— The GoCustify AI Team</p>"
        await self.email_service.send_invoice_email(email=doc["email"], subject=subject, text=text, html=html)

    async def _send_proposal_email(self, doc: dict) -> None:
        proposal = doc["proposal"]
        name = doc.get("first_name", "")
        when = _fmt(proposal["proposed_start"])
        note = proposal.get("note")
        confirm_url = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}/api/v1/public/meeting-requests/confirm/{proposal['token']}"
        subject = "New time proposed for your GoCustify AI Demo"
        note_text = f"\n\nNote from {proposal['admin_name']}: {note}" if note else ""
        note_html = f"<p><em>{note}</em></p>" if note else ""
        text = (
            f"Hi {name},\n\nWe couldn't confirm your original requested time, but we'd love to meet you.\n"
            f"Proposed new time: {when}{note_text}\n\nConfirm this time: {confirm_url}\n\n— The GoCustify AI Team"
        )
        html = (
            f"<p>Hi {name},</p><p>We couldn't confirm your original requested time, but we'd love to meet you.</p>"
            f"<p>Proposed new time: <strong>{when}</strong></p>{note_html}"
            f'<p><a href="{confirm_url}">Confirm this time</a></p><p>— The GoCustify AI Team</p>'
        )
        await self.email_service.send_invoice_email(email=doc["email"], subject=subject, text=text, html=html)

    async def _notify_admins(self, doc: dict) -> None:
        admins = await self.db.users.find(
            {"role": {"$in": ["admin", "super_admin"]}}, {"_id": 1}
        ).to_list(length=200)
        if not admins:
            return
        now = _utc_now()
        name = f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip()
        when = _fmt(doc.get("requested_start"))
        notifications = [
            {
                "user_id": str(admin["_id"]),
                "type": "meeting_request",
                "title": "New meeting request",
                "message": f"{name or doc.get('email')} requested a meeting for {when}.",
                "is_read": False,
                "created_at": now,
            }
            for admin in admins
        ]
        await self.db.notifications.insert_many(notifications)
