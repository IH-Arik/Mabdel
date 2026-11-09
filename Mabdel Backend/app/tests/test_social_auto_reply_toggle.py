from __future__ import annotations

import asyncio

from app.tests.test_ai_call_settings import _owner_with_org


def test_owner_can_enable_social_auto_reply(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "auto-reply-owner@example.com")

    response = client.patch(
        "/api/v1/smartflow/integrations/social-auto-reply", headers=headers, json={"enabled": True}
    )

    assert response.status_code == 200
    assert response.json()["data"]["enabled"] is True
    org = asyncio.run(mock_db.organizations.find_one({"organization_id": organization_id}))
    assert org["social_auto_reply_enabled"] is True


def test_owner_can_disable_social_auto_reply(client, mock_db):
    headers, organization_id = _owner_with_org(client, mock_db, "auto-reply-owner2@example.com")
    asyncio.run(mock_db.organizations.insert_one({"organization_id": organization_id, "social_auto_reply_enabled": True}))

    response = client.patch(
        "/api/v1/smartflow/integrations/social-auto-reply", headers=headers, json={"enabled": False}
    )

    assert response.status_code == 200
    org = asyncio.run(mock_db.organizations.find_one({"organization_id": organization_id}))
    assert org["social_auto_reply_enabled"] is False
