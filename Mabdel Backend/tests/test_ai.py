from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_ai_command_endpoint_routes_invoice_intent() -> None:
    response = client.post("/api/v1/ai/command", json={"command": "Create invoice for ACME"})
    body = response.json()

    assert response.status_code == 200
    assert body["data"]["intent"] == "invoice"
