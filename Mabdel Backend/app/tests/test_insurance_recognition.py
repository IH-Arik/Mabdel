from __future__ import annotations

import asyncio

from app.tests.test_realtime_receptionist import FakeOpenAI, _business, _receptionist


def test_a_configured_in_network_plan_shows_up_in_the_prompt(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "insurance-in-network@example.com",
        business_type="Dental Clinic",
        insurance_plans=[
            {"id": "ins-1", "payer": "Delta Dental", "plan_name": "PPO", "accepted": True, "network_status": "in_network", "verification_required": False, "active": True}
        ],
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    instructions = asyncio.run(agent.build_instructions())

    assert "Delta Dental" in instructions and "in_network" in instructions


def test_an_unconfigured_plan_gets_no_answer_in_the_prompt_only_the_fallback_instruction(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "insurance-unconfigured@example.com",
        business_type="Medical Clinic",
        insurance_plans=[{"id": "ins-1", "payer": "Aetna", "plan_name": None, "accepted": True, "network_status": "in_network", "verification_required": False, "active": True}],
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    instructions = asyncio.run(agent.build_instructions())

    assert "don't have confirmed information" in instructions
    # The recognition dictionary (for understanding what the caller said) still
    # appears, but the prompt explicitly says recognizing a name isn't an answer.
    assert "recognizing a name is NOT the same as it being accepted" in instructions


def test_a_non_eligible_business_type_never_shows_the_insurance_block(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "insurance-not-eligible@example.com",
        business_type="Restaurant",
        insurance_plans=[{"id": "ins-1", "payer": "Delta Dental", "plan_name": None, "accepted": True, "network_status": "in_network", "verification_required": False, "active": True}],
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    instructions = asyncio.run(agent.build_instructions())

    assert "INSURANCE -" not in instructions
    assert "Delta Dental" not in instructions


def test_a_chiropractor_with_no_plans_configured_still_gets_the_block_and_fallback(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "insurance-chiro-empty@example.com", business_type="Chiropractor")
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    instructions = asyncio.run(agent.build_instructions())

    assert "No insurance plans are configured yet." in instructions


def test_an_inactive_plan_is_not_shown_as_an_answer(client, mock_db, monkeypatch):
    owner_id = _business(
        client, mock_db, monkeypatch, "insurance-inactive@example.com",
        business_type="Dental Clinic",
        insurance_plans=[{"id": "ins-1", "payer": "Guardian", "plan_name": None, "accepted": True, "network_status": "in_network", "verification_required": False, "active": False}],
    )
    agent = _receptionist(mock_db, owner_id, FakeOpenAI())

    instructions = asyncio.run(agent.build_instructions())

    assert "Guardian: accepted" not in instructions
