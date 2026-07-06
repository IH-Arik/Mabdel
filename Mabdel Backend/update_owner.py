import asyncio
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

async def make_owner():
    client = AsyncIOMotorClient("mongodb+srv://mabdelqader2025_db_user:HoKMI9C4SXJY26k8@mabdel.yksckcv.mongodb.net/?appName=mabdel")
    db = client.mabdel
    users_collection = db.users

    org_id = str(uuid.uuid4())

    result = await users_collection.update_one(
        {"email": "ittesafarik@gmail.com"},
        {"$set": {"organization_id": org_id}}
    )

    if result.modified_count > 0:
        print(f"Successfully added organization_id to user: {org_id}")
    else:
        print("No changes made (maybe user already has this exact org_id).")

if __name__ == '__main__':
    asyncio.run(make_owner())
