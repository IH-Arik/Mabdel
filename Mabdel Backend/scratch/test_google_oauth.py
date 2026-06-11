import asyncio
from app.services.smartflow_service import SmartFlowService
from app.core.database import mongo_manager

async def test():
    try:
        await mongo_manager.connect()
        db = mongo_manager.database
        service = SmartFlowService(db)
        res = await service.start_integration_oauth("69efae8b5af39608a990e09e", "google_business")
        print("GENERATED_OAUTH_URL_START")
        print(res["auth_url"])
        print("GENERATED_OAUTH_URL_END")
    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        await mongo_manager.close()

if __name__ == "__main__":
    asyncio.run(test())
