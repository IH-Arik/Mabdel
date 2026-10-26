import json

with open("c:/project/Mabdel AI/api_audit_clean.json", "r", encoding="utf-8") as f:
    d = json.load(f)

print(f"Total entries: {len(d['results'])}")
print(f"Status breakdown: {d['status_counts']}")
print("\n=== CRITICAL / ATTENTION ENDPOINTS ===")
for r in d["results"]:
    sc = str(r["status_code"])
    if sc in ("500", "502", "503", "408"):
        print(f"[{sc}] {r['method']} {r['url']}")
        print(f"   Module: {r['folder']} -> {r['subfolder']}")
        print(f"   Endpoint Name: {r['name']}")
        print(f"   Snippet: {r['snippet']}")
        print(f"   Error: {r['error']}")
        print("-" * 60)

print("\n=== SUMMARY BY FOLDER (OK vs Attention) ===")
for fname, fdata in d["folder_summary"].items():
    bd = fdata["status_breakdown"]
    ok_count = bd.get("200", 0) + bd.get("201", 0) + bd.get("101", 0)
    expected_count = bd.get("404", 0) + bd.get("422", 0) + bd.get("400", 0)
    auth_count = bd.get("401", 0)
    err_count = bd.get("500", 0) + bd.get("502", 0) + bd.get("503", 0) + bd.get("408", 0)
    print(f"[{fname}] Total: {fdata['total']} | OK/Live: {ok_count} | Expected Validations/404: {expected_count} | Auth/RBAC: {auth_count} | Timeouts/Errors: {err_count}")
