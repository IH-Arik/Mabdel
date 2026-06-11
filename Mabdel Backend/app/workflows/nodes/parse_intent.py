from __future__ import annotations

from app.workflows.state import WorkflowState
from app.workflows.utils import call_llm, read_prompt


def parse_intent(state: WorkflowState) -> WorkflowState:
    template = read_prompt("intent_parser.txt")
    prompt = template.format(command=state.command)
    
    intent = call_llm(prompt).lower()
    
    # Validation against allowed intents
    allowed = ["invoice", "email", "bulk_message", "calendar", "lease", "agreement", "group", "call"]
    if intent in allowed:
        state.intent = intent
    else:
        state.intent = "unknown"
        
    return state
