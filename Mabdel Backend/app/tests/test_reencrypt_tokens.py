from __future__ import annotations

import asyncio
import json

from app.core.crypto import fernet_for_secret
from scripts.reencrypt_tokens import reencrypt

OLD = "change-this-in-production"
NEW = "a-long-random-new-key-0123456789abcdef"


def _enc(secret: str, plaintext: str) -> str:
    return fernet_for_secret(secret).encrypt(plaintext.encode()).decode()


def _dec(secret: str, ciphertext: str) -> str:
    return fernet_for_secret(secret).decrypt(ciphertext.encode()).decode()


def _seed(mock_db):
    asyncio.run(
        mock_db.social_integrations.insert_many(
            [
                {"platform": "google_business", "access_token_encrypted": _enc(OLD, "goog-access"), "refresh_token_encrypted": _enc(OLD, "goog-refresh")},
                {"platform": "instagram", "access_token_encrypted": _enc("some-other-key", "unreadable")},
                {"platform": "zoom", "access_token_encrypted": _enc(NEW, "already-new")},
            ]
        )
    )
    asyncio.run(mock_db.calendar_connections.insert_one({"app_password_encrypted": _enc(OLD, "caldav-pass"), "note": "plain"}))


def _doc(mock_db, collection: str, **query):
    return asyncio.run(mock_db[collection].find_one(query))


def test_dry_run_reports_but_writes_nothing(mock_db):
    _seed(mock_db)

    stats = asyncio.run(reencrypt(mock_db, OLD, NEW, apply=False, backup_path=None))

    assert stats == {"to_migrate": 3, "already_migrated": 1, "undecryptable": 1, "written": 0}
    assert _dec(OLD, _doc(mock_db, "social_integrations", platform="google_business")["access_token_encrypted"]) == "goog-access"


def test_apply_migrates_across_collections_and_backs_up_ciphertext_first(mock_db, tmp_path):
    _seed(mock_db)
    original = _doc(mock_db, "social_integrations", platform="google_business")["access_token_encrypted"]
    backup = tmp_path / "backup.jsonl"

    stats = asyncio.run(reencrypt(mock_db, OLD, NEW, apply=True, backup_path=str(backup)))

    assert stats["written"] == 3
    google = _doc(mock_db, "social_integrations", platform="google_business")
    assert _dec(NEW, google["access_token_encrypted"]) == "goog-access"
    assert _dec(NEW, google["refresh_token_encrypted"]) == "goog-refresh"
    assert _dec(NEW, _doc(mock_db, "calendar_connections", note="plain")["app_password_encrypted"]) == "caldav-pass"

    rows = [json.loads(line) for line in backup.read_text().splitlines()]
    assert len(rows) == 3 and all("plaintext" not in row for row in rows)
    assert original in {row["ciphertext"] for row in rows}  # the old ciphertext is recoverable


def test_values_that_decrypt_with_neither_key_are_never_touched(mock_db, tmp_path):
    _seed(mock_db)
    before = _doc(mock_db, "social_integrations", platform="instagram")["access_token_encrypted"]

    asyncio.run(reencrypt(mock_db, OLD, NEW, apply=True, backup_path=str(tmp_path / "b.jsonl")))

    assert _doc(mock_db, "social_integrations", platform="instagram")["access_token_encrypted"] == before


def test_running_it_twice_is_a_no_op(mock_db, tmp_path):
    _seed(mock_db)
    asyncio.run(reencrypt(mock_db, OLD, NEW, apply=True, backup_path=str(tmp_path / "b1.jsonl")))

    second = asyncio.run(reencrypt(mock_db, OLD, NEW, apply=True, backup_path=str(tmp_path / "b2.jsonl")))

    assert second["to_migrate"] == 0 and second["written"] == 0
    assert second["already_migrated"] == 4  # the 3 just migrated + the one that was already on the new key
