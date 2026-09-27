"""Link appointments booked by the AI phone agent before this change to their customer.

Older AI bookings kept the caller only inside the event's description text, so a later
change or cancellation could not text them. This fills ``customer``/``source`` on those
events and ``calendar_event_id`` on the matching booking record. Dry run by default.

    python -m scripts.link_ai_appointments
    python -m scripts.link_ai_appointments --apply
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.services.smartflow._base import SmartFlowBase

AI_MARKERS = ("Auto-booked by AI Phone Agent", "Booked from an AI phone call", "Booked by the AI receptionist")
CALLER_RE = re.compile(r"Caller:\s*(?P<name>[^()]+?)\s*(?:\((?P<phone>[^)]+)\))?\s*$")


async def link(db, *, apply: bool) -> dict:
    stats = {"events": 0, "linked": 0, "no_phone": 0, "requests_linked": 0}
    async for event in db.calendar_events.find({"customer": {"$exists": False}, "description": {"$regex": "|".join(AI_MARKERS)}}):
        stats["events"] += 1
        match = CALLER_RE.search(event.get("description") or "")
        if not match:
            continue
        name = match.group("name").strip()
        phone = SmartFlowBase._normalize_phone_value(match.group("phone") or "") or None
        if not phone:
            stats["no_phone"] += 1
        request = await db.call_meeting_requests.find_one(
            {"requested_start": event.get("starts_at"), "caller_name": name, "calendar_event_id": {"$in": [None]}}
        )
        customer = {
            "name": name,
            "phone": phone,
            "email": (request or {}).get("caller_email"),
            "contact_id": None,
            "language": (request or {}).get("language"),
        }
        stats["linked"] += 1
        if request:
            stats["requests_linked"] += 1
        if apply:
            update = {"customer": customer, "source": "ai_call"}
            if request:
                update["call_meeting_request_id"] = str(request["_id"])
                await db.call_meeting_requests.update_one({"_id": request["_id"]}, {"$set": {"calendar_event_id": str(event["_id"])}})
            await db.calendar_events.update_one({"_id": event["_id"]}, {"$set": update})
    return stats


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: report only)")
    args = parser.parse_args()
    db = AsyncIOMotorClient(settings.MONGODB_URI)[settings.DATABASE_NAME]
    stats = await link(db, apply=args.apply)
    print(("APPLIED" if args.apply else "DRY RUN (nothing written)") + f": {stats}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
