import re

filepath = "app/services/smartflow_service.py"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "def _extract_" in line or "def _build_" in line or "def _workflow_" in line or "def _calendar_" in line:
        print(f"Line {i+1}: {line.strip()}")
