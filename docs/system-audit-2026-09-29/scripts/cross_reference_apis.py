import json
import re
from pathlib import Path

root = Path("c:/project/Mabdel AI")
postman_file = root / "postman_collection.json"
services_file = root / "Mabdel Website" / "src" / "api" / "services.js"
website_pages = root / "Mabdel Website" / "src" / "pages"
dashboard_pages = root / "madbel-dashboard" / "src" / "Pages"

with open(postman_file, "r", encoding="utf-8") as f:
    collection = json.load(f)

# Extract all API calls from both frontends
frontend_api_usages = set()
for p in list(website_pages.glob("**/*.jsx")) + list(dashboard_pages.glob("**/*.jsx")):
    try:
        content = p.read_text(encoding="utf-8")
        matches = re.findall(r'/api/v1/[a-zA-Z0-9_\-\/{}:]+', content)
        for m in matches:
            frontend_api_usages.add(m)
    except Exception:
        pass

# Also check services.js in website
services_code = services_file.read_text(encoding="utf-8") if services_file.exists() else ""
for m in re.findall(r'/api/v1/[a-zA-Z0-9_\-\/{}:]+', services_code):
    frontend_api_usages.add(m)

# Also check dashboard services
for sfile in (root / "madbel-dashboard" / "src" / "services").glob("*.js"):
    try:
        content = sfile.read_text(encoding="utf-8")
        for m in re.findall(r'/api/v1/[a-zA-Z0-9_\-\/{}:]+', content):
            frontend_api_usages.add(m)
    except Exception:
        pass

print(f"Total Unique API Paths found in Frontend code: {len(frontend_api_usages)}")

# Categorize backend endpoints
folder_stats = {}
unconnected_endpoints = []
connected_endpoints = []

for folder in collection["item"]:
    fname = folder["name"]
    folder_stats[fname] = {"total": 0, "connected": 0, "unconnected": 0, "endpoints": []}
    for sub in folder["item"]:
        for req in sub["item"]:
            r = req["request"]
            method = r["method"].upper()
            url = r["url"]["raw"].replace("{{baseUrl}}", "")
            
            # check if url prefix or path matches any frontend usage
            base_path = re.sub(r'\{[^}]+\}', '', url).rstrip('/')
            is_connected = False
            for f_path in frontend_api_usages:
                f_base = re.sub(r'\{[^}]+\}', '', f_path).rstrip('/')
                if base_path and (base_path in f_path or f_base in url):
                    is_connected = True
                    break
            
            entry = {
                "name": req["name"],
                "method": method,
                "url": url,
                "folder": fname,
                "subfolder": sub["name"],
                "is_connected": is_connected
            }
            folder_stats[fname]["total"] += 1
            if is_connected:
                folder_stats[fname]["connected"] += 1
                connected_endpoints.append(entry)
            else:
                folder_stats[fname]["unconnected"] += 1
                unconnected_endpoints.append(entry)
            folder_stats[fname]["endpoints"].append(entry)

print("\n--- BACKEND vs FRONTEND STATS BY FOLDER ---")
for fname, stats in folder_stats.items():
    print(f"[{fname}] Total: {stats['total']} | Connected to Frontend: {stats['connected']} | Backend Only (No UI): {stats['unconnected']}")

print(f"\nOVERALL: Connected = {len(connected_endpoints)} | Backend Only (Frontend Nai) = {len(unconnected_endpoints)}")

# Save detailed dump
with open(root / "unconnected_backend_endpoints.json", "w", encoding="utf-8") as f:
    json.dump({
        "total_backend": len(connected_endpoints) + len(unconnected_endpoints),
        "total_connected": len(connected_endpoints),
        "total_backend_only": len(unconnected_endpoints),
        "folder_breakdown": folder_stats,
        "backend_only_list": unconnected_endpoints
    }, f, indent=2, ensure_ascii=False)
