import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_subordinates():
    client = AsyncIOMotorClient("mongodb+srv://mabdelqader2025_db_user:HoKMI9C4SXJY26k8@mabdel.yksckcv.mongodb.net/?appName=mabdel")
    db = client.mabdel
    users_collection = db.users

    result = await users_collection.update_many(
        {"is_subordinate_account": True},
        {"$set": {"is_verified": True, "is_active": True}}
    )

    print(f"Verified {result.modified_count} subordinate accounts.")

if __name__ == '__main__':
    asyncio.run(fix_subordinates())
