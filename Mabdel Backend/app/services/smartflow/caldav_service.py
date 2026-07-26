from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import httpx
from icalendar import Calendar as ICalCalendar
from icalendar import Event as ICalEvent
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import utc_now

logger = logging.getLogger(__name__)

DEFAULT_SERVER_URL = "https://caldav.icloud.com"

NS = {"d": "DAV:", "cs": "http://calendarserver.org/ns/", "c": "urn:ietf:params:xml:ns:caldav"}


def _tag(ns: str, name: str) -> str:
    return f"{{{NS[ns]}}}{name}"


class CalDAVService:
    """Generic CalDAV client (targets iCloud by default) — connect via an
    app-specific password, two-way sync of calendar_events."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def get_connection(self, user_id: str) -> dict | None:
        return await self.db.caldav_connections.find_one({"user_id": user_id})

    async def get_status(self, user_id: str) -> dict:
        connection = await self.get_connection(user_id)
        if not connection:
            return {"connected": False, "provider": "caldav"}
        return {
            "connected": connection.get("status") == "connected",
            "provider": "caldav",
            "username": connection.get("username"),
            "server_url": connection.get("server_url"),
            "last_synced_at": connection.get("last_synced_at"),
            "last_error": connection.get("last_error"),
        }

    async def connect(self, user_id: str, username: str, app_password: str, server_url: str | None = None) -> dict:
        server_url = (server_url or DEFAULT_SERVER_URL).rstrip("/")
        auth = httpx.BasicAuth(username, app_password)

        principal_url = await self._discover_principal(server_url, auth)
        calendar_home_url = await self._discover_calendar_home(principal_url, auth)
        calendar_url = await self._discover_writable_calendar(calendar_home_url, auth)

        now = utc_now()
        await self.db.caldav_connections.find_one_and_update(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "provider": "icloud" if "icloud.com" in server_url else "caldav",
                    "server_url": server_url,
                    "username": username,
                    "app_password_encrypted": encrypt_value(app_password),
                    "principal_url": principal_url,
                    "calendar_home_url": calendar_home_url,
                    "calendar_url": calendar_url,
                    "sync_token": None,
                    "status": "connected",
                    "last_error": None,
                    "connected_at": now,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

        # Mutual exclusivity: Apple Calendar becomes the primary synced calendar.
        # Any existing Google Calendar connection is downgraded to "meet-link only"
        # (still usable for generating Meet links, no longer the calendar of record).
        await self.db.social_integrations.update_many(
            {"user_id": user_id, "platform": "google_business", "status": "connected"},
            {"$set": {"sync_mode": "meet_link_only", "updated_at": now}},
        )

        return {"connected": True, "provider": "caldav", "username": username, "server_url": server_url}

    async def disconnect(self, user_id: str) -> None:
        result = await self.db.caldav_connections.delete_one({"user_id": user_id})
        if result.deleted_count == 0:
            raise AppException(status_code=404, code="CALDAV_NOT_CONNECTED", message="Apple Calendar is not connected.")

    # ------------------------------------------------------------------
    # Outbound push (our event -> CalDAV server)
    # ------------------------------------------------------------------

    async def push_event(self, user_id: str, event: dict) -> str | None:
        connection = await self.get_connection(user_id)
        if not connection or connection.get("status") != "connected":
            return None

        uid = event.get("caldav_uid") or f"{uuid.uuid4()}@gocustify.app"
        ics_bytes = self._build_vevent(uid, event)
        href = f"{connection['calendar_url'].rstrip('/')}/{uid}.ics"
        auth = self._auth(connection)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                href,
                content=ics_bytes,
                auth=auth,
                headers={"Content-Type": "text/calendar; charset=utf-8"},
            )
        if response.status_code >= 400:
            await self._mark_error(user_id, f"CalDAV event push failed ({response.status_code}).")
            raise AppException(status_code=502, code="CALDAV_EVENT_PUSH_FAILED", message="Failed to sync event to Apple Calendar.")
        return uid

    async def delete_event(self, user_id: str, caldav_uid: str) -> None:
        connection = await self.get_connection(user_id)
        if not connection or connection.get("status") != "connected" or not caldav_uid:
            return
        href = f"{connection['calendar_url'].rstrip('/')}/{caldav_uid}.ics"
        auth = self._auth(connection)
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.delete(href, auth=auth)

    # ------------------------------------------------------------------
    # Inbound pull (CalDAV server -> our calendar_events)
    # ------------------------------------------------------------------

    async def pull_changes(self, user_id: str) -> dict:
        connection = await self.get_connection(user_id)
        if not connection or connection.get("status") != "connected":
            return {"synced": 0}

        auth = self._auth(connection)
        calendar_url = connection["calendar_url"]
        sync_token = connection.get("sync_token")

        body = (
            '<?xml version="1.0" encoding="utf-8" ?>'
            '<d:sync-collection xmlns:d="DAV:">'
            f'<d:sync-token>{sync_token or ""}</d:sync-token>'
            "<d:sync-level>1</d:sync-level>"
            "<d:prop><d:getetag/></d:prop>"
            "</d:sync-collection>"
        )
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                "REPORT", calendar_url, content=body, auth=auth,
                headers={"Content-Type": "application/xml; charset=utf-8", "Depth": "1"},
            )
        if response.status_code >= 400:
            # Sync token likely invalidated (410 Gone) or first-time sync unsupported — reset and retry once.
            if sync_token:
                await self.db.caldav_connections.update_one({"user_id": user_id}, {"$set": {"sync_token": None}})
                return await self.pull_changes(user_id)
            await self._mark_error(user_id, f"CalDAV sync failed ({response.status_code}).")
            return {"synced": 0, "error": True}

        root = ET.fromstring(response.content)
        new_token_el = root.find(_tag("d", "sync-token"))
        new_token = new_token_el.text if new_token_el is not None else None

        synced = 0
        for response_el in root.findall(_tag("d", "response")):
            href_el = response_el.find(_tag("d", "href"))
            href = href_el.text if href_el is not None else None
            if not href:
                continue
            status_el = response_el.find(f"{_tag('d', 'propstat')}/{_tag('d', 'status')}")
            status_text = status_el.text if status_el is not None else ""
            if "404" in status_text or response_el.find(_tag("d", "status")) is not None:
                # Resource removed remotely.
                await self.db.calendar_events.delete_one({"user_id": user_id, "caldav_href": href})
                synced += 1
                continue
            await self._fetch_and_upsert(user_id, connection, href, auth)
            synced += 1

        await self.db.caldav_connections.update_one(
            {"user_id": user_id},
            {"$set": {"sync_token": new_token, "last_synced_at": utc_now(), "last_error": None}},
        )
        return {"synced": synced}

    async def _fetch_and_upsert(self, user_id: str, connection: dict, href: str, auth: httpx.BasicAuth) -> None:
        base = connection["server_url"]
        url = href if href.startswith("http") else f"{base}{href}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, auth=auth)
        if response.status_code >= 400 or not response.content:
            return
        try:
            cal = ICalCalendar.from_ical(response.content)
        except ValueError:
            return
        for component in cal.walk("VEVENT"):
            uid = str(component.get("uid") or "")
            summary = str(component.get("summary") or "Untitled Event")
            dtstart = component.get("dtstart")
            dtend = component.get("dtend")
            if not dtstart or not dtend:
                continue
            starts_at = self._to_utc_datetime(dtstart.dt)
            ends_at = self._to_utc_datetime(dtend.dt)
            description = str(component.get("description") or "") or None
            now = utc_now()
            await self.db.calendar_events.find_one_and_update(
                {"user_id": user_id, "caldav_uid": uid},
                {
                    "$set": {
                        "user_id": user_id,
                        "title": summary,
                        "description": description,
                        "starts_at": starts_at,
                        "ends_at": ends_at,
                        "meeting_mode": "offline",
                        "location": str(component.get("location") or "") or None,
                        "calendar_source": "caldav_sync",
                        "sync_status": "synced",
                        "caldav_uid": uid,
                        "caldav_href": href,
                        "updated_at": now,
                    },
                    "$setOnInsert": {"created_at": now, "share_token": None, "contact_ids": [], "notify_via_push": True, "notify_via_email": False, "notify_via_sms": False, "reminder_minutes": 15, "timezone": "UTC"},
                },
                upsert=True,
            )

    @staticmethod
    def _to_utc_datetime(value) -> datetime:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)
        # All-day date -> midnight UTC
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    async def _propfind(self, url: str, auth: httpx.BasicAuth, body: str, depth: str = "0") -> ET.Element:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.request(
                "PROPFIND", url, content=body, auth=auth,
                headers={"Content-Type": "application/xml; charset=utf-8", "Depth": depth},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502 if response.status_code != 401 else 401,
                code="CALDAV_DISCOVERY_FAILED",
                message="Could not connect to Apple Calendar — check your Apple ID and app-specific password.",
                details={"status": response.status_code},
            )
        return ET.fromstring(response.content)

    async def _discover_principal(self, server_url: str, auth: httpx.BasicAuth) -> str:
        body = (
            '<?xml version="1.0" encoding="utf-8" ?>'
            '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>'
        )
        root = await self._propfind(f"{server_url}/", auth, body)
        href_el = root.find(f".//{_tag('d', 'current-user-principal')}/{_tag('d', 'href')}")
        if href_el is None or not href_el.text:
            raise AppException(status_code=502, code="CALDAV_PRINCIPAL_NOT_FOUND", message="Could not discover your Apple Calendar principal.")
        return self._absolute(server_url, href_el.text)

    async def _discover_calendar_home(self, principal_url: str, auth: httpx.BasicAuth) -> str:
        body = (
            '<?xml version="1.0" encoding="utf-8" ?>'
            '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            "<d:prop><c:calendar-home-set/></d:prop></d:propfind>"
        )
        root = await self._propfind(principal_url, auth, body)
        href_el = root.find(f".//{_tag('c', 'calendar-home-set')}/{_tag('d', 'href')}")
        if href_el is None or not href_el.text:
            raise AppException(status_code=502, code="CALDAV_HOME_NOT_FOUND", message="Could not discover your Apple Calendar home.")
        return self._absolute(principal_url, href_el.text)

    async def _discover_writable_calendar(self, calendar_home_url: str, auth: httpx.BasicAuth) -> str:
        body = (
            '<?xml version="1.0" encoding="utf-8" ?>'
            '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            "<d:prop><d:resourcetype/><c:supported-calendar-component-set/><d:displayname/></d:prop>"
            "</d:propfind>"
        )
        root = await self._propfind(calendar_home_url, auth, body, depth="1")
        for response_el in root.findall(_tag("d", "response")):
            resourcetype = response_el.find(f".//{_tag('d', 'resourcetype')}")
            if resourcetype is None or resourcetype.find(_tag("c", "calendar")) is None:
                continue
            comp_set = response_el.findall(f".//{_tag('c', 'supported-calendar-component-set')}/{_tag('c', 'comp')}")
            supports_vevent = any(el.get("name") == "VEVENT" for el in comp_set) if comp_set else True
            if not supports_vevent:
                continue
            href_el = response_el.find(_tag("d", "href"))
            if href_el is not None and href_el.text:
                return self._absolute(calendar_home_url, href_el.text)
        raise AppException(status_code=502, code="CALDAV_CALENDAR_NOT_FOUND", message="No writable calendar found in your Apple Calendar account.")

    @staticmethod
    def _absolute(base_url: str, href: str) -> str:
        if href.startswith("http"):
            return href
        scheme_end = base_url.find("://") + 3
        origin = base_url[: base_url.find("/", scheme_end)] if "/" in base_url[scheme_end:] else base_url
        return f"{origin}{href}"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _auth(self, connection: dict) -> httpx.BasicAuth:
        return httpx.BasicAuth(connection["username"], decrypt_value(connection["app_password_encrypted"]))

    async def _mark_error(self, user_id: str, message: str) -> None:
        await self.db.caldav_connections.update_one(
            {"user_id": user_id},
            {"$set": {"status": "error", "last_error": message, "updated_at": utc_now()}},
        )
        logger.warning("CalDAV error for user=%s: %s", user_id, message)

    @staticmethod
    def _build_vevent(uid: str, event: dict) -> bytes:
        cal = ICalCalendar()
        cal.add("prodid", "-//GoCustify AI//Calendar Sync//EN")
        cal.add("version", "2.0")
        vevent = ICalEvent()
        vevent.add("uid", uid)
        vevent.add("summary", event.get("title") or "Untitled Event")
        vevent.add("dtstart", event["starts_at"])
        vevent.add("dtend", event["ends_at"])
        vevent.add("dtstamp", utc_now())
        if event.get("description"):
            vevent.add("description", event["description"])
        location = event.get("meeting_link") or event.get("location")
        if location:
            vevent.add("location", location)
        cal.add_component(vevent)
        return cal.to_ical()
