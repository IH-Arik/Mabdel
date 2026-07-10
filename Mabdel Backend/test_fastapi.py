
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from typing import Literal, Any

AIWorkflowIntent = Literal["invoice", "bulk_message", "calendar", "lease", "agreement", "contact"]
AIResponseMode = Literal["text", "audio", "both", "none"]

class VoiceCommandRequest(BaseModel):
    transcript: str | None = None
    audio_url: str | None = None
    audio_base64: str | None = None
    audio_mime_type: str = "audio/wav"
    audio_filename: str = "voice.wav"
    response_mode: AIResponseMode = "both"
    voice_id: str | None = None

class AIWorkflowPrefillRequest(VoiceCommandRequest):
    workflow_intent: AIWorkflowIntent | None = None
    current_values: dict[str, Any] = Field(default_factory=dict)

app = FastAPI()

@app.post("/test")
async def test_endpoint(payload: AIWorkflowPrefillRequest):
    return payload.model_dump()

client = TestClient(app)

response = client.post("/test", json={
    "transcript": "hello",
    "workflow_intent": "agreement",
    "current_values": {}
})
print(response.status_code)
print(response.json())

