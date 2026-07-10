
import requests
from app.core.security import create_access_token

token = create_access_token(user_id="60d5ecb8b392d3001f3e1234", email="test@test.com")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
body = {
    "transcript": "hello",
    "workflow_intent": "agreement",
    "current_values": {}
}

response = requests.post("http://127.0.0.1:8000/api/v1/smartflow/ai/workflow-prefill", json=body, headers=headers)
print("STATUS:", response.status_code)
print("TEXT:", response.text)

