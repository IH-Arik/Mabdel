"""
Run once (or re-run safely) to seed system roles and permissions into MongoDB.

Usage:
    python -m scripts.seed_rbac

Set MONGODB_URI + DATABASE_NAME env vars (or relies on .env via python-dotenv).
"""

from __future__ import annotations

import asyncio
import os
import sys

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
    # ── Platform-level permissions (super_admin / admin) ──────────────────────
    ("users",         "view",    "View Users",           "View platform user list and profiles"),
    ("users",         "create",  "Create Users",         "Create new user accounts"),
    ("users",         "edit",    "Edit Users",           "Edit user profiles and statuses"),
    ("users",         "delete",  "Delete Users",         "Delete user accounts"),
    ("users",         "approve", "Approve Users",        "Approve user registrations"),
    ("users",         "export",  "Export Users",         "Export user data to CSV/Excel"),
    ("users",         "manage",  "Manage Users",         "Full user management access"),

    ("admins",        "view",    "View Admins",          "View the admin/staff directory"),
    ("admins",        "create",  "Create Admins",        "Create new admin accounts"),
    ("admins",        "edit",    "Edit Admins",          "Edit admin accounts and permissions"),
    ("admins",        "delete",  "Delete Admins",        "Remove admin accounts"),
    ("admins",        "manage",  "Manage Admins",        "Full admin management"),

    ("roles",         "view",    "View Roles",           "View roles and their permissions"),
    ("roles",         "create",  "Create Roles",         "Create new roles"),
    ("roles",         "edit",    "Edit Roles",           "Edit role names and settings"),
    ("roles",         "delete",  "Delete Roles",         "Delete custom roles"),
    ("roles",         "manage",  "Manage Roles",         "Assign/revoke roles to users"),

    ("permissions",   "view",    "View Permissions",     "View permission definitions"),
    ("permissions",   "manage",  "Manage Permissions",   "Modify permission assignments"),

    ("reports",       "view",    "View Reports",         "View user reports and complaints"),
    ("reports",       "approve", "Action Reports",       "Warn, dismiss, or resolve reports"),
    ("reports",       "export",  "Export Reports",       "Export moderation logs"),

    ("earnings",      "view",    "View Earnings",        "View revenue and transaction summaries"),
    ("earnings",      "export",  "Export Earnings",      "Export financial reports"),
    ("earnings",      "manage",  "Manage Earnings",      "Process payouts and adjustments"),

    ("subscriptions", "view",    "View Subscriptions",   "View subscription plans and users"),
    ("subscriptions", "manage",  "Manage Subscriptions", "Create/edit/delete subscription plans"),

    ("settings",      "view",    "View Settings",        "View platform settings"),
    ("settings",      "edit",    "Edit Settings",        "Edit platform settings and content"),

    ("ai_logs",       "view",    "View AI Logs",         "View AI usage statistics and logs"),
    ("ai_logs",       "manage",  "Manage AI",            "Configure AI system settings"),

    ("activities",    "view",    "View Activities",      "View activity listings"),
    ("activities",    "create",  "Create Activities",    "Create new activities"),
    ("activities",    "edit",    "Edit Activities",      "Edit activity details"),
    ("activities",    "delete",  "Delete Activities",    "Delete activities"),
    ("activities",    "approve", "Approve Activities",   "Approve or cancel activities"),
    ("activities",    "manage",  "Manage Activities",    "Full activity management"),

    ("events",        "view",    "View Events",          "View event listings"),
    ("events",        "create",  "Create Events",        "Create new events"),
    ("events",        "edit",    "Edit Events",          "Edit event details"),
    ("events",        "delete",  "Delete Events",        "Delete events"),
    ("events",        "approve", "Approve Events",       "Approve or cancel events"),
    ("events",        "manage",  "Manage Events",        "Full event management"),

    ("categories",    "view",    "View Categories",      "View category listings"),
    ("categories",    "create",  "Create Categories",    "Create new categories"),
    ("categories",    "edit",    "Edit Categories",      "Edit categories"),
    ("categories",    "delete",  "Delete Categories",    "Delete categories"),
    ("categories",    "manage",  "Manage Categories",    "Full category management"),

    ("audit_logs",    "view",    "View Audit Logs",      "View RBAC audit trail"),
    ("audit_logs",    "export",  "Export Audit Logs",    "Export audit log data"),

    ("organizations", "view",    "View Organizations",   "View organization details"),
    ("organizations", "manage",  "Manage Organizations", "Full organization management"),

    # ── CRM / App-level permissions ───────────────────────────────────────────
    ("contacts",      "view",    "View Contacts",        "View contact list and profiles"),
    ("contacts",      "create",  "Create Contacts",      "Create new contacts"),
    ("contacts",      "edit",    "Edit Contacts",        "Edit contact details and avatar"),
    ("contacts",      "delete",  "Delete Contacts",      "Delete contacts"),
    ("contacts",      "export",  "Export Contacts",      "Export contact data to CSV/Excel"),

    ("messages",      "view",    "View Messages",        "View conversations and inbox"),
    ("messages",      "send",    "Send Messages",        "Send, reply, and forward messages"),

    ("calls",         "view",    "View Calls",           "View call logs and summaries"),
    ("calls",         "listen",  "Listen to Recordings", "Access call recordings and transcripts"),
    ("calls",         "manage",  "Manage Calls",         "Create outbound calls and update call logs"),

    ("appointments",  "view",    "View Appointments",    "View calendar events and appointments"),
    ("appointments",  "create",  "Book Appointments",    "Create new appointments"),
    ("appointments",  "edit",    "Edit Appointments",    "Edit appointment details"),
    ("appointments",  "cancel",  "Cancel Appointments",  "Cancel/delete appointments"),

    ("invoices",      "view",    "View Invoices",        "View invoices and timelines"),
    ("invoices",      "create",  "Create Invoices",      "Create new invoices"),
    ("invoices",      "edit",    "Edit/Send Invoices",   "Edit, send, remind, and update invoice status"),

    ("leases",        "view",    "View Leases",          "View lease agreements and their status"),
    ("leases",        "create",  "Create Leases",        "Draft and generate new lease agreements"),
    ("leases",        "edit",    "Edit Leases",          "Edit, send for signature, and renew leases"),
    ("leases",        "delete",  "Delete Leases",        "Delete lease agreements"),

    ("agreements",    "view",    "View Agreements",      "View agreements and their status"),
    ("agreements",    "create",  "Create Agreements",    "Draft and generate new agreements"),
    ("agreements",    "edit",    "Edit Agreements",      "Edit, send for signature, and renew agreements"),
    ("agreements",    "delete",  "Delete Agreements",    "Delete agreements"),

    ("bulk_messaging","view",    "View Bulk Campaigns",  "View bulk message campaigns"),
    ("bulk_messaging","create",  "Create Bulk Campaigns","Create and edit bulk message drafts"),
    ("bulk_messaging","send",    "Send Bulk Campaigns",  "Send and cancel bulk message campaigns"),

    ("social_media",  "view",    "View Social Posts",    "View social media post history"),
    ("social_media",  "post",    "Post to Social Media", "Create and publish social media posts"),

    ("ai_tools",      "use",     "Use AI Tools",         "Access AI chat, image generation, and voice features"),

    ("chat_groups",   "view",    "View Chat Groups",     "View and participate in chat groups"),
    ("chat_groups",   "manage",  "Manage Chat Groups",   "Create, update, and manage chat groups and members"),

    ("integrations",  "view",    "View Integrations",    "View connected platform integrations"),
    ("integrations",  "manage",  "Manage Integrations",  "Connect, sync, and disconnect integrations"),
]


# ─── Role Definitions ─────────────────────────────────────────────────────────

ROLES: list[dict] = [
    {
        "slug": "super_admin",
        "name": "Super Admin",
        "description": "Highest-level platform authority with full access.",
        "hierarchy_level": 100,
        "is_system": True,
        "permissions": "*",
    },
    {
        "slug": "admin",
        "name": "Admin",
        "description": "Platform admin — manages users, content, and reports.",
        "hierarchy_level": 80,
        "is_system": True,
        "permissions": [
            ("users",        "view"),
            ("users",        "edit"),
            ("users",        "manage"),
            ("admins",       "view"),
            ("reports",      "view"),
            ("reports",      "approve"),
            ("earnings",     "view"),
            ("subscriptions","view"),
            ("settings",     "view"),
            ("settings",     "edit"),
            ("ai_logs",      "view"),
            ("activities",   "view"),
            ("activities",   "approve"),
            ("events",       "view"),
            ("events",       "approve"),
            ("categories",   "view"),
            ("categories",   "create"),
            ("categories",   "edit"),
            ("roles",        "view"),
            ("audit_logs",   "view"),
        ],
    },
    {
        "slug": "owner",
        "name": "Owner",
        "description": "Full control of the company — all CRM features and team management.",
        "hierarchy_level": 60,
        "is_system": True,
        "permissions": [
            # Platform
            ("users",        "view"),
            ("users",        "edit"),
            ("users",        "create"),
            ("users",        "manage"),
            ("roles",        "view"),
            ("roles",        "manage"),
            ("audit_logs",   "view"),
            # CRM — full access
            ("contacts",     "view"),
            ("contacts",     "create"),
            ("contacts",     "edit"),
            ("contacts",     "delete"),
            ("contacts",     "export"),
            ("messages",     "view"),
            ("messages",     "send"),
            ("calls",        "view"),
            ("calls",        "listen"),
            ("calls",        "manage"),
            ("appointments", "view"),
            ("appointments", "create"),
            ("appointments", "edit"),
            ("appointments", "cancel"),
            ("invoices",     "view"),
            ("invoices",     "create"),
            ("invoices",     "edit"),
            ("leases",       "view"),
            ("leases",       "create"),
            ("leases",       "edit"),
            ("leases",       "delete"),
            ("agreements",   "view"),
            ("agreements",   "create"),
            ("agreements",   "edit"),
            ("agreements",   "delete"),
            ("bulk_messaging","view"),
            ("bulk_messaging","create"),
            ("bulk_messaging","send"),
            ("social_media", "view"),
            ("social_media", "post"),
            ("ai_tools",     "use"),
            ("chat_groups",  "view"),
            ("chat_groups",  "manage"),
            ("integrations", "view"),
            ("integrations", "manage"),
        ],
    },
    {
        "slug": "manager",
        "name": "Manager",
        "description": "Runs business operations and supervises team. No billing or system settings.",
        "hierarchy_level": 40,
        "is_system": True,
        "permissions": [
            ("contacts",      "view"),
            ("contacts",      "edit"),
            ("messages",      "view"),
            ("messages",      "send"),
            ("calls",         "view"),
            ("calls",         "listen"),
            ("appointments",  "view"),
            ("appointments",  "create"),
            ("appointments",  "edit"),
            ("appointments",  "cancel"),
            ("invoices",      "view"),
            ("invoices",      "edit"),
            ("leases",        "view"),
            ("leases",        "edit"),
            ("agreements",    "view"),
            ("agreements",    "edit"),
            ("bulk_messaging","view"),
            ("bulk_messaging","create"),
            ("bulk_messaging","send"),
            ("social_media",  "view"),
            ("social_media",  "post"),
            ("ai_tools",      "use"),
            ("chat_groups",   "view"),
            ("chat_groups",   "manage"),
            ("integrations",  "view"),
            ("integrations",  "manage"),
            ("settings",      "view"),
            ("users",         "view"),
        ],
    },
    {
        "slug": "staff",
        "name": "Staff",
        "description": "Handles assigned work. No exports, billing, or system access.",
        "hierarchy_level": 20,
        "is_system": True,
        "permissions": [
            ("contacts",     "view"),
            ("contacts",     "edit"),
            ("messages",     "view"),
            ("messages",     "send"),
            ("calls",        "view"),
            ("calls",        "listen"),
            ("appointments",  "view"),
            ("appointments",  "create"),
            ("appointments",  "edit"),
            ("invoices",      "view"),
            ("invoices",      "edit"),
            ("leases",        "view"),
            ("leases",        "edit"),
            ("agreements",    "view"),
            ("agreements",    "edit"),
            ("bulk_messaging","view"),
            ("social_media",  "view"),
            ("social_media",  "post"),
            ("ai_tools",      "use"),
            ("chat_groups",   "view"),
            ("integrations",  "view"),
        ],
    },
    {
        "slug": "assistant",
        "name": "Assistant",
        "description": "Front-line communication and scheduling. Minimal data access.",
        "hierarchy_level": 10,
        "is_system": True,
        "permissions": [
            ("contacts",      "view"),
            ("contacts",      "edit"),
            ("messages",      "view"),
            ("messages",      "send"),
            ("calls",         "view"),
            ("calls",         "listen"),
            ("appointments",  "view"),
            ("appointments",  "create"),
            ("appointments",  "edit"),
            ("invoices",      "view"),
            ("invoices",      "edit"),
            ("leases",        "view"),
            ("leases",        "edit"),
            ("agreements",    "view"),
            ("agreements",    "edit"),
            ("social_media",  "view"),
            ("social_media",  "post"),
            ("ai_tools",      "use"),
            ("chat_groups",   "view"),
        ],
    },
]


async def seed_database(db) -> None:
    """Upsert all system permissions and roles into the given database."""
    await db.rbac_permissions.create_index([("module", 1), ("action", 1)], unique=True)
    await db.rbac_roles.create_index("slug", unique=True)

    # Upsert permissions
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

    print(f"Seeded {len(perm_lookup)} permissions.")

    all_perm_ids = list(perm_lookup.values())

    # Upsert roles
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
    print("\nRBAC seed complete.")


async def seed() -> None:
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")
    await seed_database(db)
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
