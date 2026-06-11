import json
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
ANALYSIS_PATH = WORKSPACE_DIR / "scratch" / "dashboard_api_analysis.json"

def main():
    with open(ANALYSIS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    unused_routes = data.get("backend_unused_dashboard_routes", [])
    
    print(f"Total backend dashboard-specific routes not used by frontend: {len(unused_routes)}")
    for r in sorted(unused_routes, key=lambda x: x["path"]):
        print(f"  {r['method'].upper()} {r['path']}")

if __name__ == "__main__":
    main()
