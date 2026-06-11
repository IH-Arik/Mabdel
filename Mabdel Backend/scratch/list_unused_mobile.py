import json

with open("scratch/api_usage_report.json", "r", encoding="utf-8") as f:
    report_data = json.load(f)

mobile_declared_unused = []
for r in report_data:
    if r["is_webhook"]:
        continue
    if r["mobile_declared"] and not r["mobile_used"]:
        mobile_declared_unused.append(r)

print(f"Total: {len(mobile_declared_unused)}")
for idx, r in enumerate(mobile_declared_unused):
    print(f"{idx+1}. {r['method']} {r['path']}")
