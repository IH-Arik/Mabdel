import asyncio
import os
import sys
from dotenv import load_dotenv

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.dependencies import get_mongo_database
from app.services.smartflow.smartflow_orchestrator import SmartFlowService

async def sync_global_chats():
    print("Connecting to DB...")
    db = await get_mongo_database()
    smartflow = SmartFlowService(db)
    
    print("Finding all organizations (owners)...")
    owners = await db.users.find({"role": "owner"}).to_list(length=None)
    
    print(f"Found {len(owners)} owners.")
    for owner in owners:
        org_id = str(owner["_id"])
        business_name = owner.get("business_name") or owner.get("organization_name") or owner.get("full_name") or "Unknown Organization"
        
        print(f"\nProcessing organization: {business_name} ({org_id})")
        
        # Ensure global chat exists
        group = await smartflow.ensure_global_chat(
            organization_id=org_id,
            business_name=business_name,
            owner_id=org_id
        )
        print(f"Global chat ensured. ID: {group['_id']}")
        
        # Find all active users belonging to this organization (including the owner)
        users = await db.users.find({
            "$or": [
                {"organization_id": org_id},
                {"_id": owner["_id"]}
            ],
            "is_active": True
        }).to_list(length=None)
        
        print(f"Found {len(users)} active users to add to the global chat.")
        for user in users:
            user_id = str(user["_id"])
            await smartflow.add_user_to_global_chat(org_id, user_id)
            print(f" - Added user {user_id} ({user.get('email')}) to global chat.")

    print("\nGlobal chat sync complete!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(sync_global_chats())
