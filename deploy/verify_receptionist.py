"""Run local acceptance without contacting production or real providers."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-backend", action="store_true")
    parser.add_argument("--skip-website", action="store_true")
    parser.add_argument("--report", type=Path, default=ROOT / "runtime-logs" / "receptionist-local-validation.json")
    args = parser.parse_args()
    backend = ROOT / "Mabdel Backend"
    venv_python = backend / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    python = str(venv_python if venv_python.exists() else sys.executable)
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    npx = shutil.which("npx.cmd" if os.name == "nt" else "npx")
    checks = []
    if not args.skip_backend:
        checks.append(("backend_offline", backend, [python, "-m", "pytest", "-p", "app.tests.offline_guard",
            "app/tests", "--ignore=app/tests/test_realtime_live.py", "-q", "--tb=short"]))
    if not args.skip_website:
        if not npm or not npx:
            parser.error("Node/npm is required for website validation.")
        website = ROOT / "Mabdel Website"
        checks.extend([
            ("website_build", website, [npm, "run", "build"]),
            ("website_scoped_lint", website, [npx, "--no-install", "eslint",
                "src/components/Calls/ReceptionistWorkQueue.jsx", "src/components/BusinessLocationsPanel.jsx",
                "src/pages/Profile/tabs/AIConfigTab.jsx", "src/pages/Profile/tabs/ReceptionistDocuments.jsx"]),
        ])
    results = []
    env = {**os.environ, "REALTIME_LIVE": "0", "PYTHONIOENCODING": "utf-8", "CI": "1"}
    for name, cwd, command in checks:
        print(f"Running {name}...", flush=True)
        start = time.monotonic()
        process = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        result = {"check": name, "passed": process.returncode == 0, "exit_code": process.returncode,
                  "seconds": round(time.monotonic() - start, 2)}
        results.append(result)
        print(f"{name}: {'PASS' if result['passed'] else 'FAIL'} ({result['seconds']}s)", flush=True)
        if not result["passed"]:
            print((process.stdout + process.stderr)[-6000:], flush=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({"scope": "local_only", "production_contacted": False,
        "backend_external_network_blocked": not args.skip_backend, "results": results}, indent=2), encoding="utf-8")
    print(f"Report: {args.report}")
    return 0 if results and all(item["passed"] for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
