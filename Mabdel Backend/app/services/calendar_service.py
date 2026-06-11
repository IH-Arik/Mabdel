from __future__ import annotations

import uuid
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.calendar import CalendarEventRequest, CalendarEventResponse
from app.services.email_service import EmailService
from app.services.push_notification_service import PushNotificationService
from app.services.call_service import CallService
from app.utils.helpers import utc_now


class CalendarService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.email_service = EmailService()
        self.push_service = PushNotificationService(db)
        self.call_service = CallService()

    async def schedule(self, payload: CalendarEventRequest, user_id: str) -> CalendarEventResponse:
        event_id = str(uuid.uuid4())
        created_at = utc_now()

        # 1. Save to Database
        document = {
            "_id": event_id,
            "user_id": user_id,
            "title": payload.title,
            "description": payload.description,
            "location": payload.location,
            "starts_at": payload.starts_at,
            "ends_at": payload.ends_at,
            "attendees": payload.attendees,
            "notify_via": payload.notify_via,
            "reminder_time": payload.reminder_time,
            "status": "scheduled",
            "created_at": created_at,
            "updated_at": created_at,
        }
        await self.db.calendar_events.insert_one(document)

        # 2. Trigger Notifications
        message_body = f"New meeting scheduled: {payload.title} at {payload.starts_at.strftime('%Y-%m-%d %H:%M')}"
        if payload.location:
            message_body += f" (Location: {payload.location})"

        for notify_type in payload.notify_via:
            if notify_type == "email":
                for attendee in payload.attendees:
                    if "@" in attendee:
                        try:
                            await self.email_service._send_email(
                                email=attendee,
                                subject=f"Meeting Invitation: {payload.title}",
                                text=message_body,
                                html=f"<p>{message_body}</p>",
                            )
                        except Exception:
                            pass

            elif notify_type == "push":
                await self.push_service.enqueue_notification(
                    user_id=user_id,
                    notification={
                        "id": event_id,
                        "type": "calendar",
                        "title": "Meeting Scheduled",
                        "body": message_body,
                    },
                )

            elif notify_type == "sms":
                for attendee in payload.attendees:
                    if "@" not in attendee and any(c.isdigit() for c in attendee):
                        try:
                            await self.call_service.send_sms(to_number=attendee, message=message_body)
                        except Exception:
                            pass

        return CalendarEventResponse(
            id=event_id,
            title=payload.title,
            description=payload.description,
            location=payload.location,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            attendees=payload.attendees,
            status="scheduled",
            created_at=created_at,
        )
