from __future__ import annotations

import asyncio

from app.services.telnyx_web_voice_service import TelnyxWebVoiceService
from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "web-voice@example.com") -> dict[str, str]:
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Web Voice User", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify.status_code == 200
    grant_owner_role(mock_db, email)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


def test_voice_endpoints_require_auth(client):
    assert client.get("/api/v1/telnyx/voice/token").status_code in (401, 403)
    assert client.post("/api/v1/telnyx/voice/registration", json={"identity": "x"}).status_code in (401, 403)


def test_create_access_token_creates_connection_and_credential(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db)

    class FakeCredential:
        id = "cred_123"
        sip_username = "mabdelweb-abc"

    class FakeCredentialResponse:
        data = FakeCredential()

    class FakeConnection:
        id = "conn_123"

    class FakeConnectionResponse:
        data = FakeConnection()

    class FakeCredentialConnections:
        def create(self, **kwargs):
            return FakeConnectionResponse()

        def update(self, *args, **kwargs):
            return None

    class FakeTelephonyCredentials:
        def create(self, **kwargs):
            return FakeCredentialResponse()

        def create_token(self, credential_id):
            return "fake.jwt.token"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.credential_connections = FakeCredentialConnections()
            self.telephony_credentials = FakeTelephonyCredentials()

    import app.services.telnyx_web_voice_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeClient, "TelnyxError": Exception}))
    monkeypatch.setattr(module.settings, "TELNYX_API_KEY", "test-key")
    monkeypatch.setattr(module.settings, "PUBLIC_BACKEND_URL", "https://api.mabdel.test")

    response = client.get("/api/v1/telnyx/voice/token", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["token"] == "fake.jwt.token"
    assert data["identity"] == "mabdelweb-abc"
    assert data["refresh_after_seconds"] > 0

    # Credential is cached on the user — a second call must not create another one.
    response2 = client.get("/api/v1/telnyx/voice/token", headers=headers)
    assert response2.status_code == 200
    assert response2.json()["data"]["identity"] == "mabdelweb-abc"


def test_create_access_token_does_not_mark_registration_active_before_client_ready(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="web-voice-token-only@example.com")

    class FakeCredential:
        id = "cred_456"
        sip_username = "mabdelweb-token-only"

    class FakeCredentialResponse:
        data = FakeCredential()

    class FakeConnection:
        id = "conn_456"

    class FakeConnectionResponse:
        data = FakeConnection()

    class FakeCredentialConnections:
        def create(self, **kwargs):
            return FakeConnectionResponse()

        def update(self, *args, **kwargs):
            return None

    class FakeTelephonyCredentials:
        def create(self, **kwargs):
            return FakeCredentialResponse()

        def create_token(self, credential_id):
            return "fake.jwt.token"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.credential_connections = FakeCredentialConnections()
            self.telephony_credentials = FakeTelephonyCredentials()

    import app.services.telnyx_web_voice_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeClient, "TelnyxError": Exception}))
    monkeypatch.setattr(module.settings, "TELNYX_API_KEY", "test-key")
    monkeypatch.setattr(module.settings, "PUBLIC_BACKEND_URL", "https://api.mabdel.test")

    response = client.get("/api/v1/telnyx/voice/token", headers=headers)
    assert response.status_code == 200, response.text

    user = asyncio.run(mock_db.users.find_one({"email": "web-voice-token-only@example.com"}))
    assert user is not None
    registration = asyncio.run(mock_db.voice_device_registrations.find_one({"user_id": str(user["_id"])}))
    assert registration is None


def test_set_and_get_active_registration(mock_db):
    service = TelnyxWebVoiceService(mock_db)

    async def _run():
        await service.set_registration(user_id="user-1", identity="sipuser1", active=True)
        active = await service.get_active_registration("user-1")
        assert active is not None
        assert active["identity"] == "sipuser1"

        await service.set_registration(user_id="user-1", identity="sipuser1", active=False)
        inactive = await service.get_active_registration("user-1")
        assert inactive is None

    asyncio.run(_run())


def test_registration_endpoint_updates_voice_device_registrations(client, mock_db):
    headers = _auth_headers(client, mock_db, email="web-voice-reg@example.com")

    response = client.post(
        "/api/v1/telnyx/voice/registration",
        headers=headers,
        json={"identity": "sipuser-reg-test", "active": True},
    )
    assert response.status_code == 200

    registration = asyncio.run(mock_db.voice_device_registrations.find_one({"identity": "sipuser-reg-test"}))
    assert registration is not None
    assert registration["active"] is True
