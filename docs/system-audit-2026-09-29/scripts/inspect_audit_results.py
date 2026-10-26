import json

with open("c:/project/Mabdel AI/api_audit_results.json", "r", encoding="utf-8") as f:
    d = json.load(f)

print(f"Total tested: {d.get('total_tested')}")
print(f"Overall status counts: {d.get('status_counts')}")
print(f"Server errors (500s): {d.get('server_errors_count')}")

print("\n--- FOLDER BREAKDOWN ---")
for folder_name, folder_data in d.get("folder_summary", {}).items():
    print(f"\n[{folder_name}] Total: {folder_data.get('total')}")
    for status, count in sorted(folder_data.get("status_breakdown", {}).items()):
        print(f"   Status {status}: {count}")

print("\n--- SAMPLE ERRORS OR NON-200 DETAILS ---")
non_200_by_folder = {}
for r in d.get("results", []):
    sc = str(r.get("status_code"))
    if sc not in ("200", "201", "101"):
        fname = r.get("folder", "Other")
        if fname not in non_200_by_folder:
            non_200_by_folder[fname] = []
        non_200_by_folder[fname].append((r.get("method"), r.get("url"), sc, r.get("snippet", "")[:100], r.get("error")))

for fname, items in non_200_by_folder.items():
    print(f"\nFolder: {fname} (Total non-200/201: {len(items)})")
    for m, u, sc, snip, err in items[:4]:
        print(f"  [{sc}] {m} {u} -> Snippet: {snip} | Error: {err}")
