"""Read-only: can this process's encryption key decrypt the tokens stored in the database?

    python -m scripts.check_encrypted_tokens

Scans every collection for top-level fields ending in "_encrypted" (OAuth access/refresh
tokens, CalDAV app passwords, ...) and reports, per collection, how many decrypt with the
CURRENT key (OAUTH_TOKEN_ENCRYPTION_KEY, or SECRET_KEY when that is empty) and how many do
not. Nothing is written and no decrypted value is ever printed.

Use it before and after changing SECRET_KEY / OAUTH_TOKEN_ENCRYPTION_KEY / ENVIRONMENT:
the "cannot decrypt" count must not grow, otherwise integrations would break.
"""

from __future__ import annotations

import asyncio
import sys

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.crypto import decrypt_value
from app.core.exceptions import AppException


async def main() -> int:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    key_source = "OAUTH_TOKEN_ENCRYPTION_KEY" if settings.OAUTH_TOKEN_ENCRYPTION_KEY else "SECRET_KEY (fallback)"
    print(f"Decrypting with: {key_source}\n")

    total_ok = 0
    total_bad = 0
    for name in sorted(await db.list_collection_names()):
        ok = bad = 0
        async for doc in db[name].find({}):
            for field, value in doc.items():
                if not field.endswith("_encrypted") or not isinstance(value, str) or not value:
                    continue
                try:
                    decrypt_value(value)
                    ok += 1
                except AppException:
                    bad += 1
        if ok or bad:
            print(f"{name:28s} decrypts: {ok:4d}   cannot decrypt: {bad:4d}")
            total_ok += ok
            total_bad += bad

    print(f"\nTOTAL decrypts: {total_ok}   cannot decrypt: {total_bad}")
    return 1 if total_bad else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
