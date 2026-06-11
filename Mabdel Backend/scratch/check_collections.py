import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    print(f"Connecting to MONGODB_URI: {settings.MONGODB_URI[:35]}...")
    print(f"DATABASE_NAME: {settings.DATABASE_NAME}")
    
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    
    collections = await db.list_collection_names()
    print("Collections:", collections)
    
    for coll_name in ["user_reports", "users", "settings", "invoices", "plans"]:
        if coll_name in collections:
            doc = await db[coll_name].find_one()
            print(f"\nSample from '{coll_name}':")
            if doc:
                doc_print = {k: str(v) if k == "_id" else v for k, v in doc.items()}
                print(doc_print)
            else:
                print("Empty collection")

if __name__ == "__main__":
    asyncio.run(main())
