
from app.core.security import create_access_token
from app.core.config import settings

token = create_access_token(user_id="60d5ecb8b392d3001f3e1234", email="test@test.com")
print(f"{token}")

