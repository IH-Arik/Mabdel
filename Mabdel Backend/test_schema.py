
from app.schemas.smartflow import AIWorkflowPrefillRequest
try:
    req = AIWorkflowPrefillRequest(transcript="hello", workflow_intent="agreement", current_values={})
    print(req.model_dump())
except Exception as e:
    print(e)

