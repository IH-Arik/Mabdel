"""One-time migration: mark existing colleague-thread history as already read.

Unread state in a thread between colleagues used to be stored per *message*
(``unread_count``, derived from direction) and is now stored per *viewer* (the
``read_by`` array, the model global chat already used). Every message written under
the old scheme has an empty ``read_by``, so without this migration the switch-over
would light up every historical message as unread for everyone at once.

This walks the shared conversations (global chats and any thread with more than one
member) and records each member as having read everything already there, so the new
badges start from a clean slate and only new messages count.

Safe to run multiple times — $addToSet will not duplicate, and messages sent after
the migration are untouched because they already carry the sender in read_by.

Usage:
    python -m scripts.backfill_team_message_read_state
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "mabdel_db")


async def backfill(db) -> dict:
    conversations_touched = 0
    messages_touched = 0

    cursor = db.conversations.find(
        {"$or": [{"is_global_chat": True}, {"member_ids": {"$exists": True}}]},
        {"_id": 1, "member_ids": 1, "is_global_chat": 1, "user_id": 1},
    )
    async for conversation in cursor:
        member_ids = list(conversation.get("member_ids") or [])
        if not conversation.get("is_global_chat") and len(member_ids) <= 1:
            continue  # external-channel inbox: still uses the unread_count model

        # The owner may predate member_ids and not be listed in it.
        readers = list({*member_ids, conversation.get("user_id")} - {None})
        if not readers:
            continue

        result = await db.messages.update_many(
            {"conversation_id": str(conversation["_id"])},
            {"$addToSet": {"read_by": {"$each": readers}}},
        )
        conversations_touched += 1
        messages_touched += result.modified_count

    return {"conversations_touched": conversations_touched, "messages_marked_read": messages_touched}


async def run() -> None:
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")

    result = await backfill(db)

    print("Backfill complete:")
    for key, value in result.items():
        print(f"  {key}: {value}")

    client.close()


if __name__ == "__main__":
    asyncio.run(run())
