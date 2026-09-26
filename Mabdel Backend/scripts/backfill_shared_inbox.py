"""One-off backfill for the shared Unified inbox. Dry run by default; --apply writes.

    python -m scripts.backfill_shared_inbox
    python -m scripts.backfill_shared_inbox --apply

1. Every conversation gets ``last_message_at`` = its newest message's time (the list
   sorts on it; threads with no messages fall back to ``updated_at``).
2. Customer threads (WhatsApp, Messenger, Instagram, email, SMS, ...) get their owner's
   ``organization_id`` so the whole team sees them, and ``assigned_to: None``.
3. WhatsApp contacts whose id is a phone number (``8801...@s.whatsapp.net``) get
   ``phone`` filled in, so the same person can be linked across channels.

Safe to run again: it only fills fields that are missing.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.services.smartflow._base import SmartFlowBase


async def backfill(db, *, apply: bool) -> dict:
    stats = {"last_message_at": 0, "organization_id": 0, "assigned_to": 0, "contact_phone": 0}
    org_by_owner: dict[str, str | None] = {}

    async def owner_org(owner_id: str) -> str | None:
        if owner_id not in org_by_owner:
            user = await db.users.find_one({"_id": ObjectId(owner_id)}, {"organization_id": 1}) if ObjectId.is_valid(owner_id) else None
            org_by_owner[owner_id] = (user or {}).get("organization_id")
        return org_by_owner[owner_id]

    async for conversation in db.conversations.find({}):
        fixes: dict = {}
        if not conversation.get("last_message_at"):
            latest = await db.messages.find({"conversation_id": str(conversation["_id"])}).sort("timestamp", -1).limit(1).to_list(1)
            fixes["last_message_at"] = (latest[0].get("timestamp") if latest else None) or conversation.get("updated_at") or conversation.get("created_at")
            stats["last_message_at"] += 1
        if SmartFlowBase._is_customer_conversation(conversation):
            if not conversation.get("organization_id"):
                organization_id = await owner_org(str(conversation.get("user_id") or ""))
                if organization_id:
                    fixes["organization_id"] = organization_id
                    stats["organization_id"] += 1
            if "assigned_to" not in conversation:
                fixes["assigned_to"] = None
                stats["assigned_to"] += 1
        if fixes and apply:
            await db.conversations.update_one({"_id": conversation["_id"]}, {"$set": fixes})

    async for contact in db.contacts.find({"phone": {"$in": [None, ""]}, "identities.platform": "whatsapp"}):
        for identity in contact.get("identities") or []:
            local, _, domain = str(identity.get("external_id") or "").partition("@")
            number = local.split(":")[0]
            if identity.get("platform") == "whatsapp" and number.isdigit() and domain in ("", "s.whatsapp.net", "c.us"):
                stats["contact_phone"] += 1
                if apply:
                    await db.contacts.update_one({"_id": contact["_id"]}, {"$set": {"phone": f"+{number}"}})
                break
    return stats


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: report only)")
    args = parser.parse_args()
    db = AsyncIOMotorClient(settings.MONGODB_URI)[settings.DATABASE_NAME]
    stats = await backfill(db, apply=args.apply)
    print(("APPLIED" if args.apply else "DRY RUN (nothing written)") + f": {stats}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
