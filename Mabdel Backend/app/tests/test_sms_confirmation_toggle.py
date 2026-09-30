from __future__ import annotations

import asyncio
from datetime import timedelta

from app.services.smartflow.appointment_notifications import AppointmentNotifier
from app.tests.test_ai_call_settings import _owner_with_org
from app.utils.helpers import utc_now


def test_sms_confirmations_are_on_by_default(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "sms-default@example.com")
    settings = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]
    assert settings["sms_confirmations_enabled"] is True

    message_id = asyncio.run(
        AppointmentNotifier(mock_db).notify(
            owner_id, kind="booked", phone="+8801711111111", name="Karim", starts_at=utc_now() + timedelta(days=1)
        )
    )
    assert message_id is not None


def test_turning_it_off_stops_the_text_but_keeps_booking_working(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "sms-off@example.com")
    update = client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"sms_confirmations_enabled": False})
    assert update.status_code == 200 and update.json()["data"]["sms_confirmations_enabled"] is False

    for kind in ("booked", "rescheduled", "cancelled"):
        message_id = asyncio.run(
            AppointmentNotifier(mock_db).notify(
                owner_id, kind=kind, phone="+8801722222222", name="Nadia", starts_at=utc_now() + timedelta(days=1)
            )
        )
        assert message_id is None

    thread = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "sms"}))
    assert thread is None  # nothing was queued at all, not just silently sent


def test_turning_it_back_on_resumes_texting(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "sms-toggle@example.com")
    client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"sms_confirmations_enabled": False})
    client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"sms_confirmations_enabled": True})

    message_id = asyncio.run(
        AppointmentNotifier(mock_db).notify(
            owner_id, kind="booked", phone="+8801733333333", name="Rafi", starts_at=utc_now() + timedelta(days=1)
        )
    )
    assert message_id is not None


def test_other_ai_call_settings_are_unaffected_by_the_new_field(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "sms-other@example.com")
    client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"assistant_name": "Sam"})
    settings = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]
    assert settings["assistant_name"] == "Sam" and settings["sms_confirmations_enabled"] is True
