from __future__ import annotations

import asyncio
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

from app.api.v1.auth_routes import get_email_service
from app.core.config import settings
from app.core.database import get_database, mongo_manager
from app.core import http as http_module
from app.core.http import AuthRateLimitMiddleware, MutationRateLimitMiddleware
from app.main import app
from app.repositories.app_config_repository import AppConfigRepository
from app.repositories.onboarding_repository import OnboardingRepository


class FakeEmailService:
    async def send_otp_email(self, email: str, otp_code: str, purpose: str) -> None:
        return None

    async def send_invoice_email(self, email: str, subject: str, text: str, html: str) -> None:
        return None


def _reset_auth_rate_limiter(middleware) -> None:
    """Clear both rate limiters between tests.

    The limiters keep per-IP counters on the shared app instance, so without
    this every test in a session spends the same budget and later tests start
    getting 429s purely because earlier ones ran.

    Only the in-memory counters live here — see ``_force_in_memory_rate_limiting``
    for why that is the only backend a test ever uses.
    """
    current = middleware
    while current is not None:
        if isinstance(current, (AuthRateLimitMiddleware, MutationRateLimitMiddleware)):
            current._hits.clear()
        current = getattr(current, "app", None)


@pytest.fixture(scope="session", autouse=True)
def _force_in_memory_rate_limiting() -> Generator[None, None, None]:
    """Pin the rate limiters to their in-memory backend for the whole test session.

    ``_redis_sliding_window`` prefers Redis whenever one is reachable, and the
    counters then live in Redis instead of the middleware's ``_hits`` dict. That
    made the per-test reset above a no-op on any machine running Redis locally:
    keys like ``rl:auth:testclient:/api/v1/auth/verify-otp`` accumulated across the
    entire session until the 20-per-60s auth budget ran out, and every later test
    that registered a user failed with 429 — tests passing or failing depending on
    whether a Redis happened to be running.

    Short-circuiting ``_get_redis`` keeps the suite hermetic and deterministic. The
    in-memory path implements the same sliding window, so the limiter's own test
    (test_production_hardening.py) still exercises real behaviour.
    """
    original_redis = http_module._redis
    original_attempted = http_module._redis_attempted
    http_module._redis = None
    http_module._redis_attempted = True  # short-circuits _get_redis() -> in-memory
    yield
    http_module._redis = original_redis
    http_module._redis_attempted = original_attempted


async def _seed_defaults(db) -> None:
    await AppConfigRepository(db).ensure_defaults()
    await OnboardingRepository(db).ensure_default_slides()
    from scripts.seed_rbac import seed_database
    await seed_database(db)


def grant_owner_role(db, email: str) -> None:
    """Self-signup users get the permissionless 'user' role; most CRM endpoints need owner."""
    grant_role(db, email, "owner")


def grant_role(db, email: str, role_slug: str) -> None:
    from app.repositories.rbac_repository import RBACRepository

    async def _grant() -> None:
        user = await db.users.find_one({"email": email})
        role = await db.rbac_roles.find_one({"slug": role_slug})
        assert user is not None and role is not None
        await RBACRepository(db).assign_role(
            user_id=str(user["_id"]),
            role_id=str(role["_id"]),
            role_slug=role_slug,
            assigned_by="test",
        )

    asyncio.run(_grant())


@pytest.fixture(scope="function")
def mock_db():
    original_public_backend_url = settings.PUBLIC_BACKEND_URL
    settings.PUBLIC_BACKEND_URL = "http://127.0.0.1:8000"
    client = AsyncMongoMockClient()
    db = client["test_gocustify_auth_db"]

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
