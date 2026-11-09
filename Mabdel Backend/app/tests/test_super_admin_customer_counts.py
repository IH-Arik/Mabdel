from __future__ import annotations

import asyncio
from datetime import timedelta

from app.services.dashboard.dashboard_service import DashboardService
from app.utils.helpers import utc_now


def _owner(mock_db, **fields) -> None:
    doc = {"role": "owner", "email": fields.pop("email")}
    doc.update(fields)
    asyncio.run(mock_db.users.insert_one(doc))


def test_paying_non_paying_and_trial_customers_are_counted_correctly(mock_db):
    now = utc_now()

    # New-style: paying.
    _owner(mock_db, email="paying@example.com", subscription_status="active", subscription_tier="growth")
    # New-style: active trial.
    _owner(
        mock_db,
        email="trial@example.com",
        subscription_status="trial",
        subscription_tier="pro",
        trial_ends_at=now + timedelta(days=3),
    )
    # New-style: trial expired -> non-paying.
    _owner(
        mock_db,
        email="expired-trial@example.com",
        subscription_status="trial",
        subscription_tier="starter",
        trial_ends_at=now - timedelta(days=1),
    )
    # New-style: no subscription at all -> non-paying.
    _owner(mock_db, email="none@example.com", subscription_status="none")
    # Legacy-shape, not expired -> grandfathered active -> paying.
    _owner(
        mock_db,
        email="legacy-active@example.com",
        subscription_plan="Monthly",
        subscription_expiration=now + timedelta(days=10),
    )

    counts = asyncio.run(DashboardService(mock_db)._get_customer_subscription_counts())

    assert counts == {"total": 5, "paying": 2, "non_paying": 2, "trial": 1}
