import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.services.smartflow.conversation_service import ConversationService
from app.core.config import settings
import sys

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    
    user = await db.users.find_one({})
    if not user:
        print("No user found")
        return
        
    user_id = str(user["_id"])
    print(f"Testing with user_id: {user_id}")
    
    service = ConversationService(db)
    
    try:
        res = await service.list_conversations(
            user_id=user_id,
            page=1,
            page_size=20,
            search=None,
            platform=None,
            platforms=None,
            archived=None,
            unread_only=False,
            type_filter=None
        )
        print("SUCCESS")
        print(f"Type of res: {type(res)}")
        if isinstance(res, dict):
            print(f"Keys: {res.keys()}")
        elif isinstance(res, tuple):
            print(f"Type: {type(res[0])}, {type(res[1])}")
    except Exception as e:
        print("ERROR:")
        print(repr(e))

if __name__ == "__main__":
    asyncio.run(main())
