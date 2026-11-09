from __future__ import annotations

import asyncio
from datetime import timedelta

from bson import ObjectId

from app.utils.helpers import utc_now
from app.workers.tasks.trial_tasks import _enforce_trial_expiry


def _owner_with_number(mock_db, *, email: str, trial_ends_at, setup_status: str = "active") -> tuple[str, str]:
    now = utc_now()
    user = asyncio.run(
        mock_db.users.insert_one(
            {
                "email": email,
                "role": "owner",
                "subscription_status": "trial",
                "trial_ends_at": trial_ends_at,
            }
        )
    )
    uid = str(user.inserted_id)
    asyncio.run(mock_db.users.update_one({"_id": user.inserted_id}, {"$set": {"organization_id": uid}}))
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": uid,
                "telnyx_phone_number": "+15550001111",
                "telnyx_phone_number_id": "pn_123",
                "telnyx_setup_status": setup_status,
            }
        )
    )
    return uid, "+15550001111"


def test_expired_trial_gets_suspended_and_number_is_kept_not_released(mock_db):
    uid, number = _owner_with_number(mock_db, email="expired@example.com", trial_ends_at=utc_now() - timedelta(days=1))

    suspended = asyncio.run(_enforce_trial_expiry(mock_db))

    assert suspended == 1
    user = asyncio.run(mock_db.users.find_one({"_id": ObjectId(uid)}))
    assert user["subscription_status"] == "expired"
    org = asyncio.run(mock_db.organizations.find_one({"organization_id": uid}))
    assert org["telnyx_setup_status"] == "suspended"
    assert org["telnyx_phone_number"] == number  # kept, not released


def test_trial_still_in_window_is_left_alone(mock_db):
    _owner_with_number(mock_db, email="active-trial@example.com", trial_ends_at=utc_now() + timedelta(days=2))

    suspended = asyncio.run(_enforce_trial_expiry(mock_db))

    assert suspended == 0
    org = asyncio.run(mock_db.organizations.find_one({}))
    assert org["telnyx_setup_status"] == "active"


def test_already_suspended_org_is_not_touched_again(mock_db):
    _owner_with_number(
        mock_db, email="already-suspended@example.com", trial_ends_at=utc_now() - timedelta(days=5), setup_status="suspended"
    )

    suspended = asyncio.run(_enforce_trial_expiry(mock_db))

    assert suspended == 0
