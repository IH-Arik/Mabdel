import json

with open("c:/project/Mabdel AI/postman_collection.json", "r", encoding="utf-8") as f:
    col = json.load(f)

print(f"Total Folders: {len(col['item'])}")
for f in col['item']:
    subfolders = [s['name'] for s in f['item']]
    total_reqs = sum(len(s['item']) for s in f['item'])
    print(f"[{f['name']}] (Total: {total_reqs})")
    for s in f['item']:
        methods = [r['request']['method'] for r in s['item']]
        print(f"  - {s['name']}: {len(s['item'])} endpoints ({', '.join(set(methods))})")
