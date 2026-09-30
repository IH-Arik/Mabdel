from __future__ import annotations

import asyncio

from app.tests.test_ai_call_scheduling import _owner_with_org
from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _receptionist


def _rule(**overrides):
    return {
        "id": "r1",
        "name": "Emergency Service",
        "trigger_description": "caller has an urgent HVAC issue",
        "questions_to_ask": ["What is your address?", "What is the issue?"],
        "provider_id": None,
        "appointment_type_id": None,
        "notify_target": None,
        "crm_note": None,
        "active": True,
        **overrides,
    }


def test_playbooks_persist_and_are_cleaned(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "playbook-persist@example.com")
    rule = _rule(questions_to_ask=["  What is your address?  ", "", "  "])
    response = client.patch("/api/v1/smartflow/ai-call-settings", headers=headers, json={"call_routing_rules": [rule]})
    assert response.status_code == 200, response.text
    saved = response.json()["data"]["call_routing_rules"]
    assert len(saved) == 1 and saved[0]["name"] == "Emergency Service"
    assert saved[0]["questions_to_ask"] == ["What is your address?"]  # blanks dropped, trimmed

    fetched = client.get("/api/v1/smartflow/ai-call-settings", headers=headers).json()["data"]
    assert fetched["call_routing_rules"][0]["id"] == "r1"


def test_playbook_appears_in_the_receptionists_instructions_with_provider_and_type_resolved(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "playbook-prompt@example.com")
    provider = asyncio.run(mock_db.providers.insert_one({"user_id": owner_id, "name": "On-call Tech", "active": True}))
    appt_type = asyncio.run(mock_db.appointment_types.insert_one({"user_id": owner_id, "name": "Emergency Dispatch", "duration_minutes": 60, "active": True}))
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner_id},
            {"$set": {"ai_call_settings.call_routing_rules": [
                _rule(
                    provider_id=str(provider.inserted_id),
                    appointment_type_id=str(appt_type.inserted_id),
                    notify_target="the on-call technician",
                    crm_note="Emergency dispatch requested",
                )
            ]}},
        )
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())

    assert "CALL PLAYBOOKS" in instructions
    assert "Emergency Service - when: caller has an urgent HVAC issue" in instructions
    assert "Ask: What is your address? | What is the issue?" in instructions
    assert "Book with: provider On-call Tech, type Emergency Dispatch" in instructions
    assert "Notify: the on-call technician (use notify_team)" in instructions
    assert "Note: Emergency dispatch requested" in instructions


def test_no_playbooks_configured_adds_nothing(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "playbook-none@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())
    assert "CALL PLAYBOOKS" not in instructions


def test_an_inactive_playbook_is_left_out_of_the_instructions(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "playbook-inactive@example.com")
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner_id},
            {"$set": {"ai_call_settings.call_routing_rules": [_rule(active=False)]}},
        )
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    instructions = asyncio.run(agent.build_instructions())
    assert "CALL PLAYBOOKS" not in instructions and "Emergency Service" not in instructions


def test_notify_team_tool_creates_a_team_notification(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "playbook-notify@example.com")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI(), FakeCallControl())
    result = asyncio.run(agent._tool_notify_team(note="Burst pipe at 12 Main St, needs urgent dispatch.", playbook="Emergency Service"))
    assert result == {"notified": True}

    notification = asyncio.run(mock_db.notifications.find_one({"user_id": owner_id, "type": "call"}))
    assert notification is not None
    assert "Emergency Service" in notification["title"] and "Burst pipe" in notification["body"]
    assert agent.captured_requests[-1]["intent"] == "playbook_notify"
