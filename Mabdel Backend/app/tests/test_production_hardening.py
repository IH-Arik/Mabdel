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


def test_a_spoofed_x_forwarded_for_cannot_bypass_rate_limiting(client, monkeypatch):
    """Regression for B06: the rate limiter used to key on the first value in
    X-Forwarded-For, which a client fully controls - sending a different fake
    value on every request reset the limiter's counter each time. Only
    X-Real-IP (set by nginx itself, never attacker-controlled) is trusted now."""
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_REQUESTS", 2)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)

    payload = {"email": "ratelimit-spoof@example.com", "password": "wrong-password"}
    first = client.post("/api/v1/auth/login", json=payload, headers={"x-forwarded-for": "1.1.1.1"})
    second = client.post("/api/v1/auth/login", json=payload, headers={"x-forwarded-for": "2.2.2.2"})
    third = client.post("/api/v1/auth/login", json=payload, headers={"x-forwarded-for": "3.3.3.3"})

    assert first.status_code in {401, 403}
    assert second.status_code in {401, 403}
    assert third.status_code == 429  # a rotating X-Forwarded-For never reset the counter


def test_x_real_ip_distinguishes_different_clients(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_REQUESTS", 1)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)

    payload = {"email": "ratelimit-real-ip@example.com", "password": "wrong-password"}
    client_a_first = client.post("/api/v1/auth/login", json=payload, headers={"x-real-ip": "9.9.9.1"})
    client_a_second = client.post("/api/v1/auth/login", json=payload, headers={"x-real-ip": "9.9.9.1"})
    client_b_first = client.post("/api/v1/auth/login", json=payload, headers={"x-real-ip": "9.9.9.2"})

    assert client_a_first.status_code in {401, 403}
    assert client_a_second.status_code == 429  # same real client, second request within the window
    assert client_b_first.status_code in {401, 403}  # a genuinely different client is not penalized
