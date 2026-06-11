from __future__ import annotations

from app.workflows.state import WorkflowState


def finalize(state: WorkflowState) -> WorkflowState:
    if not state.summary:
        state.summary = "No matching workflow found."
        state.action_required = True
    return state
