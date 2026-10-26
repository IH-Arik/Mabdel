import json

with open("c:/project/Mabdel AI/unconnected_backend_endpoints.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total Backend-Only Endpoints: {len(data['backend_only_list'])}\n")
by_folder = {}
for e in data["backend_only_list"]:
    f = e["folder"]
    if f not in by_folder: by_folder[f] = []
    by_folder[f].append(e)

for f, items in by_folder.items():
    print(f"=== {f} ({len(items)} endpoints) ===")
    for item in items:
        print(f"  - [{item['method']}] {item['url']} : {item['name']}")
    print()
