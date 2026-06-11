from __future__ import annotations

from app.workflows.state import WorkflowState


def handle_call(state: WorkflowState) -> WorkflowState:
    state.summary = "Call workflow prepared."
    state.output["call"] = {"status": "stream_connected"}
    return state
