from __future__ import annotations

import asyncio
from datetime import datetime

from app.repositories.rbac_repository import RBACRepository

# Regression: owner.py's /team/{user_id}/permissions endpoint saved a per-user
# allowlist to rbac_user_restrictions, but get_user_effective_permissions never
# read that collection - every team member kept their role's full default
# permission set no matter what the owner restricted them to.


async def _seed_role_with_permissions(db, role_slug: str, perm_keys: list[str]) -> str:
    perm_ids = []
    for module, action in (p.split(":") for p in perm_keys):
        result = await db.rbac_permissions.insert_one({"module": module, "action": action})
        perm_ids.append(result.inserted_id)

    role = await db.rbac_roles.insert_one(
        {"slug": role_slug, "is_active": True, "permission_ids": perm_ids}
    )
    return str(role.inserted_id)


async def _assign_role(db, user_id: str, role_id: str, role_slug: str) -> None:
    await db.rbac_user_roles.insert_one({"user_id": user_id, "role_id": role_id, "role_slug": role_slug})


def test_a_restriction_caps_the_users_effective_permissions_below_role_defaults(mock_db):
    async def run():
        role_id = await _seed_role_with_permissions(
            mock_db, "restriction-test-staff", ["restriction_mod_a:view", "restriction_mod_a:edit", "restriction_mod_b:view"]
        )
        await _assign_role(mock_db, "user-1", role_id, "restriction-test-staff")
        await mock_db.rbac_user_restrictions.insert_one(
            {
                "user_id": "user-1",
                "allowed_permissions": ["restriction_mod_a:view"],
                "updated_at": datetime.utcnow(),
            }
        )

        repo = RBACRepository(mock_db)
        return await repo.get_user_effective_permissions("user-1")

    perms = asyncio.run(run())
    assert perms == {"restriction_mod_a:view"}


def test_no_restriction_doc_leaves_role_defaults_untouched(mock_db):
    async def run():
        role_id = await _seed_role_with_permissions(
            mock_db, "restriction-test-manager", ["restriction_mod_c:view", "restriction_mod_c:edit"]
        )
        await _assign_role(mock_db, "user-2", role_id, "restriction-test-manager")

        repo = RBACRepository(mock_db)
        return await repo.get_user_effective_permissions("user-2")

    perms = asyncio.run(run())
    assert perms == {"restriction_mod_c:view", "restriction_mod_c:edit"}
