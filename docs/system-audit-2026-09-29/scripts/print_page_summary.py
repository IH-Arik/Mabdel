import json

with open("c:/project/Mabdel AI/page_analysis_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for p, d in data["pages"].items():
    inp_sample = d["inputs"][:4]
    lbl_sample = d["labels"][:4]
    apis = d["api_calls"]
    print(f"=== Page: {p} ===")
    print(f"  UI Inputs: {inp_sample}")
    print(f"  UI Labels: {lbl_sample}")
    print(f"  API Calls ({len(apis)}): {apis}")
    print()
