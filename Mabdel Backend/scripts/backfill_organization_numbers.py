"""One-time migration: move Telnyx numbers from the old per-user scheme to the new
per-organization scheme (one number per business, shared by the whole team).

Safe to run multiple times — already-migrated users have nothing left to migrate.

Usage:
    python -m scripts.backfill_organization_numbers

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

from motor.motor_asyncio import AsyncIOMotorClient

from app.services.telnyx_provisioning_service import TelnyxProvisioningService

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "mabdel")


async def run() -> None:
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")

    result = await TelnyxProvisioningService(db).backfill_organization_numbers()

    print("Backfill complete:")
    for key, value in result.items():
        print(f"  {key}: {value}")

    client.close()


if __name__ == "__main__":
    asyncio.run(run())
