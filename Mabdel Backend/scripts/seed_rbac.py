"""
Run once to seed system roles and permissions into MongoDB.

Usage:
    python -m scripts.seed_rbac

Set MONGODB_URI + DATABASE_NAME env vars (or relies on .env via python-dotenv).
"""

from __future__ import annotations

import asyncio
import os
import sys

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "mabdel")

# ─── Permission Definitions ───────────────────────────────────────────────────
# (module, action, label, description)

PERMISSIONS: list[tuple[str, str, str, str]] = [
    # Users
    ("users", "view",    "View Users",    "View platform user list and profiles"),
    ("users", "create",  "Create Users",  "Create new user accounts"),
    ("users", "edit",    "Edit Users",    "Edit user profiles and statuses"),
    ("users", "delete",  "Delete Users",  "Delete user accounts"),
    ("users", "approve", "Approve Users", "Approve user registrations or verifications"),
    ("users", "export",  "Export Users",  "Export user data to CSV/Excel"),
    ("users", "manage",  "Manage Users",  "Full user management access"),

    # Admins
    ("admins", "view",   "View Admins",   "View the admin/staff directory"),
    ("admins", "create", "Create Admins", "Create new admin/staff accounts"),
    ("admins", "edit",   "Edit Admins",   "Edit admin accounts and permissions"),
    ("admins", "delete", "Delete Admins", "Remove admin accounts"),
    ("admins", "manage", "Manage Admins", "Full admin management"),

    # Owners
    ("owners", "view",   "View Owners",   "View business owner accounts"),
    ("owners", "create", "Create Owners", "Create owner accounts"),
    ("owners", "edit",   "Edit Owners",   "Edit owner account settings"),
    ("owners", "delete", "Delete Owners", "Remove owner accounts"),
    ("owners", "manage", "Manage Owners", "Full owner management"),

    # Roles & Permissions
    ("roles",       "view",   "View Roles",       "View roles and their permissions"),
    ("roles",       "create", "Create Roles",     "Create new roles"),
    ("roles",       "edit",   "Edit Roles",       "Edit role names and settings"),
    ("roles",       "delete", "Delete Roles",     "Delete custom roles"),
    ("roles",       "manage", "Manage Roles",     "Assign/revoke roles to users"),
    ("permissions", "view",   "View Permissions", "View permission definitions"),
    ("permissions", "manage", "Manage Permissions", "Modify permission assignments"),

    # Reports (Moderation)
    ("reports", "view",    "View Reports",    "View user reports and complaints"),
    ("reports", "approve", "Action Reports",  "Warn, dismiss, or resolve reports"),
    ("reports", "export",  "Export Reports",  "Export moderation logs"),

    # Earnings / Billing
    ("earnings", "view",   "View Earnings",    "View revenue and transaction summaries"),
    ("earnings", "export", "Export Earnings",  "Export financial reports"),
    ("earnings", "manage", "Manage Earnings",  "Process payouts and adjustments"),

    # Subscriptions
    ("subscriptions", "view",   "View Subscriptions",   "View subscription plans and users"),
    ("subscriptions", "manage", "Manage Subscriptions", "Create/edit/delete subscription plans and fees"),

    # Content / Settings
    ("settings", "view", "View Settings", "View platform settings and static pages"),
    ("settings", "edit", "Edit Settings", "Edit platform settings and static content"),

    # AI Logs
    ("ai_logs", "view",   "View AI Logs",   "View AI usage statistics and logs"),
    ("ai_logs", "manage", "Manage AI",      "Configure AI system settings"),

    # Activities
    ("activities", "view",    "View Activities",    "View activity listings"),
    ("activities", "create",  "Create Activities",  "Create new activities"),
    ("activities", "edit",    "Edit Activities",    "Edit activity details"),
    ("activities", "delete",  "Delete Activities",  "Delete activities"),
    ("activities", "approve", "Approve Activities", "Approve or cancel activities"),
    ("activities", "manage",  "Manage Activities",  "Full activity management"),

    # Events
    ("events", "view",    "View Events",    "View event listings"),
    ("events", "create",  "Create Events",  "Create new events"),
    ("events", "edit",    "Edit Events",    "Edit event details"),
    ("events", "delete",  "Delete Events",  "Delete events"),
    ("events", "approve", "Approve Events", "Approve or cancel events"),
    ("events", "manage",  "Manage Events",  "Full event management"),

    # Categories
    ("categories", "view",   "View Categories",   "View category listings"),
    ("categories", "create", "Create Categories", "Create new categories"),
    ("categories", "edit",   "Edit Categories",   "Edit categories"),
    ("categories", "delete", "Delete Categories", "Delete categories"),
    ("categories", "manage", "Manage Categories", "Full category management"),

    # Audit Logs
    ("audit_logs", "view",   "View Audit Logs",   "View RBAC audit trail"),
    ("audit_logs", "export", "Export Audit Logs", "Export audit log data"),

    # Organizations
    ("organizations", "view",   "View Organizations",   "View organization details"),
    ("organizations", "manage", "Manage Organizations", "Full organization management"),
]

# ─── Role Definitions ─────────────────────────────────────────────────────────
# slug → (name, description, hierarchy_level, is_system, list of (module, action) grants)

ROLES: list[dict] = [
    {
        "slug": "super_admin",
        "name": "Super Admin",
        "description": "Highest-level system authority with full platform control.",
        "hierarchy_level": 100,
        "is_system": True,
        # super_admin gets all permissions — handled via wildcard in service
        "permissions": "*",
    },
    {
        "slug": "admin",
        "name": "Admin",
        "description": "Platform admin — assistant to Super Admin. Permissions are controlled by Super Admin.",
        "hierarchy_level": 80,
        "is_system": True,
        "permissions": [
            # Default admin permissions — Super Admin can adjust these
            ("users",       "view"),
            ("users",       "edit"),
            ("users",       "manage"),
            ("admins",      "view"),
            ("reports",     "view"),
            ("reports",     "approve"),
            ("earnings",    "view"),
            ("subscriptions", "view"),
            ("settings",    "view"),
            ("settings",    "edit"),
            ("ai_logs",     "view"),
            ("activities",  "view"),
            ("activities",  "approve"),
            ("events",      "view"),
            ("events",      "approve"),
            ("categories",  "view"),
            ("categories",  "create"),
            ("categories",  "edit"),
            ("roles",       "view"),
            ("audit_logs",  "view"),
        ],
    },
    {
        "slug": "owner",
        "name": "Owner",
        "description": "Business/company account owner. Manages their own org scope.",
        "hierarchy_level": 60,
        "is_system": True,
        "permissions": [
            ("users",       "view"),
            ("users",       "edit"),
            ("users",       "create"),
            ("users",       "manage"),
            ("roles",       "view"),
            ("roles",       "manage"),
            ("activities",  "view"),
            ("activities",  "manage"),
            ("events",      "view"),
            ("events",      "manage"),
            ("categories",  "view"),
            ("earnings",    "view"),
            ("subscriptions", "view"),
            ("settings",    "view"),
            ("audit_logs",  "view"),
        ],
    },
    {
        "slug": "supervisor",
        "name": "Supervisor",
        "description": "Monitors staff and manages assigned operational tasks.",
        "hierarchy_level": 40,
        "is_system": True,
        "permissions": [
            ("users",       "view"),
            ("activities",  "view"),
            ("activities",  "approve"),
            ("events",      "view"),
            ("events",      "approve"),
            ("reports",     "view"),
            ("categories",  "view"),
            ("settings",    "view"),
        ],
    },
    {
        "slug": "staff",
        "name": "Staff",
        "description": "Limited access based on explicitly assigned permissions only.",
        "hierarchy_level": 20,
        "is_system": True,
        "permissions": [
            # Minimal — can only see what is explicitly needed
            ("users",       "view"),
            ("activities",  "view"),
            ("events",      "view"),
            ("categories",  "view"),
            ("settings",    "view"),
        ],
    },
]


async def seed() -> None:
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]

    print(f"Connected to MongoDB: {DATABASE_NAME}")

    # 1. Ensure indexes
    await db.rbac_permissions.create_index([("module", 1), ("action", 1)], unique=True)
    await db.rbac_roles.create_index("slug", unique=True)

    # 2. Upsert permissions and build lookup table
    perm_lookup: dict[tuple[str, str], str] = {}
    for module, action, label, description in PERMISSIONS:
        result = await db.rbac_permissions.find_one_and_update(
            {"module": module, "action": action},
            {
                "$setOnInsert": {"created_at": __import__("datetime").datetime.utcnow(), "is_system": True},
                "$set": {"label": label, "description": description},
            },
            upsert=True,
            return_document=True,
        )
        perm_lookup[(module, action)] = str(result["_id"])
        print(f"  Permission: {module}:{action}")

    print(f"\nSeeded {len(perm_lookup)} permissions.")

    # 3. Collect all permission IDs for super_admin
    all_perm_ids = list(perm_lookup.values())

    # 4. Upsert roles
    for role_def in ROLES:
        slug = role_def["slug"]
        perms_spec = role_def["permissions"]

        if perms_spec == "*":
            perm_ids = all_perm_ids
        else:
            perm_ids = [perm_lookup[key] for key in perms_spec if key in perm_lookup]

        result = await db.rbac_roles.find_one_and_update(
            {"slug": slug},
            {
                "$setOnInsert": {
                    "created_at": __import__("datetime").datetime.utcnow(),
                    "created_by": None,
                },
                "$set": {
                    "name": role_def["name"],
                    "description": role_def["description"],
                    "hierarchy_level": role_def["hierarchy_level"],
                    "is_system": role_def["is_system"],
                    "is_active": True,
                    "permission_ids": perm_ids,
                    "updated_at": __import__("datetime").datetime.utcnow(),
                },
            },
            upsert=True,
            return_document=True,
        )
        print(f"  Role: {slug} (level={role_def['hierarchy_level']}, perms={len(perm_ids)})")

    print(f"\nSeeded {len(ROLES)} roles.")
    print("\nRBAC seed complete. ✓")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
