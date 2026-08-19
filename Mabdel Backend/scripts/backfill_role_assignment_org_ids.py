"""One-time migration: backfill organization_id on rbac_user_roles records that
are missing it — these were created by the role-group membership sync
(_sync_role_group_membership in app/services/smartflow/_base.py) before it was
fixed to pass organization_id, which made those team members invisible to
/owner/team (its query filters strictly by organization_id).

For each role assignment missing organization_id, copies it from the target
user's own document, since that field is already correctly set there.

Safe to run multiple times — already-backfilled assignments have nothing left
to migrate.

Usage:
    python -m scripts.backfill_role_assignment_org_ids

Set MONGODB_URI + DATABASE_NAME env vars (or relies on .env via python-dotenv).
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

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "mabdel")


async def run() -> None:
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")

    missing = await db.rbac_user_roles.find(
        {"$or": [{"organization_id": None}, {"organization_id": {"$exists": False}}]}
    ).to_list(length=None)
    print(f"Role assignments missing organization_id: {len(missing)}")

    updated = 0
    skipped_no_org = 0
    for assignment in missing:
        user_id = assignment.get("user_id")
        if not user_id or not ObjectId.is_valid(user_id):
            skipped_no_org += 1
            continue
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)}, {"organization_id": 1})
        org_id = (user_doc or {}).get("organization_id")
        if not org_id:
            skipped_no_org += 1
            continue
        await db.rbac_user_roles.update_one(
            {"_id": assignment["_id"]},
            {"$set": {"organization_id": org_id}},
        )
        updated += 1
        print(f"  backfilled {assignment.get('role_slug')} assignment for user {user_id} -> org {org_id}")

    print("Backfill complete:")
    print(f"  updated: {updated}")
    print(f"  skipped (target user has no organization_id either): {skipped_no_org}")

    client.close()


if __name__ == "__main__":
    asyncio.run(run())
