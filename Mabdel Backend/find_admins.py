import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb+srv://mabdelqader2025_db_user:HoKMI9C4SXJY26k8@mabdel.yksckcv.mongodb.net/?appName=mabdel")
    db = client.mabdel
    
    # Check legacy 'role' field in users collection
    print("--- Users by legacy 'role' field ---")
    async for user in db.users.find({"role": {"$in": ["super_admin", "admin", "owner"]}}):
        print(f"Role: {user.get('role')} | Email: {user.get('email')} | ID: {user.get('_id')}")
        
    # Check new rbac_user_roles collection
    print("\n--- Users by rbac_user_roles collection ---")
    async for assignment in db.rbac_user_roles.find({"role_slug": {"$in": ["super_admin", "admin", "owner"]}}):
        user_id = assignment.get("user_id")
        from bson import ObjectId
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            print(f"Role: {assignment.get('role_slug')} | Email: {user.get('email')} | ID: {user.get('_id')}")

if __name__ == '__main__':
    asyncio.run(main())
