from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.services.call_service import CallService
from app.services.email_service import EmailService
from app.utils.helpers import resolve_organization_user_ids, utc_now

from ._base import SmartFlowBase
from .calendar_service import CalendarService


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "organization_id": doc["organization_id"],
        "call_sid": doc.get("call_sid"),
        "caller_name": doc.get("caller_name", ""),
        "caller_email": doc.get("caller_email"),
        "caller_phone": doc.get("caller_phone"),
        "requested_start": doc.get("requested_start"),
        "requested_end": doc.get("requested_end"),
        "status": doc.get("status", "pending"),
        "meeting_link": doc.get("meeting_link"),
        "confirmed_by_user_id": doc.get("confirmed_by_user_id"),
        "kind": doc.get("kind", "new"),
        "calendar_event_id": doc.get("calendar_event_id"),
        "provider_id": doc.get("provider_id"),
        "provider_name": doc.get("provider_name"),
        "appointment_type_id": doc.get("appointment_type_id"),
        "appointment_type_name": doc.get("appointment_type_name"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


class CallMeetingRequestService(SmartFlowBase):
    """Meeting requests the AI phone agent proposes on a live call, pending a real
    team member's approval — distinct from the platform's own admin_availability_slots/
    meeting_requests system (that one is GoCustify's own sales-demo booking widget, not
    something individual businesses share)."""

    def __init__(self, db) -> None:
        super().__init__(db)
        self.calendar_service = CalendarService(db)
        self.email_service = EmailService()
        self.call_service = CallService()

    async def create_pending_request_for_user(
        self,
        user_id: str,
        *,
        call_sid: str | None,
        caller_name: str,
        caller_email: str | None,
        caller_phone: str | None,
        requested_start: datetime,
        requested_end: datetime,
    ) -> dict:
        """Convenience wrapper for internal callers (the AI phone agent) that only
        have a user_id — e.g. the org owner the incoming call was attributed to —
        not the organization_id directly."""
        organization_id = await self._require_organization_id(user_id)
        return await self.create_pending_request(
            organization_id=organization_id,
            call_sid=call_sid,
            caller_name=caller_name,
            caller_email=caller_email,
            caller_phone=caller_phone,
            requested_start=requested_start,
            requested_end=requested_end,
        )

    async def book_or_request_meeting_for_user(
        self,
        user_id: str,
        *,
        call_sid: str | None,
        caller_name: str,
        caller_email: str | None,
        caller_phone: str | None,
        requested_start: datetime,
        requested_end: datetime,
        language: str | None = None,
        provider: dict | None = None,
        appointment_type: dict | None = None,
    ) -> dict:
        """Attempts direct calendar booking when available, falling back to creating
        a pending request if manual approval is required or missing details."""
        organization_id = await self._require_organization_id(user_id)
        has_contact_info = bool(caller_name and (caller_email or caller_phone))

        if not await self.approval_required(organization_id) and has_contact_info:
            try:
                event = await self._create_customer_event(
                    user_id,
                    caller_name=caller_name,
                    caller_email=caller_email,
                    caller_phone=caller_phone,
                    starts_at=requested_start,
                    ends_at=requested_end,
                    language=language,
                    note="Booked by the AI receptionist during a call.",
                    provider=provider,
                    appointment_type=appointment_type,
                )
                now = utc_now()
                doc = {
                    "organization_id": organization_id,
                    "call_sid": call_sid,
                    "caller_name": caller_name.strip() or "Phone caller",
                    "caller_email": (caller_email or "").strip().lower() or None,
                    "caller_phone": caller_phone,
                    "requested_start": requested_start,
                    "requested_end": requested_end,
                    "status": "confirmed",
                    "kind": "new",
                    "language": language,
                    "meeting_link": event.get("meeting_link"),
                    "calendar_event_id": event["id"],
                    "confirmed_by_user_id": "ai_agent",
                    "provider_id": (provider or {}).get("id"),
                    "provider_name": (provider or {}).get("name"),
                    "appointment_type_id": (appointment_type or {}).get("id"),
                    "appointment_type_name": (appointment_type or {}).get("name"),
                    "created_at": now,
                    "updated_at": now,
                }
                result = await self.db.call_meeting_requests.insert_one(doc)
                doc["_id"] = result.inserted_id
                await self.db.calendar_events.update_one(
                    {"_id": ObjectId(event["id"])}, {"$set": {"call_meeting_request_id": str(doc["_id"])}}
                )
                if doc.get("caller_email"):
                    await self._send_confirmation_email(doc)
                await self._text_customer(user_id, doc, "booked")
                await self._notify_organization(doc)
                serialized = _serialize(doc)
                serialized["booking_outcome"] = "booked"
                return serialized
            except AppException as exc:
                if exc.code == "CALL_MEETING_REQUEST_SLOT_TAKEN" or exc.code == "CALENDAR_CONFLICT":
                    return {"status": "conflict", "booking_outcome": "conflict"}

        pending_doc = await self.create_pending_request(
            organization_id=organization_id,
            call_sid=call_sid,
            caller_name=caller_name,
            caller_email=caller_email,
            caller_phone=caller_phone,
            requested_start=requested_start,
            requested_end=requested_end,
            language=language,
            provider_id=(provider or {}).get("id"),
            provider_name=(provider or {}).get("name"),
            appointment_type_id=(appointment_type or {}).get("id"),
            appointment_type_name=(appointment_type or {}).get("name"),
        )
        pending_doc["booking_outcome"] = "pending"
        return pending_doc

    async def approval_required(self, organization_id: str | None) -> bool:
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        return bool((org or {}).get("require_meeting_approval", False))

    async def _create_customer_event(
        self,
        user_id: str,
        *,
        caller_name: str,
        caller_email: str | None,
        caller_phone: str | None,
        starts_at: datetime,
        ends_at: datetime,
        language: str | None,
        note: str,
        provider: dict | None = None,
        appointment_type: dict | None = None,
    ) -> dict:
        """A calendar event that knows who the customer is - so a later change or
        cancellation, by the AI or a team member, can text them."""
        from .appointment_notifications import AppointmentNotifier

        phone = self._normalize_phone_value(caller_phone or "") or None
        contact_id = await AppointmentNotifier(self.db).sms_contact_id(user_id, phone, caller_name) if phone else None
        title = f"Appointment with {caller_name}"
        if appointment_type:
            title = f"{appointment_type['name']} with {caller_name}"
        if provider:
            title += f" ({provider['name']})"
        return await self.calendar_service.create_calendar_event(
            user_id,
            {
                "title": title,
                "description": f"{note} Caller: {caller_name}" + (f" ({phone})" if phone else ""),
                "starts_at": starts_at,
                "ends_at": ends_at,
                "meeting_mode": "online",
                "contact_ids": [contact_id] if contact_id else [],
                "source": "ai_call",
                "provider_id": (provider or {}).get("id"),
                "appointment_type_id": (appointment_type or {}).get("id"),
                "customer": {
                    "name": caller_name,
                    "phone": phone,
                    "email": (caller_email or "").strip().lower() or None,
                    "contact_id": contact_id,
                    "language": language,
                },
            },
        )

    async def create_pending_request(
        self,
        *,
        organization_id: str,
        call_sid: str | None,
        caller_name: str,
        caller_email: str | None,
        caller_phone: str | None,
        requested_start: datetime,
        requested_end: datetime,
        language: str | None = None,
        kind: str = "new",
        calendar_event_id: str | None = None,
        provider_id: str | None = None,
        provider_name: str | None = None,
        appointment_type_id: str | None = None,
        appointment_type_name: str | None = None,
    ) -> dict:
        now = utc_now()
        document = {
            "organization_id": organization_id,
            "call_sid": call_sid,
            "caller_name": caller_name.strip() or "Phone caller",
            "caller_email": (caller_email or "").strip().lower() or None,
            "caller_phone": caller_phone,
            "requested_start": requested_start,
            "requested_end": requested_end,
            "status": "pending",
            "kind": kind,
            "language": language,
            "calendar_event_id": calendar_event_id,
            "provider_id": provider_id,
            "provider_name": provider_name,
            "appointment_type_id": appointment_type_id,
            "appointment_type_name": appointment_type_name,
            "meeting_link": None,
            "confirmed_by_user_id": None,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.call_meeting_requests.insert_one(document)
        document["_id"] = result.inserted_id
        await self._text_customer(await self._org_owner_id(organization_id), document, "pending")
        await self._notify_organization(document)
        return _serialize(document)

    async def list_pending(self, user_id: str, page: int, page_size: int, status_filter: str | None) -> dict:
        organization_id = await self._require_organization_id(user_id)
        filters: dict = {"organization_id": organization_id}
        if status_filter and status_filter != "all":
            filters["status"] = status_filter
        total = await self.db.call_meeting_requests.count_documents(filters)
        cursor = (
            self.db.call_meeting_requests.find(filters)
            .sort("requested_start", 1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = [_serialize(doc) async for doc in cursor]
        return {
            "items": items,
            "pagination": {"page": page, "page_size": page_size, "total": total},
            "pending_count": await self.db.call_meeting_requests.count_documents(
                {"organization_id": organization_id, "status": "pending"}
            ),
        }

    async def accept(self, user_id: str, request_id: str) -> dict:
        doc = await self._get_org_request(user_id, request_id)
        if doc["status"] != "pending":
            raise AppException(
                status_code=409,
                code="CALL_MEETING_REQUEST_NOT_PENDING",
                message="This request has already been handled.",
            )

        try:
            if doc.get("kind") == "reschedule" and doc.get("calendar_event_id"):
                event = await self.calendar_service.update_calendar_event(
                    user_id,
                    doc["calendar_event_id"],
                    {"starts_at": doc["requested_start"], "ends_at": doc["requested_end"]},
                    notify_customer=False,
                )
            else:
                event = await self._create_customer_event(
                    user_id,
                    caller_name=doc["caller_name"],
                    caller_email=doc.get("caller_email"),
                    caller_phone=doc.get("caller_phone"),
                    starts_at=doc["requested_start"],
                    ends_at=doc["requested_end"],
                    language=doc.get("language"),
                    note="Booked from an AI phone call.",
                    provider={"id": doc["provider_id"], "name": doc.get("provider_name")} if doc.get("provider_id") else None,
                    appointment_type={"id": doc["appointment_type_id"], "name": doc.get("appointment_type_name")}
                    if doc.get("appointment_type_id")
                    else None,
                )
        except AppException as exc:
            if exc.code == "CALENDAR_CONFLICT":
                # The pending-request soft-hold (find_free_slots excludes other pending
                # requests) prevents this in the common case; this only fires if
                # something else took the slot in the meantime.
                raise AppException(
                    status_code=409,
                    code="CALL_MEETING_REQUEST_SLOT_TAKEN",
                    message="This time is no longer available — it was booked elsewhere in the meantime. Decline this request and follow up with the caller directly.",
                ) from exc
            raise
        updated = await self.db.call_meeting_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "status": "confirmed",
                    "meeting_link": event.get("meeting_link"),
                    "calendar_event_id": event["id"],
                    "confirmed_by_user_id": user_id,
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self.db.calendar_events.update_one(
            {"_id": ObjectId(event["id"])}, {"$set": {"call_meeting_request_id": str(updated["_id"])}}
        )
        if doc.get("caller_email"):
            await self._send_confirmation_email(updated)
        await self._text_customer(user_id, updated, "rescheduled" if doc.get("kind") == "reschedule" else "booked")
        return _serialize(updated)

    async def decline(self, user_id: str, request_id: str) -> dict:
        doc = await self._get_org_request(user_id, request_id)
        if doc["status"] != "pending":
            raise AppException(
                status_code=409,
                code="CALL_MEETING_REQUEST_NOT_PENDING",
                message="This request has already been handled.",
            )
        updated = await self.db.call_meeting_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {"$set": {"status": "declined", "confirmed_by_user_id": user_id, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        if updated.get("caller_email"):
            await self._send_decline_email(updated)
        await self._text_customer(user_id, updated, "declined")
        return _serialize(updated)

    async def _get_org_request(self, user_id: str, request_id: str) -> dict:
        if not ObjectId.is_valid(request_id):
            raise AppException(status_code=404, code="CALL_MEETING_REQUEST_NOT_FOUND", message="Request not found.")
        organization_id = await self._require_organization_id(user_id)
        doc = await self.db.call_meeting_requests.find_one(
            {"_id": ObjectId(request_id), "organization_id": organization_id}
        )
        if not doc:
            raise AppException(status_code=404, code="CALL_MEETING_REQUEST_NOT_FOUND", message="Request not found.")
        return doc

    async def _require_organization_id(self, user_id: str) -> str:
        user = await self._get_user_document(user_id)
        organization_id = user.get("organization_id")
        if not organization_id:
            raise AppException(
                status_code=422,
                code="NO_ORGANIZATION",
                message="Your account isn't part of an organization yet.",
            )
        return organization_id

    async def _notify_organization(self, doc: dict) -> None:
        member_ids = await resolve_organization_user_ids(self.db, doc["organization_id"])
        when = doc["requested_start"].strftime("%A, %B %d at %I:%M %p")
        for member_id in member_ids:
            try:
                await self.create_notification(
                    user_id=member_id,
                    notification_type="calendar",
                    title="New appointment request from a call",
                    body=f"{doc['caller_name']} wants an appointment {when} — approve or decline.",
                    metadata={"call_meeting_request_id": str(doc["_id"]), "call_sid": doc.get("call_sid")},
                )
            except Exception:
                continue

    async def _send_confirmation_email(self, doc: dict) -> None:
        try:
            when = doc["requested_start"].strftime("%A, %B %d, %Y at %I:%M %p")
            link_line = f"<p>Join link: <a href=\"{doc['meeting_link']}\">{doc['meeting_link']}</a></p>" if doc.get("meeting_link") else ""
            await self.email_service.send_invoice_email(
                email=doc["caller_email"],
                subject="Your appointment is confirmed",
                text=f"Your appointment request for {when} has been confirmed."
                + (f" Join link: {doc['meeting_link']}" if doc.get("meeting_link") else ""),
                html=f"<p>Your appointment request for <strong>{when}</strong> has been confirmed.</p>{link_line}",
            )
        except Exception:
            # Confirmation already succeeded server-side; a failed courtesy email
            # shouldn't turn accept() into an error for the person clicking approve.
            pass

    async def _send_decline_email(self, doc: dict) -> None:
        try:
            when = doc["requested_start"].strftime("%A, %B %d, %Y at %I:%M %p")
            await self.email_service.send_invoice_email(
                email=doc["caller_email"],
                subject="About your appointment request",
                text=f"We're not able to confirm an appointment at {when}. Please call back or reach out "
                "to find another time that works.",
                html=f"<p>We're not able to confirm an appointment at <strong>{when}</strong>. "
                "Please call back or reach out to find another time that works.</p>",
            )
        except Exception:
            pass

    async def _org_owner_id(self, organization_id: str) -> str | None:
        owner = await self.db.users.find_one(
            {"organization_id": organization_id, "$or": [{"role": "owner"}, {"primary_role": "owner"}]}, {"_id": 1}
        ) or await self.db.users.find_one({"organization_id": organization_id}, {"_id": 1})
        return str(owner["_id"]) if owner else None

    async def _text_customer(self, user_id: str | None, doc: dict, kind: str) -> None:
        """Best-effort SMS from the business's own number, logged in Unified. A failed
        courtesy text never turns a successful booking into an error."""
        from .appointment_notifications import AppointmentNotifier

        if not user_id or not doc.get("caller_phone"):
            return
        await AppointmentNotifier(self.db).notify(
            user_id,
            kind=kind,
            phone=doc.get("caller_phone"),
            name=doc.get("caller_name"),
            starts_at=doc["requested_start"],
            language=doc.get("language"),
            meeting_link=doc.get("meeting_link"),
        )
