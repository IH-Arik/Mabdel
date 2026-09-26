"""Re-encrypt every stored token from an old secret to a new one (encryption key rotation).

Changing OAUTH_TOKEN_ENCRYPTION_KEY (or SECRET_KEY while the former is empty) makes every
saved token unreadable, so integrations would all need reconnecting. This migrates them
instead. Dry run by default; --apply writes.

    export REENCRYPT_OLD_KEY='<the secret tokens are encrypted with now>'
    export REENCRYPT_NEW_KEY='<the new OAUTH_TOKEN_ENCRYPTION_KEY>'
    python -m scripts.reencrypt_tokens                       # report only
    python -m scripts.reencrypt_tokens --apply --backup-file /path/tokens-backup.jsonl

Keys are read from the environment so they never land in shell history or the process
list. Before writing anything, every ciphertext about to change is saved to the backup
file (ciphertext only - never plaintext). It is safe to run again: values that already
decrypt with the new key are skipped, and values that decrypt with neither are left
untouched and counted, never overwritten. Nothing secret is printed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from cryptography.fernet import InvalidToken
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.crypto import fernet_for_secret


async def reencrypt(db, old_secret: str, new_secret: str, *, apply: bool, backup_path: str | None) -> dict:
    old = fernet_for_secret(old_secret)
    new = fernet_for_secret(new_secret)
    stats = {"to_migrate": 0, "already_migrated": 0, "undecryptable": 0, "written": 0}
    pending: list[tuple[str, object, dict, dict]] = []  # (collection, _id, new values, old values)

    for name in sorted(await db.list_collection_names()):
        async for doc in db[name].find({}):
            updates: dict[str, str] = {}
            originals: dict[str, str] = {}
            for field, value in doc.items():
                if not field.endswith("_encrypted") or not isinstance(value, str) or not value:
                    continue
                try:
                    updates[field] = new.encrypt(old.decrypt(value.encode("utf-8"))).decode("utf-8")
                    originals[field] = value
                    stats["to_migrate"] += 1
                    continue
                except InvalidToken:
                    pass
                try:
                    new.decrypt(value.encode("utf-8"))
                    stats["already_migrated"] += 1
                except InvalidToken:
                    stats["undecryptable"] += 1
            if updates:
                pending.append((name, doc["_id"], updates, originals))

    if apply and pending:
        if not backup_path:
            raise SystemExit("--apply needs --backup-file (ciphertext backup written before any change).")
        with open(backup_path, "w", encoding="utf-8") as backup:
            for name, doc_id, _updates, originals in pending:
                for field, value in originals.items():
                    backup.write(json.dumps({"collection": name, "_id": str(doc_id), "field": field, "ciphertext": value}) + "\n")
            backup.flush()
            os.fsync(backup.fileno())
        for name, doc_id, updates, _originals in pending:
            await db[name].update_one({"_id": doc_id}, {"$set": updates})
            stats["written"] += len(updates)
    return stats


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="actually write (default is a dry run)")
    parser.add_argument("--backup-file", help="where to save the ciphertext backup (required with --apply)")
    args = parser.parse_args()

    old_secret = os.environ.get("REENCRYPT_OLD_KEY")
    new_secret = os.environ.get("REENCRYPT_NEW_KEY")
    if not old_secret or not new_secret:
        print("Set REENCRYPT_OLD_KEY and REENCRYPT_NEW_KEY in the environment.", file=sys.stderr)
        return 1
    if old_secret == new_secret:
        print("Old and new keys are identical - nothing to do.", file=sys.stderr)
        return 1

    db = AsyncIOMotorClient(settings.MONGODB_URI)[settings.DATABASE_NAME]
    stats = await reencrypt(db, old_secret, new_secret, apply=args.apply, backup_path=args.backup_file)
    print(("APPLIED" if args.apply else "DRY RUN (nothing written)") + f": {stats}")
    if stats["undecryptable"]:
        print(f"{stats['undecryptable']} value(s) decrypt with neither key and were left untouched.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
