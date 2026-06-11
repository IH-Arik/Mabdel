from app.workflows.graph import run_assistant_workflow


def test_workflow_routes_email_intent() -> None:
    result = run_assistant_workflow("Draft an email to the client")

    assert result.intent == "email"
    assert result.output["email"]["status"] == "draft"
