import sys
from pathlib import Path

# Add the workspace root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

try:
    from app.main import app
    print("FastAPI app imported successfully!")
    routes = []
    for route in app.routes:
        methods = getattr(route, "methods", [])
        path = getattr(route, "path", "")
        for m in methods:
            routes.append({"method": m, "path": path})
    print(f"Found {len(routes)} routes in FastAPI app.")
    import json
    with open("scratch/backend_routes.json", "w") as f:
        json.dump(routes, f, indent=2)
    print("Saved backend routes to scratch/backend_routes.json")
except Exception as e:
    print(f"Error: {e}")
