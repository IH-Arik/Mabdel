from __future__ import annotations
import json
from app.workflows.state import WorkflowState
from app.workflows.utils import call_llm, read_prompt


def collect_data(state: WorkflowState) -> WorkflowState:
    if state.intent == "unknown":
        return state

    template = read_prompt("data_collector.txt")
    prompt = template.format(intent=state.intent, command=state.command)
    
    try:
        response_text = call_llm(prompt)
        # Handle cases where LLM might wrap JSON in code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
            
        result = json.loads(response_text)
        
        state.output.update(result.get("collected_data", {}))
        state.action_required = not result.get("is_complete", True)
        
        if state.action_required:
            state.summary = result.get("clarification_question", "I need more information to complete this.")
        else:
            state.summary = f"I have all the information for the {state.intent} workflow."
            
    except Exception as e:
        state.summary = f"Error collecting data: {str(e)}"
        state.action_required = False
        
    return state
