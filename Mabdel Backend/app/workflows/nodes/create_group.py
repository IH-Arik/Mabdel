from __future__ import annotations

from app.workflows.state import WorkflowState


def create_group(state: WorkflowState) -> WorkflowState:
    state.summary = "Group workflow prepared."
    state.output["group"] = {"status": "created"}
    return state
