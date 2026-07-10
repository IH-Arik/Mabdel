import asyncio
from pymongo import MongoClient
from app.core.config import settings

def main():
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    
    # Update all users that don't have a role to have 'owner' role
    result = db.users.update_many(
        {"role": {"$exists": False}},
        {"$set": {"role": "owner"}}
    )
    print(f"Updated {result.modified_count} users to 'owner' role")
    
    # Also update any user with role=None
    result2 = db.users.update_many(
        {"role": None},
        {"$set": {"role": "owner"}}
    )
    print(f"Updated {result2.modified_count} users with role=None to 'owner' role")

if __name__ == "__main__":
    main()
