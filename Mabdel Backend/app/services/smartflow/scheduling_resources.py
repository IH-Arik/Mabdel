"""Shared ownership, eligibility and physical location capacity checks."""

from __future__ import annotations

from datetime import timezone

from app.core.exceptions import AppException

from ._base import SmartFlowBase


class SchedulingResources(SmartFlowBase):
    async def selection(
        self, user_id, *, provider_id=None, appointment_type_id=None, location_id=None
    ):
        resources = []
        for collection, resource_id, code in (
            (self.db.providers, provider_id, "PROVIDER_NOT_FOUND"),
            (
                self.db.appointment_types,
                appointment_type_id,
                "APPOINTMENT_TYPE_NOT_FOUND",
            ),
            (self.db.business_locations, location_id, "LOCATION_NOT_FOUND"),
        ):
            item = (
                await self._get_team_document(collection, user_id, resource_id, code)
                if resource_id
                else None
            )
            if item and not item.get("active", True):
                raise AppException(
                    status_code=409,
                    code=code,
                    message="The selected scheduling resource is inactive.",
                )
            resources.append(item)
        provider, appointment_type, location = resources
        for allowed, selected, label in (
            (
                (appointment_type or {}).get("eligible_provider_ids"),
                provider_id,
                "provider",
            ),
            (
                (appointment_type or {}).get("eligible_location_ids"),
                location_id,
                "location",
            ),
            ((provider or {}).get("location_ids"), location_id, "location"),
        ):
            if allowed and selected not in allowed:
                raise AppException(
                    status_code=409,
                    code="SCHEDULING_RESOURCE_INELIGIBLE",
                    message=f"Choose an eligible {label} for this appointment.",
                )
        return provider, appointment_type, location

    async def location_ranges(
        self,
        user_id,
        location_id,
        starts_at,
        ends_at,
        *,
        exclude_event_id=None,
        exclude_request_id=None,
    ):
        team_ids = await self._resolve_team_user_ids(user_id)
        event_filter = {
            "user_id": {"$in": team_ids},
            "location_id": location_id,
            "status": {"$ne": "cancelled"},
            "starts_at": {"$lt": ends_at},
            "ends_at": {"$gt": starts_at},
        }
        from bson import ObjectId

        if exclude_event_id:
            event_filter["_id"] = {"$ne": ObjectId(exclude_event_id)}
        events = await self.db.calendar_events.find(event_filter).to_list(length=None)
        ranges = [(item["starts_at"], item["ends_at"]) for item in events]
        org_id = await self._resolve_organization_id(user_id)
        if org_id:
            pending_filter = {
                "organization_id": org_id,
                "location_id": location_id,
                "status": "pending",
                "kind": {"$ne": "cancel"},
                "requested_start": {"$lt": ends_at},
                "requested_end": {"$gt": starts_at},
            }
            if exclude_request_id:
                pending_filter["_id"] = {"$ne": ObjectId(exclude_request_id)}
            pending = await self.db.call_meeting_requests.find(pending_filter).to_list(
                length=None
            )
            ranges.extend(
                (item["requested_start"], item["requested_end"]) for item in pending
            )
        return ranges

    @staticmethod
    def has_capacity(ranges, starts_at, ends_at, capacity):
        def utc(value):
            return (
                value.replace(tzinfo=timezone.utc)
                if value.tzinfo is None
                else value.astimezone(timezone.utc)
            )

        start, end = utc(starts_at), utc(ends_at)
        points = []
        for lo, hi in ranges:
            lo, hi = max(start, utc(lo)), min(end, utc(hi))
            if lo < hi:
                points.extend(((lo, 1), (hi, -1)))
        occupied = 0
        for _, delta in sorted(points, key=lambda point: (point[0], point[1])):
            occupied += delta
            if occupied >= capacity:
                return False
        return True

    async def assert_location(
        self,
        user_id,
        location,
        starts_at,
        ends_at,
        *,
        tz,
        exclude_event_id=None,
        exclude_request_id=None,
    ):
        start = (
            starts_at.replace(tzinfo=timezone.utc)
            if starts_at.tzinfo is None
            else starts_at
        )
        end = (
            ends_at.replace(tzinfo=timezone.utc) if ends_at.tzinfo is None else ends_at
        )
        start, end = start.astimezone(tz), end.astimezone(tz)
        days, hours = location.get("working_days"), location.get("working_hours")
        closed = days is not None and start.weekday() not in days
        if hours:
            closes_at_midnight = hours["end_hour"] == 24 and end.hour == end.minute == 0
            crosses_midnight = end.date() != start.date()
            closed = closed or start.hour + start.minute / 60 < hours["start_hour"]
            closed = closed or (crosses_midnight and not closes_at_midnight)
            closed = closed or (
                not crosses_midnight and end.hour + end.minute / 60 > hours["end_hour"]
            )
        if closed:
            raise AppException(
                status_code=409,
                code="LOCATION_CLOSED",
                message="The selected location is closed at that time.",
            )
        ranges = await self.location_ranges(
            user_id,
            str(location["_id"]),
            starts_at,
            ends_at,
            exclude_event_id=exclude_event_id,
            exclude_request_id=exclude_request_id,
        )
        if not self.has_capacity(
            ranges, starts_at, ends_at, int(location.get("capacity") or 1)
        ):
            raise AppException(
                status_code=409,
                code="CALENDAR_CONFLICT",
                message="The selected location is fully booked at that time.",
            )
