"""Force-push the current DEFAULT_CONTENT_PAGES legal text into the live content_pages
collection.

ensure_defaults() only writes on first insert ($setOnInsert), so it will never overwrite
legal pages that already exist in the database. This script uses ContentService.upsert_page
directly to push the up-to-date text for every page in DEFAULT_CONTENT_PAGES (Terms &
Conditions, Privacy Policy, SMS Messaging Policy, Acceptable Use Policy, Refund Policy,
Protocols for Law Enforcement, About Us, Help & Support), inserting any that don't exist yet
and overwriting the ones that do. It is idempotent - safe to run multiple times.

Usage (from the Mabdel Backend directory, with the venv active):

    python -m scripts.sync_legal_content

It reads MONGODB_URI / DATABASE_NAME from the .env file in this directory (same as the app),
so point that .env at production before running there.
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

# Add backend directory to path so `app.*` imports resolve when run as a script.
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.dependencies import get_mongo_database  # noqa: E402
from app.services.content_service import DEFAULT_CONTENT_PAGES, ContentService  # noqa: E402


async def sync_legal_content() -> None:
    print("Connecting to DB...")
    db = await get_mongo_database()
    service = ContentService(db)

    print(f"Syncing {len(DEFAULT_CONTENT_PAGES)} content page(s)...")
    for page in DEFAULT_CONTENT_PAGES:
        slug = page["slug"]
        result = await service.upsert_page(dict(page))
        print(f"  - {slug}: OK (version {result.version}, {len(result.blocks)} blocks)")

    print("Done. All content pages are now in sync with DEFAULT_CONTENT_PAGES.")


if __name__ == "__main__":
    asyncio.run(sync_legal_content())
