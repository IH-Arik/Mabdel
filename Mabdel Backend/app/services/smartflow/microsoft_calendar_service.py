from __future__ import annotations

from datetime import datetime, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import resolve_team_user_ids, utc_now


class MicrosoftCalendarService:
    """Outlook Calendar sync via Microsoft Graph, mirroring
    GoogleCalendarService/ZoomCalendarService's shape.

    Shares the same Azure AD app registration (and the same connected
    ``social_integrations`` record, ``platform: "microsoft"``) as
    ``MicrosoftMailService`` — the OAuth consent requests Mail.Send and
    Calendars.ReadWrite together in a single grant, so there is one stored
    integration used by both features, not two separate connections.

    Microsoft's token endpoint takes client credentials in the request body
    (like Zoho, unlike Zoom's Basic Auth requirement) — verified against
    Microsoft's own identity platform docs."""

    GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
    EVENTS_URL = "https://graph.microsoft.com/v1.0/me/events"
    ME_URL = "https://graph.microsoft.com/v1.0/me"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    @staticmethod
    def token_url() -> str:
        # "organizations", not a specific tenant — see _oauth_provider("microsoft")
        # in _base.py for why (multi-tenant SaaS: any customer's own Microsoft 365).
        return "https://login.microsoftonline.com/organizations/oauth2/v2.0/token"

    async def get_connected_integration(self, user_id: str) -> dict | None:
        """Prefer the user's own connected Microsoft account; fall back to any
        teammate's so the whole organization shares a single connection — same
        precedent as GoogleCalendarService.get_connected_integration."""
        own = await self.db.social_integrations.find_one({"user_id": user_id, "platform": "microsoft", "status": "connected"})
        if own:
            return own
        team_ids = await resolve_team_user_ids(self.db, user_id)
        if len(team_ids) <= 1:
            return None
        return await self.db.social_integrations.find_one({"user_id": {"$in": team_ids}, "platform": "microsoft", "status": "connected"})

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
                        "last_error": "Microsoft 365 access expired. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="MICROSOFT_REFRESH_TOKEN_MISSING",
                message="Microsoft 365 access expired. Reconnect the account.",
                details={"sync_status": "needs_reauth"},
            )

        refresh_token = decrypt_value(refresh_token_encrypted)
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "scope": " ".join(
                [
                    "offline_access",
                    "https://graph.microsoft.com/Mail.Send",
                    "https://graph.microsoft.com/Calendars.ReadWrite",
                    "https://graph.microsoft.com/User.Read",
                ]
            ),
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.token_url(), data=payload, headers={"Accept": "application/json"})

        if response.status_code >= 400:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Microsoft 365 refresh token was rejected. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="MICROSOFT_TOKEN_REFRESH_FAILED",
                message="Microsoft 365 refresh token was rejected. Reconnect the account.",
                details={"sync_status": "needs_reauth", "provider_status": response.status_code},
            )

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(
                status_code=502,
                code="MICROSOFT_ACCESS_TOKEN_MISSING",
                message="Microsoft did not return a refreshed access token.",
                details={"sync_status": "error"},
            )

        expires_in = int(token_data.get("expires_in") or 3600)
        access_token_expires_at = utc_now() + timedelta(seconds=expires_in)
        updated = await self.db.social_integrations.find_one_and_update(
            {"_id": integration["_id"]},
            {
                "$set": {
                    "access_token_encrypted": encrypt_value(access_token),
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
                self.ME_URL,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json", "Content-Type": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="MICROSOFT_ME_FAILED",
                message="Microsoft 365 account could not be loaded.",
                details={"provider_status": response.status_code},
            )
        data = response.json() or {}
        return {
            "id": data.get("id"),
            "email": data.get("mail") or data.get("userPrincipalName"),
            "display_name": data.get("displayName"),
            "timezone": None,
        }

    async def sync_events(self, user_id: str, integration: dict) -> dict:
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}

        all_events: list[dict] = []
        next_url: str | None = f"{self.EVENTS_URL}?$top=100"
        async with httpx.AsyncClient(timeout=30.0) as client:
            while next_url:
                response = await client.get(
                    next_url,
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                if response.status_code >= 400:
                    await self._mark_sync_error(current_integration["_id"], "Outlook Calendar sync failed.")
                    raise AppException(
                        status_code=502,
                        code="MICROSOFT_SYNC_FAILED",
                        message="Outlook Calendar sync failed.",
                        details={"sync_status": "error", "provider_status": response.status_code, "response": response.text[:300]},
                    )
                payload = response.json()
                all_events.extend(payload.get("value", []))
                next_url = payload.get("@odata.nextLink")

        imported_count = 0
        updated_count = 0
        deleted_count = 0
        seen_event_ids: set[str] = set()

        for remote_event in all_events:
            microsoft_event_id = str(remote_event.get("id") or "")
            if not microsoft_event_id:
                continue
            seen_event_ids.add(microsoft_event_id)

            local_doc = await self.db.calendar_events.find_one({"user_id": user_id, "microsoft_event_id": microsoft_event_id})
            mapped = self._map_graph_event_to_document(remote_event, provider_metadata)
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
                "microsoft_event_id": {"$exists": True, "$ne": None},
                "provider_metadata.integration_platform": "microsoft",
            }
        ).to_list(length=500)
        for stale in stale_docs:
            if stale.get("microsoft_event_id") not in seen_event_ids:
                await self.db.calendar_events.delete_one({"_id": stale["_id"]})
                deleted_count += 1

        await self.db.social_integrations.update_one(
            {"_id": current_integration["_id"]},
            {"$set": {"sync_status": "synced", "last_sync_at": utc_now(), "last_error": None, "updated_at": utc_now()}},
        )
        return {
            "platform": "microsoft",
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
        body = self._build_graph_event_payload(payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.EVENTS_URL,
                json=body,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="MICROSOFT_EVENT_CREATE_FAILED",
                message="Outlook Calendar event could not be created.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )
        return response.json()

    async def update_remote_event(self, user_id: str, microsoft_event_id: str, payload: dict) -> dict | None:
        integration = await self.get_connected_integration(user_id)
        if not integration or not microsoft_event_id:
            return None
        access_token, _current_integration = await self.ensure_access_token(integration)
        body = self._build_graph_event_payload(payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.patch(
                f"{self.EVENTS_URL}/{microsoft_event_id}",
                json=body,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="MICROSOFT_EVENT_UPDATE_FAILED",
                message="Outlook Calendar event could not be updated.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )
        return response.json()

    async def delete_remote_event(self, user_id: str, microsoft_event_id: str) -> None:
        integration = await self.get_connected_integration(user_id)
        if not integration or not microsoft_event_id:
            return
        access_token, _current_integration = await self.ensure_access_token(integration)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{self.EVENTS_URL}/{microsoft_event_id}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
        if response.status_code >= 400 and response.status_code != 404:
            raise AppException(
                status_code=502,
                code="MICROSOFT_EVENT_DELETE_FAILED",
                message="Outlook Calendar event could not be deleted.",
                details={"provider_status": response.status_code, "sync_status": "error", "response": response.text[:300]},
            )

    @staticmethod
    def _extract_meeting_link(remote_event: dict) -> str | None:
        online_meeting = remote_event.get("onlineMeeting") or {}
        return online_meeting.get("joinUrl") or remote_event.get("webLink")

    def _map_graph_event_to_document(self, remote_event: dict, provider_metadata: dict) -> dict:
        starts_at = self._parse_graph_datetime(remote_event.get("start"))
        ends_at = self._parse_graph_datetime(remote_event.get("end"))
        if not starts_at or not ends_at:
            raise AppException(
                status_code=400,
                code="MICROSOFT_EVENT_TIME_INVALID",
                message="Outlook Calendar event is missing a valid start/end time.",
                details={"sync_status": "error"},
            )
        body_content = (remote_event.get("body") or {}).get("content")
        return {
            "title": remote_event.get("subject") or "Untitled Outlook Event",
            "description": body_content,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "contact_ids": [],
            "external_attendees": [],
            "meeting_mode": "online" if remote_event.get("isOnlineMeeting") else "in_person",
            "location": ((remote_event.get("location") or {}).get("displayName")),
            "meeting_link": self._extract_meeting_link(remote_event),
            "notify_via_push": True,
            "notify_via_email": False,
            "notify_via_sms": False,
            "timezone": (remote_event.get("start") or {}).get("timeZone") or provider_metadata.get("timezone") or "UTC",
            "reminder_minutes": 15,
            "microsoft_event_id": str(remote_event.get("id")),
            "status": "scheduled",
            "sync_status": "synced",
            "calendar_source": "microsoft_calendar",
            "provider_metadata": {
                "integration_platform": "microsoft",
                "microsoft_web_link": remote_event.get("webLink"),
                "microsoft_join_url": self._extract_meeting_link(remote_event),
                "microsoft_updated": remote_event.get("lastModifiedDateTime"),
            },
        }

    @staticmethod
    def _parse_graph_datetime(value: dict | None) -> datetime | None:
        if not value or not value.get("dateTime"):
            return None
        raw = value["dateTime"]
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None

    @staticmethod
    def _build_graph_event_payload(payload: dict) -> dict:
        starts_at = payload["starts_at"]
        ends_at = payload["ends_at"]
        tz_name = payload.get("timezone") or "UTC"

        def _fmt(value) -> str:
            if isinstance(value, datetime):
                naive = value.replace(tzinfo=None) if value.tzinfo is None else value.astimezone(
                    MicrosoftCalendarService._resolve_zoneinfo(tz_name)
                ).replace(tzinfo=None)
                return naive.strftime("%Y-%m-%dT%H:%M:%S")
            return str(value)

        body: dict = {
            "subject": payload.get("title") or "Untitled Meeting",
            "body": {"contentType": "HTML", "content": str(payload.get("description") or "")},
            "start": {"dateTime": _fmt(starts_at), "timeZone": tz_name},
            "end": {"dateTime": _fmt(ends_at), "timeZone": tz_name},
        }
        location = payload.get("location")
        if location:
            body["location"] = {"displayName": location}
        attendees = []
        for attendee in payload.get("external_attendees") or []:
            email = attendee.get("email") if isinstance(attendee, dict) else None
            if email:
                attendees.append(
                    {
                        "emailAddress": {"address": email, "name": attendee.get("name") or email},
                        "type": "required",
                    }
                )
        if attendees:
            body["attendees"] = attendees
        if payload.get("meeting_mode") == "online":
            body["isOnlineMeeting"] = True
            body["onlineMeetingProvider"] = "teamsForBusiness"
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
