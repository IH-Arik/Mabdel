from __future__ import annotations

from app.core.config import settings


def test_health_and_readiness_include_security_headers(client):
    health_response = client.get("/health")
    readiness_response = client.get("/ready")
    login_response = client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": "wrong-password"})

    assert health_response.status_code == 200
    assert readiness_response.status_code == 200
    assert health_response.headers["x-request-id"]
    assert health_response.headers["x-content-type-options"] == "nosniff"
    assert health_response.headers["x-frame-options"] == "DENY"
    assert login_response.headers["cache-control"] == "no-store"
    assert readiness_response.json()["data"]["status"] in {"ready", "degraded"}


def test_auth_endpoints_are_rate_limited(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_REQUESTS", 2)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)

    payload = {"email": "ratelimit@example.com", "password": "wrong-password"}
    headers = {"x-forwarded-for": "203.0.113.99"}
    first = client.post("/api/v1/auth/login", json=payload, headers=headers)
    second = client.post("/api/v1/auth/login", json=payload, headers=headers)
    third = client.post("/api/v1/auth/login", json=payload, headers=headers)

    assert first.status_code in {401, 403}
    assert second.status_code in {401, 403}
    assert third.status_code == 429
    assert third.json()["error"]["code"] == "RATE_LIMITED"
