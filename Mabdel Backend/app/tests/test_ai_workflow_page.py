from __future__ import annotations

from app.services.smartflow._base import SmartFlowBase
from app.tests.test_smartflow_messages import _create_contact, _without_real_ai
from app.tests.test_team_direct_messaging import _same_org, _signup


def test_a_teammate_can_name_a_contact_the_owner_created(client, mock_db, monkeypatch):
    _without_real_ai(monkeypatch)
    owner_headers, owner_id = _signup(client, mock_db, "wf-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "wf-mate@example.com", "Mate")
    stranger_headers, _ = _signup(client, mock_db, "wf-stranger@example.com", "Stranger")
    _same_org(mock_db, owner_id, mate_id)
    _create_contact(client, owner_headers, name="Jamil Miah", email="jamil@example.com")

    body = {"workflow_intent": "invoice", "transcript": "Create invoice for Jamil of $250"}
    mate = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=mate_headers, json=body).json()["data"]["prefill"]
    assert mate["client_name"] == "Jamil Miah" and mate["client_email"] == "jamil@example.com"

    other = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=stranger_headers, json=body).json()["data"]["prefill"]
    assert other.get("client_email", "") != "jamil@example.com"  # another business never sees it


def test_what_the_model_extracts_is_merged_into_the_form(client, mock_db, monkeypatch):
    headers, _ = _signup(client, mock_db, "wf-model@example.com", "Owner")

    async def model(self, intent, transcript, current_values):
        return {"notes": "from the model", "currency": "EUR"}

    monkeypatch.setattr(SmartFlowBase, "_extract_workflow_prefill_with_ai", model)
    response = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=headers, json={"workflow_intent": "invoice", "transcript": "Invoice Sarah 500"})
    prefill = response.json()["data"]["prefill"]
    assert prefill["notes"] == "from the model" and prefill["currency"] == "EUR"


def test_an_unsupported_request_falls_back_to_the_assistant_chat(client, mock_db, monkeypatch):
    _without_real_ai(monkeypatch)
    headers, _ = _signup(client, mock_db, "wf-chat@example.com", "Owner")
    data = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=headers, json={"transcript": "What is the weather like"}).json()["data"]
    assert data["workflow"]["intent"] == "unknown" and data["navigation"]["path"] == "/voice-conversation"
