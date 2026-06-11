from __future__ import annotations

from app.workflows.graph import get_workflow_engine


def test_ai_command_uses_langgraph_workflow(client) -> None:
    response = client.post("/api/v1/ai/command", json={"command": "Create an invoice for Sarah"})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["intent"] == "invoice"
    assert data["summary"] == "Invoice workflow prepared."
    assert data["output"]["workflow_engine"] == "langgraph"
    assert data["output"]["invoice"]["status"] == "draft"
    assert get_workflow_engine() == "langgraph"


def test_ai_command_routes_call_intent_through_langgraph(client) -> None:
    response = client.post("/api/v1/ai/command", json={"command": "Call Sarah from SmartFlow"})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["intent"] == "call"
    assert data["summary"] == "Call workflow prepared."
    assert data["output"]["workflow_engine"] == "langgraph"
    assert data["output"]["call"]["status"] == "stream_connected"


def test_ai_command_routes_business_creation_screens_through_langgraph(client) -> None:
    cases = [
        ("Send bulk email to all clients", "bulk_message", "bulk_message"),
        ("Schedule meeting with Sarah tomorrow", "calendar", "calendar"),
        ("Create lease for Apartment 4B", "lease", "lease"),
        ("Create NDA agreement for Apex", "agreement", "agreement"),
    ]

    for command, intent, output_key in cases:
        response = client.post("/api/v1/ai/command", json={"command": command})

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["intent"] == intent
        assert data["output"]["workflow_engine"] == "langgraph"
        assert data["output"][output_key]["status"] in {"draft", "scheduled"}
