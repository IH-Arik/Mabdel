from __future__ import annotations

from app.workflows.intent_utils import ALLOWED_INTENTS, infer_intent_from_command, normalize_workflow_command
from app.workflows.state import WorkflowState
from app.workflows.utils import call_llm, read_prompt


def parse_intent(state: WorkflowState) -> WorkflowState:
    normalized_command = normalize_workflow_command(state.command)
    if normalized_command:
        state.command = normalized_command

    heuristic_intent = infer_intent_from_command(state.command)
    if heuristic_intent in ALLOWED_INTENTS:
        state.intent = heuristic_intent
        return state

    template = read_prompt("intent_parser.txt")
    prompt = template.format(command=state.command)
    
    intent = call_llm(prompt).lower()
    
    # Validation against allowed intents
    if intent in ALLOWED_INTENTS:
        state.intent = intent
    else:
        state.intent = "unknown"
        
    return state
