from __future__ import annotations

import asyncio

from app.core.config import settings
from app.services.call_service import CallService
from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_calls_api import _noop_answer, _webhook_envelope

CUSTOMER_PHONE = "+15557778888"


def _outbound_call_log(owner_id: str, *, purpose: str, sid: str = "v2:outbound-followup") -> dict:
    return {
        "user_id": owner_id,
        "twilio_call_sid": sid,
        "call_type": "outbound",
        "ai_ready": True,
        "purpose": purpose,
        "phone_number": CUSTOMER_PHONE,
        "contact_name": "Nadia",
        "status": "in-progress",
    }


def _hangup(client, monkeypatch, sid: str) -> None:
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)
    body = _webhook_envelope(
        "call.hangup",
        {"call_control_id": sid, "hangup_cause": "normal_clearing", "call_duration_secs": 30, "from": "+15550009999", "to": CUSTOMER_PHONE},
    )
    response = client.post("/api/v1/calls/webhook", content=body)
    assert response.status_code == 200, response.text


def _texts(mock_db):
    return asyncio.run(mock_db.messages.find({"platform": "sms", "automated": True}).sort("timestamp", 1).to_list(None))


def test_a_purpose_with_a_follow_up_sms_sends_it_after_the_call_ends(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "followup-sms@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "ai_call_settings": {
                    "outbound_call_purposes": [
                        {"id": "lead_follow_up", "name": "Lead Follow-Up", "active": True, "follow_up_sms": "{business}: thanks for your time today!"}
                    ]
                },
            }
        )
    )
    asyncio.run(mock_db.call_logs.insert_one(_outbound_call_log(owner_id, purpose="lead_follow_up")))

    _hangup(client, monkeypatch, "v2:outbound-followup")

    [text] = _texts(mock_db)
    assert text["content"] == "Bright Dental: thanks for your time today!"


def test_a_purpose_with_no_follow_up_sms_configured_sends_nothing(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "followup-sms-none@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "ai_call_settings": {"outbound_call_purposes": [{"id": "missed_call_callback", "name": "Missed-Call Callback", "active": True}]},
            }
        )
    )
    asyncio.run(mock_db.call_logs.insert_one(_outbound_call_log(owner_id, purpose="missed_call_callback", sid="v2:outbound-none")))

    _hangup(client, monkeypatch, "v2:outbound-none")

    assert _texts(mock_db) == []


def test_an_inbound_calls_hangup_never_triggers_a_follow_up_sms(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "followup-sms-inbound@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "ai_call_settings": {
                    "outbound_call_purposes": [{"id": "lead_follow_up", "name": "Lead Follow-Up", "active": True, "follow_up_sms": "should never send"}]
                },
            }
        )
    )
    asyncio.run(
        mock_db.call_logs.insert_one(
            {
                "user_id": owner_id,
                "twilio_call_sid": "v2:inbound-call",
                "call_type": "incoming",
                "ai_ready": True,
                "purpose": "lead_follow_up",  # should be ignored - this field only means something on an outbound call
                "from_number": CUSTOMER_PHONE,
                "status": "in-progress",
            }
        )
    )

    _hangup(client, monkeypatch, "v2:inbound-call")

    assert _texts(mock_db) == []


def test_the_hangup_webhook_firing_twice_only_sends_the_text_once(client, mock_db, monkeypatch):
    headers, owner_id = _owner_with_org(client, mock_db, "followup-sms-dedupe@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner_id,
                "business_name": "Bright Dental",
                "telnyx_phone_number": "+15550009999",
                "ai_call_settings": {
                    "outbound_call_purposes": [{"id": "lead_follow_up", "name": "Lead Follow-Up", "active": True, "follow_up_sms": "{business}: thanks!"}]
                },
            }
        )
    )
    asyncio.run(mock_db.call_logs.insert_one(_outbound_call_log(owner_id, purpose="lead_follow_up", sid="v2:outbound-dupe")))

    _hangup(client, monkeypatch, "v2:outbound-dupe")
    _hangup(client, monkeypatch, "v2:outbound-dupe")

    assert len(_texts(mock_db)) == 1
