from __future__ import annotations

from datetime import datetime, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import resolve_team_user_ids, utc_now


class ZoomCalendarService:
    """Zoom has no generic "calendar" object — a Zoom Meeting IS the calendar event
    (it carries its own start time/duration/timezone and a real join_url), so this
    mirrors GoogleCalendarService's shape but maps calendar_events to/from the Zoom
    Meetings API instead of Google Calendar events.

    Zoom's OAuth token endpoint requires HTTP Basic Auth (client_id:client_secret) —
    verified against Zoom's own OAuth docs — unlike Google's plain form-body creds,
    so ensure_access_token/refresh_access_token use httpx.BasicAuth explicitly."""

    BASE_URL = "https://api.zoom.us/v2"
    USERINFO_URL = "https://api.zoom.us/v2/users/me"
    TOKEN_URL = "https://zoom.us/oauth/token"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_connected_integration(self, user_id: str) -> dict | None:
        """Prefer the user's own connected Zoom account; fall back to any teammate's
        so the whole organization shares a single Zoom connection — same precedent as
        GoogleCalendarService.get_connected_integration."""
        own = await self.db.social_integrations.find_one({"user_id": user_id, "platform": "zoom", "status": "connected"})
        if own:
            return own
        team_ids = await resolve_team_user_ids(self.db, user_id)
        if len(team_ids) <= 1:
            return None
        return await self.db.social_integrations.find_one({"user_id": {"$in": team_ids}, "platform": "zoom", "status": "connected"})

    async def ensure_access_token(self, integration: dict) -> tuple[str, dict]:
        expires_at = integration.get("access_token_expires_at")
        if not isinstance(expires_at, datetime):
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
                        "last_error": "Zoom access expired. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="ZOOM_REFRESH_TOKEN_MISSING",
                message="Zoom access expired. Reconnect the account.",
                details={"sync_status": "needs_reauth"},
            )

        refresh_token = decrypt_value(refresh_token_encrypted)
        payload = {"grant_type": "refresh_token", "refresh_token": refresh_token}
        auth = httpx.BasicAuth(settings.ZOOM_CLIENT_ID or "", settings.ZOOM_CLIENT_SECRET or "")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.TOKEN_URL, data=payload, auth=auth, headers={"Accept": "application/json"})

        if response.status_code >= 400:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Zoom refresh token was rejected. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="ZOOM_TOKEN_REFRESH_FAILED",
                message="Zoom refresh token was rejected. Reconnect the account.",
                details={"sync_status": "needs_reauth", "provider_status": response.status_code},
            )

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(
                status_code=502,
                code="ZOOM_ACCESS_TOKEN_MISSING",
                message="Zoom did not return a refreshed access token.",
                details={"sync_status": "error"},
            )

        expires_in = int(token_data.get("expires_in") or 3600)
        access_token_expires_at = utc_now() + timedelta(seconds=expires_in)
        updated = await self.db.social_integrations.find_one_and_update(
            {"_id": integration["_id"]},
            {
                "$set": {
                    "access_token_encrypted": encrypt_value(access_token),
                    # Zoom only reissues a refresh token on some refreshes — keep the
                    # old one unless a new one was actually returned.
                    **(
                        {"refresh_token_encrypted": encrypt_value(token_data["refresh_token"])}
                        if token_data.get("refresh_token")
                        else {}
                    ),
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
            response = await client.get(
                self.USERINFO_URL, headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="ZOOM_USERINFO_FAILED",
                message="Zoom account profile could not be loaded.",
                details={"provider_status": response.status_code},
            )
        return response.json()

    async def sync_events(self, user_id: str, integration: dict) -> dict:
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}

        all_meetings: list[dict] = []
        next_page_token: str | None = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {"type": "scheduled", "page_size": 100}
                if next_page_token:
                    params["next_page_token"] = next_page_token
                response = await client.get(
                    f"{self.BASE_URL}/users/me/meetings",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                if response.status_code >= 400:
                    await self._mark_sync_error(current_integration["_id"], "Zoom Calendar sync failed.")
                    raise AppException(
                        status_code=502,
                        code="ZOOM_SYNC_FAILED",
                        message="Zoom Calendar sync failed.",
                        details={"sync_status": "error", "provider_status": response.status_code, "response": response.text[:300]},
                    )
                payload = response.json()
                all_meetings.extend(payload.get("meetings", []))
                next_page_token = payload.get("next_page_token")
                if not next_page_token:
                    break

        imported_count = 0
        updated_count = 0
        deleted_count = 0
        seen_zoom_ids: set[str] = set()

        for remote_meeting in all_meetings:
            zoom_meeting_id = str(remote_meeting.get("id") or "")
            if not zoom_meeting_id:
                continue
            seen_zoom_ids.add(zoom_meeting_id)

            local_doc = await self.db.calendar_events.find_one({"user_id": user_id, "zoom_meeting_id": zoom_meeting_id})
            mapped = self._map_zoom_meeting_to_document(remote_meeting, provider_metadata)
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
                "zoom_meeting_id": {"$exists": True, "$ne": None},
                "provider_metadata.integration_platform": "zoom",
            }
        ).to_list(length=500)
        for stale in stale_docs:
            if stale.get("zoom_meeting_id") not in seen_zoom_ids:
                await self.db.calendar_events.delete_one({"_id": stale["_id"]})
                deleted_count += 1

        await self.db.social_integrations.update_one(
            {"_id": current_integration["_id"]},
            {"$set": {"sync_status": "synced", "last_sync_at": utc_now(), "last_error": None, "updated_at": utc_now()}},
        )
        return {
            "platform": "zoom",
            "sync_status": "synced",
            "imported_count": imported_count,
            "updated_count": updated_count,
            "deleted_count": deleted_count,
            "message_sync_enabled": False,
        }

    async def create_remote_event(self, user_id: str, payload: dict) -> dict | None:
        integration = await self.get_connected_integration(user_id)
        if not integration:
            return None
        access_token, _current_integration = await self.ensure_access_token(integration)
        body = self._build_zoom_meeting_payload(payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/users/me/meetings",
                json=body,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="ZOOM_MEETING_CREATE_FAILED",
                message="Zoom meeting could not be created.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )
        return response.json()

    async def update_remote_event(self, user_id: str, zoom_meeting_id: str, payload: dict) -> dict | None:
        integration = await self.get_connected_integration(user_id)
        if not integration or not zoom_meeting_id:
            return None
        access_token, _current_integration = await self.ensure_access_token(integration)
        body = self._build_zoom_meeting_payload(payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.patch(
                f"{self.BASE_URL}/meetings/{zoom_meeting_id}",
                json=body,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="ZOOM_MEETING_UPDATE_FAILED",
                message="Zoom meeting could not be updated.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )
        # Zoom's PATCH returns 204 No Content on success — re-fetch so callers get a
        # meeting object with a join_url, matching create_remote_event's return shape.
        async with httpx.AsyncClient(timeout=30.0) as client:
            get_response = await client.get(
                f"{self.BASE_URL}/meetings/{zoom_meeting_id}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if get_response.status_code >= 400:
            return {"id": zoom_meeting_id}
        return get_response.json()

    async def delete_remote_event(self, user_id: str, zoom_meeting_id: str) -> None:
        integration = await self.get_connected_integration(user_id)
        if not integration or not zoom_meeting_id:
            return
        access_token, _current_integration = await self.ensure_access_token(integration)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{self.BASE_URL}/meetings/{zoom_meeting_id}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400 and response.status_code != 404:
            raise AppException(
                status_code=502,
                code="ZOOM_MEETING_DELETE_FAILED",
                message="Zoom meeting could not be deleted.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )

    @staticmethod
    def _extract_meeting_link(remote_meeting: dict) -> str | None:
        return remote_meeting.get("join_url")

    def _map_zoom_meeting_to_document(self, remote_meeting: dict, provider_metadata: dict) -> dict:
        starts_at = self._parse_zoom_datetime(remote_meeting.get("start_time"))
        duration_minutes = int(remote_meeting.get("duration") or 30)
        ends_at = (starts_at + timedelta(minutes=duration_minutes)) if starts_at else None
        if not starts_at or not ends_at:
            raise AppException(
                status_code=400,
                code="ZOOM_EVENT_TIME_INVALID",
                message="Zoom meeting is missing a valid start time.",
                details={"sync_status": "error"},
            )
        return {
            "title": remote_meeting.get("topic") or "Untitled Zoom Meeting",
            "description": remote_meeting.get("agenda"),
            "starts_at": starts_at,
            "ends_at": ends_at,
            "contact_ids": [],
            "external_attendees": [],
            "meeting_mode": "online",
            "location": None,
            "meeting_link": remote_meeting.get("join_url"),
            "notify_via_push": True,
            "notify_via_email": False,
            "notify_via_sms": False,
            "timezone": remote_meeting.get("timezone") or provider_metadata.get("timezone") or "UTC",
            "reminder_minutes": 15,
            "zoom_meeting_id": str(remote_meeting.get("id")),
            "status": "scheduled",
            "sync_status": "synced",
            "calendar_source": "zoom_calendar",
            "provider_metadata": {
                "integration_platform": "zoom",
                "zoom_join_url": remote_meeting.get("join_url"),
                "zoom_start_url": remote_meeting.get("start_url"),
                "zoom_updated": remote_meeting.get("created_at"),
            },
        }

    @staticmethod
    def _parse_zoom_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    @staticmethod
    def _build_zoom_meeting_payload(payload: dict) -> dict:
        starts_at = payload["starts_at"]
        ends_at = payload["ends_at"]
        tz_name = payload.get("timezone") or "UTC"
        duration_minutes = max(1, int((ends_at - starts_at).total_seconds() // 60)) if isinstance(starts_at, datetime) and isinstance(ends_at, datetime) else 30
        # Zoom wants a naive local wall-clock start_time plus a separate IANA
        # timezone field — an offset-inclusive start_time makes Zoom silently ignore
        # the timezone field and convert to UTC instead, which would desync the
        # displayed time from what the organizer configured.
        if isinstance(starts_at, datetime):
            local_start = starts_at.replace(tzinfo=None) if starts_at.tzinfo is None else starts_at.astimezone(ZoomCalendarService._resolve_zoneinfo(tz_name)).replace(tzinfo=None)
            start_time = local_start.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            start_time = str(starts_at)
        body = {
            "topic": payload.get("title") or "Untitled Meeting",
            "type": 2,  # scheduled meeting
            "start_time": start_time,
            "duration": duration_minutes,
            "timezone": tz_name,
            "agenda": str(payload.get("description") or "")[:2000],
            "settings": {"join_before_host": True, "waiting_room": False},
        }
        return body

    @staticmethod
    def _resolve_zoneinfo(name: str | None):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            return ZoneInfo(name or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            return ZoneInfo("UTC")

    async def _mark_sync_error(self, integration_id, message: str) -> None:
        await self.db.social_integrations.update_one(
            {"_id": integration_id},
            {"$set": {"sync_status": "error", "last_error": message, "updated_at": utc_now()}},
        )
