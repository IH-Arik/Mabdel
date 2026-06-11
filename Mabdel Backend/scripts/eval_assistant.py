import sys
import os
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).parent.parent
sys.path.append(str(root))

from app.workflows.graph import run_assistant_workflow

test_cases = [
    {
        "command": "Create an invoice for John Doe",
        "expected_intent": "invoice",
        "expect_clarification": True
    },
    {
        "command": "Send an email to boss@company.com with subject Hello",
        "expected_intent": "email",
        "expect_clarification": True # Missing body
    },
    {
        "command": "Schedule a meeting with Arik tomorrow at 10am",
        "expected_intent": "calendar",
        "expect_clarification": False # Might be complete enough depending on LLM
    }
]

def run_eval():
    print("Starting Assistant Evaluation...\n")
    for case in test_cases:
        print(f"Testing Command: '{case['command']}'")
        state = run_assistant_workflow(case['command'])
        
        print(f"  - Detected Intent: {state.intent}")
        print(f"  - Action Required: {state.action_required}")
        print(f"  - AI Summary/Question: {state.summary}")
        print(f"  - Collected Data: {state.output}")
        
        if state.intent == case['expected_intent']:
            print("  [PASS] Intent Match")
        else:
            print(f"  [FAIL] Intent Mismatch (Expected: {case['expected_intent']})")
        print("-" * 30)

if __name__ == "__main__":
    run_eval()
