"""
One-time script to create or update the Owner account.
Run from project root: python -m scripts.setup_owner

Reads MONGODB_URI and DATABASE_NAME from .env (or environment).
OWNER_EMAIL defaults to ittesafarik@gmail.com — override with env var.
"""
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# Load .env from project root
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

MONGODB_URI = os.environ["MONGODB_URI"]
DATABASE_NAME = os.environ.get("DATABASE_NAME", "mabdel")

OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "ittesafarik@gmail.com")
OWNER_NAME = os.environ.get("OWNER_NAME", "Arik")
DEFAULT_PASSWORD = os.environ.get("OWNER_DEFAULT_PASSWORD", "Owner@123456")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def run():
    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    db = client[DATABASE_NAME]

    print("\n=== Mabdel Owner Setup ===")
    print(f"Database : {DATABASE_NAME}")
    print(f"Email    : {OWNER_EMAIL}\n")

    # ── 1. Find or create user ─────────────────────────────────────────────────
    user = await db.users.find_one({"email": OWNER_EMAIL.lower()})
    if user:
        user_id = str(user["_id"])
        current_role = user.get("role", "user")
        has_pw = bool(user.get("hashed_password") or user.get("password_hash"))
        print(f"[OK] User found  id={user_id}  current_role={current_role}  has_password={has_pw}")

        if not has_pw:
            hashed_pw = pwd_ctx.hash(DEFAULT_PASSWORD)
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"hashed_password": hashed_pw, "updated_at": datetime.utcnow()}},
            )
            print(f"[OK] Password set to default: {DEFAULT_PASSWORD}")
        else:
            print("[OK] Password already set — not changed")
    else:
        hashed_pw = pwd_ctx.hash(DEFAULT_PASSWORD)
        result = await db.users.insert_one({
            "email": OWNER_EMAIL.lower(),
            "full_name": OWNER_NAME,
            "name": OWNER_NAME,
            "hashed_password": hashed_pw,
            "role": "owner",
            "primary_role": "owner",
            "status": "active",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        user_id = str(result.inserted_id)
        print(f"[OK] New user created  id={user_id}")
        print(f"     Default password : {DEFAULT_PASSWORD}")

    # ── 2. Ensure RBAC owner role exists ──────────────────────────────────────
    owner_role = await db.rbac_roles.find_one({"slug": "owner"})
    if not owner_role:
        print("[WARN] 'owner' RBAC role not found. Run seed_rbac.py first.")
        client.close()
        sys.exit(1)

    role_id = str(owner_role["_id"])
    print(f"[OK] RBAC 'owner' role found  id={role_id}")

    # ── 3. Assign RBAC role (idempotent) ──────────────────────────────────────
    existing = await db.rbac_user_roles.find_one({"user_id": user_id, "role_slug": "owner"})
    if existing:
        print("[OK] RBAC assignment already exists — skipping")
    else:
        await db.rbac_user_roles.insert_one({
            "user_id": user_id,
            "role_id": role_id,
            "role_slug": "owner",
            "assigned_by": "system_setup",
            "organization_id": None,
            "assigned_at": datetime.utcnow(),
            "expires_at": None,
            "is_active": True,
        })
        print("[OK] RBAC 'owner' role assigned")

    client.close()
    print(f"\n=== Done ===")
    print(f"Sign in at : http://localhost:3000/sign-in")
    print(f"Email      : {OWNER_EMAIL}")
    print()


if __name__ == "__main__":
    asyncio.run(run())
