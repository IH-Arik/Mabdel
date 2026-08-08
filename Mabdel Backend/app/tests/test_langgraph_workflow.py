from __future__ import annotations

import asyncio

import pytest

from app.tests.conftest import grant_owner_role
from app.workflows.graph import get_workflow_engine


@pytest.fixture
def ai_headers(client, mock_db) -> dict[str, str]:
    """/api/v1/ai/command requires the ai_tools permission and a subscription."""
    email = "langgraph@example.com"
    password = "SecurePass2024!"

    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "LangGraph User", "email": email, "password": password},
    )
    assert register.status_code == 201

    otp = asyncio.run(
        mock_db.otp_codes.find_one({"email": email, "purpose": "signup"}, sort=[("created_at", -1)])
    )
    assert otp is not None
    verify = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify.status_code == 200

    grant_owner_role(mock_db, email)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


def test_ai_command_requires_authentication(client) -> None:
    response = client.post("/api/v1/ai/command", json={"command": "Create an invoice for Sarah"})
    assert response.status_code in (401, 403)


def test_ai_command_uses_langgraph_workflow(client, ai_headers) -> None:
    response = client.post(
        "/api/v1/ai/command", headers=ai_headers, json={"command": "Create an invoice for Sarah"}
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["intent"] == "invoice"
    assert data["summary"] == "Invoice workflow prepared."
    assert data["output"]["workflow_engine"] == "langgraph"
    assert data["output"]["invoice"]["status"] == "draft"
    assert get_workflow_engine() == "langgraph"


def test_ai_command_routes_call_intent_through_langgraph(client, ai_headers) -> None:
    response = client.post(
        "/api/v1/ai/command", headers=ai_headers, json={"command": "Call Sarah from SmartFlow"}
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["intent"] == "call"
    assert data["summary"] == "Call workflow prepared."
    assert data["output"]["workflow_engine"] == "langgraph"
    assert data["output"]["call"]["status"] == "stream_connected"


def test_ai_command_routes_business_creation_screens_through_langgraph(client, ai_headers) -> None:
    cases = [
        ("Send bulk email to all clients", "bulk_message", "bulk_message"),
        ("Schedule meeting with Sarah tomorrow", "calendar", "calendar"),
        ("Create lease for Apartment 4B", "lease", "lease"),
        ("Create NDA agreement for Apex", "agreement", "agreement"),
    ]

    for command, intent, output_key in cases:
        response = client.post("/api/v1/ai/command", headers=ai_headers, json={"command": command})

        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["intent"] == intent
        assert data["output"]["workflow_engine"] == "langgraph"
        assert data["output"][output_key]["status"] in {"draft", "scheduled"}
