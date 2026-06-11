from __future__ import annotations

from collections.abc import Callable

from app.workflows.edges import route_by_intent
from app.workflows.nodes.collect_data import collect_data
from app.workflows.nodes.create_agreement import create_agreement
from app.workflows.nodes.create_bulk_message import create_bulk_message
from app.workflows.nodes.create_group import create_group
from app.workflows.nodes.create_invoice import create_invoice
from app.workflows.nodes.create_lease import create_lease
from app.workflows.nodes.finalize import finalize
from app.workflows.nodes.handle_call import handle_call
from app.workflows.nodes.parse_intent import parse_intent
from app.workflows.nodes.schedule_meeting import schedule_meeting
from app.workflows.nodes.send_email import send_email
from app.workflows.state import WorkflowState, WorkflowStateData

try:
    from langgraph.graph import END, START, StateGraph
except ImportError:  # pragma: no cover - dependency is pinned; fallback keeps dev resilient.
    END = START = None
    StateGraph = None


def _to_workflow_state(data: WorkflowStateData) -> WorkflowState:
    return WorkflowState(
        command=data["command"],
        intent=data.get("intent", "unknown"),
        summary=data.get("summary", ""),
        action_required=data.get("action_required", False),
        history=list(data.get("history", [])),
        output=dict(data.get("output", {})),
    )


def _from_workflow_state(state: WorkflowState) -> WorkflowStateData:
    return {
        "command": state.command,
        "intent": state.intent,
        "summary": state.summary,
        "action_required": state.action_required,
        "history": state.history,
        "output": state.output,
    }


def _node(fn: Callable[[WorkflowState], WorkflowState]) -> Callable[[WorkflowStateData], WorkflowStateData]:
    def wrapped(data: WorkflowStateData) -> WorkflowStateData:
        return _from_workflow_state(fn(_to_workflow_state(data)))

    return wrapped


def _route(data: WorkflowStateData) -> str:
    return route_by_intent(_to_workflow_state(data))


def _build_langgraph_workflow():
    if StateGraph is None:
        return None

    builder = StateGraph(WorkflowStateData)
    builder.add_node("parse_intent", _node(parse_intent))
    builder.add_node("collect_data", _node(collect_data))
    builder.add_node("create_invoice", _node(create_invoice))
    builder.add_node("send_email", _node(send_email))
    builder.add_node("create_bulk_message", _node(create_bulk_message))
    builder.add_node("schedule_meeting", _node(schedule_meeting))
    builder.add_node("create_lease", _node(create_lease))
    builder.add_node("create_agreement", _node(create_agreement))
    builder.add_node("create_group", _node(create_group))
    builder.add_node("handle_call", _node(handle_call))
    builder.add_node("finalize", _node(finalize))

    builder.add_edge(START, "parse_intent")
    builder.add_edge("parse_intent", "collect_data")
    builder.add_conditional_edges(
        "collect_data",
        _route,
        {
            "create_invoice": "create_invoice",
            "send_email": "send_email",
            "create_bulk_message": "create_bulk_message",
            "schedule_meeting": "schedule_meeting",
            "create_lease": "create_lease",
            "create_agreement": "create_agreement",
            "create_group": "create_group",
            "handle_call": "handle_call",
            "finalize": "finalize",
        },
    )
    for node_name in (
        "create_invoice",
        "send_email",
        "create_bulk_message",
        "schedule_meeting",
        "create_lease",
        "create_agreement",
        "create_group",
        "handle_call",
    ):
        builder.add_edge(node_name, "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


assistant_workflow_graph = _build_langgraph_workflow()


def run_assistant_workflow(command: str, history: list[dict] | None = None) -> WorkflowState:
    initial_state = {
        "command": command,
        "intent": "unknown",
        "summary": "",
        "action_required": False,
        "history": list(history or []),
        "output": {"workflow_engine": "langgraph"},
    }

    if assistant_workflow_graph is not None:
        result = assistant_workflow_graph.invoke(initial_state)
        return _to_workflow_state(result)

    state = _to_workflow_state(initial_state)
    state.output["workflow_engine"] = "python_fallback"
    state = parse_intent(state)
    state = collect_data(state)

    route = route_by_intent(state)
    if route == "create_invoice":
        state = create_invoice(state)
    elif route == "send_email":
        state = send_email(state)
    elif route == "create_bulk_message":
        state = create_bulk_message(state)
    elif route == "schedule_meeting":
        state = schedule_meeting(state)
    elif route == "create_lease":
        state = create_lease(state)
    elif route == "create_agreement":
        state = create_agreement(state)
    elif route == "create_group":
        state = create_group(state)
    elif route == "handle_call":
        state = handle_call(state)

    return finalize(state)


def get_workflow_engine() -> str:
    return "langgraph" if assistant_workflow_graph is not None else "python_fallback"
