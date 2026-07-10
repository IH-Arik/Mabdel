import asyncio
import httpx
from pymongo import MongoClient
from app.core.config import settings

async def main():
    # 1. Get a valid user token (by generating one directly)
    from app.core.security import create_access_token
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    
    user = db.users.find_one({})
    if not user:
        print("No user found")
        return
        
    token = create_access_token(str(user["_id"]), user.get("email", "test@example.com"))
    print(f"User role: {user.get('role')}")
    print(f"User permissions: {user.get('permissions')}")
    
    # Check default role permissions
    role = db.roles.find_one({"name": user.get('role')})
    if role:
        print(f"Role permissions: {role.get('permissions')}")
    else:
        print("Role not found in db.roles")
        
    async with httpx.AsyncClient() as http_client:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test conversations
        url = "http://localhost:8000/api/v1/smartflow/conversations"
        print(f"GET {url}")
        res = await http_client.get(url, headers=headers)
        print(f"Conversations Status: {res.status_code}")
        print(f"Conversations Response: {res.text[:500]}")
        
        # Test calls summary to see why it was 404
        url2 = "http://localhost:8000/api/v1/smartflow/calls/summary"
        print(f"\nGET {url2}")
        res2 = await http_client.get(url2, headers=headers)
        print(f"Calls Summary Status: {res2.status_code}")
        print(f"Calls Summary Response: {res2.text[:500]}")

if __name__ == "__main__":
    asyncio.run(main())
