from __future__ import annotations

import asyncio

from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "stripe-connect@example.com") -> tuple[dict[str, str], str]:
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Stripe User", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify.status_code == 200
    grant_owner_role(mock_db, email)

    async def _self_reference_org():
        user = await mock_db.users.find_one({"email": email})
        await mock_db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"organization_id": str(user["_id"]), "role": "owner", "primary_role": "owner"}},
        )
        return str(user["_id"])

    organization_id = asyncio.run(_self_reference_org())

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, organization_id


class FakeAccount:
    def __init__(self, id="acct_123", details_submitted=False, charges_enabled=False, payouts_enabled=False):
        self.id = id
        self.details_submitted = details_submitted
        self.charges_enabled = charges_enabled
        self.payouts_enabled = payouts_enabled


class FakeAccountLink:
    url = "https://connect.stripe.com/setup/e/acct_123/abc"


class FakePrice:
    id = "price_123"


class FakePaymentLink:
    url = "https://buy.stripe.com/test_abc123"


class FakeAccountsResource:
    def __init__(self, store: dict):
        self.store = store

    def create(self, params):
        account = FakeAccount(id=f"acct_{len(self.store) + 1}")
        self.store[account.id] = account
        return account

    def retrieve(self, account_id, params=None):
        return self.store.get(account_id, FakeAccount(id=account_id))


class FakeAccountLinksResource:
    def create(self, params):
        return FakeAccountLink()


class FakePricesResource:
    def create(self, params):
        return FakePrice()


class FakePaymentLinksResource:
    def __init__(self):
        self.calls: list[dict] = []

    def create(self, params):
        self.calls.append(params)
        return FakePaymentLink()


def _install_fake_stripe(monkeypatch, account_store: dict, payment_link_calls: list):
    class Client:
        def __init__(self, api_key):
            self.accounts = FakeAccountsResource(account_store)
            self.account_links = FakeAccountLinksResource()
            self.prices = FakePricesResource()
            self.payment_links = FakePaymentLinksResource()
            self.payment_links.calls = payment_link_calls

    class FakeStripeModule:
        StripeClient = Client
        StripeError = Exception
        SignatureVerificationError = Exception

    import app.services.stripe_connect_service as connect_module
    import app.services.invoice_service as invoice_module

    monkeypatch.setattr(connect_module, "stripe", FakeStripeModule)
    monkeypatch.setattr(invoice_module, "stripe", FakeStripeModule)
    monkeypatch.setattr(connect_module.settings, "STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setattr(invoice_module.settings, "STRIPE_SECRET_KEY", "sk_test_fake")


def test_status_defaults_to_not_connected(client, mock_db):
    headers, _ = _auth_headers(client, mock_db)
    response = client.get("/api/v1/stripe/connect/status", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["stripe_account_id"] is None
    assert data["stripe_charges_enabled"] is False


def test_onboarding_creates_account_and_status_reflects_charges_enabled(client, mock_db, monkeypatch):
    headers, organization_id = _auth_headers(client, mock_db, email="stripe-onboard@example.com")
    account_store: dict = {}
    _install_fake_stripe(monkeypatch, account_store, [])

    onboard = client.post("/api/v1/stripe/connect/onboard", headers=headers)
    assert onboard.status_code == 200, onboard.text
    onboarding_url = onboard.json()["data"]["onboarding_url"]
    assert onboarding_url == FakeAccountLink.url

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": organization_id}))
    assert org["stripe_account_id"] in account_store

    account_store[org["stripe_account_id"]].charges_enabled = True
    account_store[org["stripe_account_id"]].details_submitted = True
    account_store[org["stripe_account_id"]].payouts_enabled = True

    status_response = client.get("/api/v1/stripe/connect/status", headers=headers)
    data = status_response.json()["data"]
    assert data["stripe_charges_enabled"] is True
    assert data["stripe_payouts_enabled"] is True


def test_payment_link_requires_stripe_connected(client, mock_db):
    headers, _ = _auth_headers(client, mock_db, email="stripe-no-connect@example.com")
    create = client.post(
        "/api/v1/invoices",
        headers=headers,
        json={"client_name": "Acme LLC", "items": [{"description": "Service", "quantity": 1, "unit_price": 100}]},
    )
    assert create.status_code == 201, create.text
    invoice_id = create.json()["data"]["id"]

    response = client.post(f"/api/v1/invoices/{invoice_id}/payment-link", headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "STRIPE_NOT_CONNECTED"


def test_payment_link_and_webhook_marks_invoice_paid(client, mock_db, monkeypatch):
    headers, organization_id = _auth_headers(client, mock_db, email="stripe-paylink@example.com")
    account_store = {"acct_connected": FakeAccount(id="acct_connected", charges_enabled=True, details_submitted=True, payouts_enabled=True)}
    payment_link_calls: list[dict] = []
    _install_fake_stripe(monkeypatch, account_store, payment_link_calls)

    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": organization_id},
            {"$set": {"organization_id": organization_id, "stripe_account_id": "acct_connected", "stripe_charges_enabled": True}},
            upsert=True,
        )
    )

    create = client.post(
        "/api/v1/invoices",
        headers=headers,
        json={"client_name": "Acme LLC", "items": [{"description": "Service", "quantity": 2, "unit_price": 50}]},
    )
    assert create.status_code == 201, create.text
    invoice_id = create.json()["data"]["id"]

    link_response = client.post(f"/api/v1/invoices/{invoice_id}/payment-link", headers=headers)
    assert link_response.status_code == 200, link_response.text
    payment_url = link_response.json()["data"]["payment_url"]
    assert payment_url == FakePaymentLink.url
    assert payment_link_calls[0]["metadata"] == {"invoice_id": invoice_id, "type": "invoice_payment"}
    assert payment_link_calls[0]["transfer_data"] == {"destination": "acct_connected"}

    import app.api.dashboard.webhooks as webhooks_module

    monkeypatch.setattr(webhooks_module.settings, "STRIPE_WEBHOOK_SECRET", None)

    webhook_response = client.post(
        "/api/v1/dashboard/webhooks/stripe",
        json={
            "type": "checkout.session.completed",
            "data": {"object": {"metadata": {"invoice_id": invoice_id, "type": "invoice_payment"}}},
        },
    )
    assert webhook_response.status_code == 200, webhook_response.text

    invoice_response = client.get(f"/api/v1/invoices/{invoice_id}", headers=headers)
    assert invoice_response.json()["data"]["status"] == "paid"


def test_webhook_ignores_non_invoice_payment_events(client, mock_db, monkeypatch):
    """An event type the subscription-billing branch (dashboard_service.handle_stripe_webhook)
    doesn't recognize should just no-op with a 200, not get routed to mark_paid_from_stripe."""
    import app.api.dashboard.webhooks as webhooks_module

    monkeypatch.setattr(webhooks_module.settings, "STRIPE_WEBHOOK_SECRET", None)

    response = client.post(
        "/api/v1/dashboard/webhooks/stripe",
        json={"type": "payment_intent.succeeded", "data": {"object": {"metadata": {}}}},
    )
    assert response.status_code == 200
