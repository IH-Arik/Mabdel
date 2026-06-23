"""
One-time utility: reset a user's dashboard password.
Usage: USER_ID=<mongo_id> NEW_PASSWORD=<pw> python scripts/_reset_pw.py
Reads MONGODB_URI / DATABASE_NAME from .env.
"""
import asyncio
import os
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

MONGODB_URI = os.environ["MONGODB_URI"]
DATABASE_NAME = os.environ.get("DATABASE_NAME", "mabdel")
USER_ID = os.environ.get("USER_ID", "")
NEW_PASSWORD = os.environ.get("NEW_PASSWORD", "")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def update():
    if not USER_ID or not NEW_PASSWORD:
        print("Set USER_ID and NEW_PASSWORD env vars before running.")
        return
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    hashed = pwd.hash(NEW_PASSWORD)
    result = await db.users.update_one(
        {"_id": ObjectId(USER_ID)},
        {"$set": {"hashed_password": hashed, "password_hash": hashed, "updated_at": datetime.utcnow()}},
    )
    print(f"Modified: {result.modified_count}")
    client.close()
    print("Password updated successfully.")


asyncio.run(update())
