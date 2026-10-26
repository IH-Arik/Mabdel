"""Run mocked local acceptance checks. Does not inspect or print credentials."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TESTS = [
    "test_receptionist_local_integrations.py", "test_receptionist_documents.py",
    "test_incoming_call_popup.py", "test_receptionist_approvals.py",
    "test_receptionist_delivery_and_lock.py", "test_per_action_approval.py",
    "test_sms_confirmation_toggle.py", "test_sms_wording_and_policy.py",
    "test_outbound_followup_sms.py", "test_google_calendar_sync.py",
    "test_microsoft_calendar_sync.py", "test_zoom_calendar_sync.py",
    "test_ai_call_reliability.py", "test_ai_call_stream_e2e.py",
    "test_receptionist_workflows.py", "test_location_scheduling.py",
]


def main():
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(ROOT / "scripts"), str(ROOT), env.get("PYTHONPATH")]))
    # Explicitly blank communication credentials in the child, even if the parent
    # shell happens to have configured production services. Tests inject substitutes.
    for name in list(env):
        if any(token in name.upper() for token in ("TELNYX", "TWILIO", "RESEND", "SMTP", "OPENAI_API_KEY", "ANTHROPIC_API_KEY")):
            env[name] = ""
    command = [sys.executable, "-m", "pytest", "-p", "local_acceptance_no_network", "-q"]
    command += [str(ROOT / "app" / "tests" / filename) for filename in TESTS]
    print("Running local receptionist acceptance with external socket connections blocked.", flush=True)
    return subprocess.run(command, cwd=ROOT, env=env, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
