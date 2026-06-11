from __future__ import annotations

from app.workflows.state import WorkflowState


def schedule_meeting(state: WorkflowState) -> WorkflowState:
    state.summary = "Calendar workflow prepared."
    state.output["calendar"] = {"status": "scheduled"}
    return state
