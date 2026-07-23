from __future__ import annotations

from datetime import datetime, timedelta
from urllib.parse import quote

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import resolve_team_user_ids, utc_now


class GoogleCalendarService:
    BASE_URL = "https://www.googleapis.com/calendar/v3"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    TOKEN_URL = "https://oauth2.googleapis.com/token"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_connected_integration(self, user_id: str) -> dict | None:
        """Prefer the user's own connected Google Calendar; if they haven't connected
        one themselves, fall back to any teammate's connected integration so the whole
        organization shares a single calendar connection."""
        own = await self.db.social_integrations.find_one(
            {"user_id": user_id, "platform": "google_business", "status": "connected"}
        )
        if own:
            return own
        team_ids = await resolve_team_user_ids(self.db, user_id)
        if len(team_ids) <= 1:
            return None
        return await self.db.social_integrations.find_one(
            {"user_id": {"$in": team_ids}, "platform": "google_business", "status": "connected"}
        )

    async def ensure_access_token(self, integration: dict) -> tuple[str, dict]:
        expires_at = integration.get("access_token_expires_at")
        if not isinstance(expires_at, datetime):
            # Unknown expiry (e.g. legacy record from before expiry tracking was added) - assume stale.
            return await self.refresh_access_token(integration)
        threshold = utc_now() + timedelta(seconds=60)
        comparable_threshold = threshold if expires_at.tzinfo else threshold.replace(tzinfo=None)
        if expires_at <= comparable_threshold:
            return await self.refresh_access_token(integration)
        access_token = decrypt_value(integration["access_token_encrypted"])
        return access_token, integration

    async def refresh_access_token(self, integration: dict) -> tuple[str, dict]:
        refresh_token_encrypted = integration.get("refresh_token_encrypted")
        if not refresh_token_encrypted:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Google Calendar access expired. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="GOOGLE_REFRESH_TOKEN_MISSING",
                message="Google Calendar access expired. Reconnect the account.",
                details={"sync_status": "needs_reauth"},
            )

        refresh_token = decrypt_value(refresh_token_encrypted)
        payload = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.TOKEN_URL, data=payload, headers={"Accept": "application/json"})

        if response.status_code >= 400:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Google refresh token was rejected. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="GOOGLE_TOKEN_REFRESH_FAILED",
                message="Google refresh token was rejected. Reconnect the account.",
                details={"sync_status": "needs_reauth", "provider_status": response.status_code},
            )

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(
                status_code=502,
                code="GOOGLE_ACCESS_TOKEN_MISSING",
                message="Google did not return a refreshed access token.",
                details={"sync_status": "error"},
            )

        expires_in = int(token_data.get("expires_in") or 3600)
        access_token_expires_at = utc_now() + timedelta(seconds=expires_in)
        updated = await self.db.social_integrations.find_one_and_update(
            {"_id": integration["_id"]},
            {
                "$set": {
                    "access_token_encrypted": encrypt_value(access_token),
                    "access_token_expires_at": access_token_expires_at,
                    "sync_status": "idle",
                    "last_error": None,
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return access_token, updated or integration

    async def fetch_account_context(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            userinfo_res, calendars_res = await self._gather_account_calls(client, access_token)

        if userinfo_res.status_code >= 400:
            raise AppException(
                status_code=502,
                code="GOOGLE_USERINFO_FAILED",
                message="Google account profile could not be loaded.",
                details={"provider_status": userinfo_res.status_code},
            )
        if calendars_res.status_code >= 400:
            raise AppException(
                status_code=502,
                code="GOOGLE_CALENDARS_FAILED",
                message="Google calendars could not be loaded.",
                details={"provider_status": calendars_res.status_code},
            )

        userinfo = userinfo_res.json()
        calendars = calendars_res.json().get("items", [])
        default_calendar = self._pick_default_calendar(calendars)
        return {
            "userinfo": userinfo,
            "calendars": calendars,
            "default_calendar": default_calendar,
        }

    async def _gather_account_calls(self, client: httpx.AsyncClient, access_token: str) -> tuple[httpx.Response, httpx.Response]:
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        userinfo_res = await client.get(self.USERINFO_URL, headers=headers)
        calendars_res = await client.get(f"{self.BASE_URL}/users/me/calendarList", headers=headers)
        return userinfo_res, calendars_res

    @staticmethod
    def _pick_default_calendar(calendars: list[dict]) -> dict | None:
        if not calendars:
            return None
        primary = next((item for item in calendars if item.get("primary")), None)
        if primary:
            return primary
        writable = next((item for item in calendars if str(item.get("accessRole", "")).lower() in {"owner", "writer"}), None)
        return writable or calendars[0]

    async def sync_events(self, user_id: str, integration: dict) -> dict:
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}
        calendar_id = provider_metadata.get("default_calendar_id") or "primary"

        all_events: list[dict] = []
        page_token: str | None = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "timeMin": utc_now().isoformat(),
                    "maxResults": 250,
                }
                if page_token:
                    params["pageToken"] = page_token
                response = await client.get(
                    f"{self.BASE_URL}/calendars/{quote(calendar_id, safe='')}/events",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                if response.status_code >= 400:
                    await self._mark_sync_error(current_integration["_id"], "Google Calendar sync failed.")
                    raise AppException(
                        status_code=502,
                        code="GOOGLE_SYNC_FAILED",
                        message="Google Calendar sync failed.",
                        details={"sync_status": "error", "provider_status": response.status_code, "response": response.text[:300]},
                    )
                payload = response.json()
                all_events.extend(payload.get("items", []))
                page_token = payload.get("nextPageToken")
                if not page_token:
                    break

        imported_count = 0
        updated_count = 0
        deleted_count = 0
        seen_google_ids: set[str] = set()

        for remote_event in all_events:
            google_event_id = remote_event.get("id")
            if not google_event_id:
                continue
            seen_google_ids.add(google_event_id)
            if remote_event.get("status") == "cancelled":
                deleted_count += await self._delete_local_google_event(user_id, google_event_id)
                continue

            local_doc = await self.db.calendar_events.find_one({"user_id": user_id, "google_event_id": google_event_id})
            mapped = await self._map_google_event_to_document(user_id, remote_event, provider_metadata)
            if local_doc:
                await self.db.calendar_events.update_one(
                    {"_id": local_doc["_id"]},
                    {"$set": {**mapped, "updated_at": utc_now()}},
                )
                updated_count += 1
            else:
                await self.db.calendar_events.insert_one(
                    {
                        "user_id": user_id,
                        **mapped,
                        "share_token": None,
                        "created_at": utc_now(),
                        "updated_at": utc_now(),
                    }
                )
                imported_count += 1

        stale_docs = await self.db.calendar_events.find(
            {
                "user_id": user_id,
                "google_event_id": {"$exists": True, "$ne": None},
                "provider_metadata.integration_platform": "google_business",
            }
        ).to_list(length=500)
        for stale in stale_docs:
            if stale.get("google_event_id") not in seen_google_ids:
                await self.db.calendar_events.delete_one({"_id": stale["_id"]})
                deleted_count += 1

        await self.db.social_integrations.update_one(
            {"_id": current_integration["_id"]},
            {
                "$set": {
                    "sync_status": "synced",
                    "last_sync_at": utc_now(),
                    "last_error": None,
                    "updated_at": utc_now(),
                }
            },
        )
        return {
            "platform": "google_business",
            "sync_status": "synced",
            "imported_count": imported_count,
            "updated_count": updated_count,
            "deleted_count": deleted_count,
            "message_sync_enabled": False,
            "calendar_id": calendar_id,
        }

    async def create_remote_event(self, user_id: str, payload: dict) -> dict | None:
        integration = await self.get_connected_integration(user_id)
        if not integration:
            return None
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}
        calendar_id = provider_metadata.get("default_calendar_id") or "primary"
        remote_payload = await self._build_google_event_payload(user_id, payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/calendars/{quote(calendar_id, safe='')}/events",
                params={"conferenceDataVersion": 1},
                json=remote_payload,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="GOOGLE_EVENT_CREATE_FAILED",
                message="Google Calendar event could not be created.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )
        return response.json()

    async def update_remote_event(self, user_id: str, google_event_id: str, payload: dict) -> dict | None:
        integration = await self.get_connected_integration(user_id)
        if not integration or not google_event_id:
            return None
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}
        calendar_id = provider_metadata.get("default_calendar_id") or "primary"
        remote_payload = await self._build_google_event_payload(user_id, payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{self.BASE_URL}/calendars/{quote(calendar_id, safe='')}/events/{quote(google_event_id, safe='')}",
                params={"conferenceDataVersion": 1},
                json=remote_payload,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="GOOGLE_EVENT_UPDATE_FAILED",
                message="Google Calendar event could not be updated.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )
        return response.json()

    async def delete_remote_event(self, user_id: str, google_event_id: str) -> None:
        integration = await self.get_connected_integration(user_id)
        if not integration or not google_event_id:
            return
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}
        calendar_id = provider_metadata.get("default_calendar_id") or "primary"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{self.BASE_URL}/calendars/{quote(calendar_id, safe='')}/events/{quote(google_event_id, safe='')}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400 and response.status_code != 410:
            raise AppException(
                status_code=502,
                code="GOOGLE_EVENT_DELETE_FAILED",
                message="Google Calendar event could not be deleted.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )

    async def _delete_local_google_event(self, user_id: str, google_event_id: str) -> int:
        delete_result = await self.db.calendar_events.delete_one({"user_id": user_id, "google_event_id": google_event_id})
        return delete_result.deleted_count

    async def _map_google_event_to_document(self, user_id: str, remote_event: dict, provider_metadata: dict) -> dict:
        start_info = remote_event.get("start") or {}
        end_info = remote_event.get("end") or {}
        starts_at = self._parse_google_datetime(start_info)
        ends_at = self._parse_google_datetime(end_info)
        if not starts_at or not ends_at:
            raise AppException(
                status_code=400,
                code="GOOGLE_EVENT_TIME_INVALID",
                message="Google Calendar event is missing valid start/end time.",
                details={"sync_status": "error"},
            )

        external_attendees = []
        contact_ids: list[str] = []
        for attendee in remote_event.get("attendees", []) or []:
            email = str(attendee.get("email") or "").strip().lower()
            name = attendee.get("displayName") or email or "Attendee"
            if email:
                contact = await self.db.contacts.find_one({"user_id": user_id, "email": {"$regex": f"^{email}$", "$options": "i"}})
                if contact:
                    contact_ids.append(str(contact["_id"]))
                    continue
            external_attendees.append(
                {
                    "name": name,
                    "email": email or None,
                    "response_status": attendee.get("responseStatus"),
                }
            )

        meeting_link = remote_event.get("hangoutLink") or self._extract_meeting_link(remote_event)
        location = remote_event.get("location")
        description = remote_event.get("description")
        recurrence = remote_event.get("recurrence") or []

        return {
            "title": remote_event.get("summary") or "Untitled Google Event",
            "description": description,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "contact_ids": list(dict.fromkeys(contact_ids)),
            "external_attendees": external_attendees,
            "meeting_mode": "online" if meeting_link else "offline",
            "location": location,
            "meeting_link": meeting_link,
            "notify_via_push": True,
            "notify_via_email": False,
            "notify_via_sms": False,
            "timezone": start_info.get("timeZone") or end_info.get("timeZone") or provider_metadata.get("timezone") or "UTC",
            "reminder_minutes": self._extract_reminder_minutes(remote_event),
            "google_event_id": remote_event.get("id"),
            "google_calendar_id": provider_metadata.get("default_calendar_id"),
            "google_calendar_name": provider_metadata.get("default_calendar_name"),
            "status": "cancelled" if remote_event.get("status") == "cancelled" else "scheduled",
            "sync_status": "synced",
            "calendar_source": "google_calendar",
            "provider_metadata": {
                "integration_platform": "google_business",
                "google_html_link": remote_event.get("htmlLink"),
                "google_status": remote_event.get("status"),
                "google_recurrence": recurrence,
                "google_updated": remote_event.get("updated"),
                "google_etag": remote_event.get("etag"),
            },
        }

    @staticmethod
    def _parse_google_datetime(payload: dict) -> datetime | None:
        if payload.get("dateTime"):
            value = payload["dateTime"].replace("Z", "+00:00")
            return datetime.fromisoformat(value)
        if payload.get("date"):
            return datetime.fromisoformat(f"{payload['date']}T00:00:00+00:00")
        return None

    @staticmethod
    def _extract_reminder_minutes(remote_event: dict) -> int:
        reminders = (remote_event.get("reminders") or {}).get("overrides") or []
        for item in reminders:
            minutes = item.get("minutes")
            if isinstance(minutes, int):
                return minutes
        return 15

    @staticmethod
    def _extract_meeting_link(remote_event: dict) -> str | None:
        conference_data = remote_event.get("conferenceData") or {}
        for entry in conference_data.get("entryPoints") or []:
            if entry.get("entryPointType") == "video" and entry.get("uri"):
                return entry["uri"]
        return None

    async def _build_google_event_payload(self, user_id: str, payload: dict) -> dict:
        starts_at = payload["starts_at"]
        ends_at = payload["ends_at"]
        if isinstance(starts_at, datetime):
            start_value = starts_at.isoformat()
        else:
            start_value = str(starts_at)
        if isinstance(ends_at, datetime):
            end_value = ends_at.isoformat()
        else:
            end_value = str(ends_at)

        attendees = await self._build_google_attendees(user_id, payload)
        body = {
            "summary": payload.get("title") or "Untitled Event",
            "description": self._google_description(payload),
            "location": payload.get("location"),
            "start": {"dateTime": start_value, "timeZone": payload.get("timezone") or "UTC"},
            "end": {"dateTime": end_value, "timeZone": payload.get("timezone") or "UTC"},
            "attendees": attendees,
            "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": int(payload.get("reminder_minutes") or 15)}]},
        }
        if payload.get("meeting_mode") == "online" and not payload.get("meeting_link"):
            body["conferenceData"] = {
                "createRequest": {
                    "requestId": f"mabdel-{ObjectId()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }
        return body

    async def _build_google_attendees(self, user_id: str, payload: dict) -> list[dict]:
        attendees = list(payload.get("google_attendees") or [])
        for contact_id in payload.get("contact_ids") or []:
            if not ObjectId.is_valid(contact_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
            if not contact or not contact.get("email"):
                continue
            attendees.append(
                {
                    "email": contact["email"],
                    "displayName": contact.get("name") or contact["email"],
                }
            )
        unique = {}
        for attendee in attendees:
            email = str(attendee.get("email") or "").strip().lower()
            if email:
                unique[email] = attendee
        return list(unique.values())

    @staticmethod
    def _google_description(payload: dict) -> str:
        parts = [str(payload.get("description") or "").strip()]
        if payload.get("meeting_link"):
            parts.append(f"Join link: {payload['meeting_link']}")
        return "\n\n".join([part for part in parts if part])

    async def _mark_sync_error(self, integration_id, message: str) -> None:
        await self.db.social_integrations.update_one(
            {"_id": integration_id},
            {"$set": {"sync_status": "error", "last_error": message, "updated_at": utc_now()}},
        )
