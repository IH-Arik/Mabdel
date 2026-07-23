from __future__ import annotations

import asyncio
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

from app.api.v1.auth_routes import get_email_service
from app.core.config import settings
from app.core.database import get_database, mongo_manager
from app.core.http import AuthRateLimitMiddleware
from app.main import app
from app.repositories.app_config_repository import AppConfigRepository
from app.repositories.onboarding_repository import OnboardingRepository


class FakeEmailService:
    async def send_otp_email(self, email: str, otp_code: str, purpose: str) -> None:
        return None

    async def send_invoice_email(self, email: str, subject: str, text: str, html: str) -> None:
        return None


def _reset_auth_rate_limiter(middleware) -> None:
    current = middleware
    while current is not None:
        if isinstance(current, AuthRateLimitMiddleware):
            current._hits.clear()
            return
        current = getattr(current, "app", None)


async def _seed_defaults(db) -> None:
    await AppConfigRepository(db).ensure_defaults()
    await OnboardingRepository(db).ensure_default_slides()
    from scripts.seed_rbac import seed_database
    await seed_database(db)


def grant_owner_role(db, email: str) -> None:
    """Self-signup users get the permissionless 'user' role; most CRM endpoints need owner."""
    from app.repositories.rbac_repository import RBACRepository

    async def _grant() -> None:
        user = await db.users.find_one({"email": email})
        role = await db.rbac_roles.find_one({"slug": "owner"})
        assert user is not None and role is not None
        await RBACRepository(db).assign_role(
            user_id=str(user["_id"]),
            role_id=str(role["_id"]),
            role_slug="owner",
            assigned_by="test",
        )

    asyncio.run(_grant())


@pytest.fixture(scope="function")
def mock_db():
    original_public_backend_url = settings.PUBLIC_BACKEND_URL
    settings.PUBLIC_BACKEND_URL = "http://127.0.0.1:8000"
    client = AsyncMongoMockClient()
    db = client["test_mabdel_auth_db"]

    mongo_manager.client = client
    mongo_manager.database = db
    asyncio.run(mongo_manager.ensure_indexes())
    asyncio.run(_seed_defaults(db))
    yield db

    mongo_manager.client = None
    mongo_manager.database = None
    settings.PUBLIC_BACKEND_URL = original_public_backend_url


@pytest.fixture(scope="function")
def client(mock_db) -> Generator[TestClient, None, None]:
    async def override_get_database():
        return mock_db

    app.dependency_overrides[get_database] = override_get_database
    app.dependency_overrides[get_email_service] = lambda: FakeEmailService()

    with TestClient(app) as test_client:
        _reset_auth_rate_limiter(app.middleware_stack)
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client_sql(client) -> Generator[TestClient, None, None]:
    yield client
