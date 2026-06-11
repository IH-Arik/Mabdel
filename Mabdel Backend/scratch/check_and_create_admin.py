import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def main():
    uri = "mongodb+srv://mabdelqader2025_db_user:HoKMI9C4SXJY26k8@mabdel.yksckcv.mongodb.net/?appName=mabdel"
    client = AsyncIOMotorClient(uri)
    db = client["mabdel"]
    users_coll = db["users"]
    
    # 1. Check if ittesafarik@gmail.com matches SecurePass2024!
    user1 = await users_coll.find_one({"email": "ittesafarik@gmail.com"})
    if user1:
        h = user1.get("password_hash") or user1.get("hashed_password")
        if verify_password("SecurePass2024!", h):
            print("ittesafarik@gmail.com password is: SecurePass2024!")
        else:
            print("ittesafarik@gmail.com password is NOT SecurePass2024!. Resetting it...")
            new_h = hash_password("SecurePass2024!")
            await users_coll.update_one({"email": "ittesafarik@gmail.com"}, {"$set": {"password_hash": new_h, "hashed_password": new_h}})
            print("Reset successfully.")
            
    # 2. Check if demo@mabdel.dev matches SecurePass2024!
    user2 = await users_coll.find_one({"email": "demo@mabdel.dev"})
    if user2:
        h = user2.get("password_hash") or user2.get("hashed_password")
        if verify_password("SecurePass2024!", h):
            print("demo@mabdel.dev password is: SecurePass2024!")
        else:
            print("demo@mabdel.dev password is NOT SecurePass2024!. Resetting it...")
            new_h = hash_password("SecurePass2024!")
            await users_coll.update_one({"email": "demo@mabdel.dev"}, {"$set": {"password_hash": new_h, "hashed_password": new_h}})
            print("Reset successfully.")

    # 3. Check/Create admin@mabdel.dev with SecurePass2024!
    admin_user = await users_coll.find_one({"email": "admin@mabdel.dev"})
    if not admin_user:
        print("Creating admin@mabdel.dev...")
        h = hash_password("SecurePass2024!")
        await users_coll.insert_one({
            "full_name": "Mabdel Admin",
            "email": "admin@mabdel.dev",
            "password_hash": h,
            "hashed_password": h,
            "is_verified": True,
            "auth_provider": "email",
            "role": "admin",
            "language_preference": "EN",
            "notification_preferences": {
                "general_notification": True,
                "sound": True,
                "vibrate": True,
                "new_messages": True,
                "missed_calls": True,
                "scheduled_calls": True,
                "ai_tasks": True,
                "calendar_reminders": True
            },
            "device_tokens": []
        })
        print("Created successfully.")
    else:
        h = admin_user.get("password_hash") or admin_user.get("hashed_password")
        if not verify_password("SecurePass2024!", h):
            print("admin@mabdel.dev password was incorrect. Resetting to SecurePass2024!...")
            new_h = hash_password("SecurePass2024!")
            await users_coll.update_one({"email": "admin@mabdel.dev"}, {"$set": {"password_hash": new_h, "hashed_password": new_h}})
            
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
