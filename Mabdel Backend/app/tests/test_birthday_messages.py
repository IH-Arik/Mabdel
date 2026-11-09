from __future__ import annotations

import asyncio
from datetime import timedelta

from app.utils.helpers import utc_now
from app.workers.tasks.birthday_tasks import _send_due_birthday_messages


def _create_owner(mock_db, *, email: str, dob: str, last_sent: str | None = None) -> dict:
    now = utc_now()
    doc = {
        "email": email,
        "original_email": email,
        "role": "owner",
        "business_name": "Test Biz",
        "owner_dob": dob,
        "created_at": now,
    }
    if last_sent is not None:
        doc["last_birthday_message_sent_date"] = last_sent
    result = asyncio.run(mock_db.users.insert_one(doc))
    doc["_id"] = result.inserted_id
    return doc


def _fake_email_service(monkeypatch):
    from app.services.email_service import EmailService

    sent = []

    async def fake_send(self, **kwargs):
        sent.append(kwargs)

    monkeypatch.setattr(EmailService, "send", fake_send)
    return sent


def test_owner_whose_birthday_is_today_gets_a_message(mock_db, monkeypatch):
    sent = _fake_email_service(monkeypatch)
    today = utc_now().date()
    dob = today.replace(year=1990).isoformat()
    _create_owner(mock_db, email="bday-today@example.com", dob=dob)

    count = asyncio.run(_send_due_birthday_messages(mock_db))

    assert count == 1
    assert len(sent) == 1
    assert sent[0]["email"] == "bday-today@example.com"

    user = asyncio.run(mock_db.users.find_one({"email": "bday-today@example.com"}))
    assert user["last_birthday_message_sent_date"] == today.isoformat()


def test_owner_whose_birthday_is_not_today_gets_nothing(mock_db, monkeypatch):
    sent = _fake_email_service(monkeypatch)
    not_today = (utc_now() + timedelta(days=5)).date().replace(year=1985).isoformat()
    _create_owner(mock_db, email="bday-later@example.com", dob=not_today)

    count = asyncio.run(_send_due_birthday_messages(mock_db))

    assert count == 0
    assert sent == []


def test_already_sent_today_is_not_sent_twice(mock_db, monkeypatch):
    sent = _fake_email_service(monkeypatch)
    today = utc_now().date()
    dob = today.replace(year=1990).isoformat()
    _create_owner(mock_db, email="bday-dup@example.com", dob=dob, last_sent=today.isoformat())

    count = asyncio.run(_send_due_birthday_messages(mock_db))

    assert count == 0
    assert sent == []
