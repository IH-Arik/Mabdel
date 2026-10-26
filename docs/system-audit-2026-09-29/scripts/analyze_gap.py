import json
import re
from pathlib import Path

# Paths
root = Path("c:/project/Mabdel AI")
postman_file = root / "postman_collection.json"
website_pages = root / "Mabdel Website" / "src" / "pages"
services_file = root / "Mabdel Website" / "src" / "api" / "services.js"
dashboard_pages = root / "madbel-dashboard" / "src" / "Pages"

with open(postman_file, "r", encoding="utf-8") as f:
    collection = json.load(f)

# Collect all backend endpoints
all_backend_endpoints = []
for folder in collection["item"]:
    fname = folder["name"]
    for sub in folder["item"]:
        sname = sub["name"]
        for req in sub["item"]:
            r = req["request"]
            method = r["method"].upper()
            raw_url = r["url"]["raw"]
            clean_path = raw_url.replace("{{baseUrl}}", "")
            all_backend_endpoints.append({
                "folder": fname,
                "subfolder": sname,
                "name": req["name"],
                "method": method,
                "url": clean_path,
                "raw": f"{method} {clean_path}"
            })

print(f"Total Backend Endpoints: {len(all_backend_endpoints)}")

# Collect all services.js mappings
services_code = services_file.read_text(encoding="utf-8") if services_file.exists() else ""
services_endpoints = re.findall(r"client\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", services_code, re.IGNORECASE)
normalized_services = set()
for m, u in services_endpoints:
    # normalize :id or ${id}
    u_norm = re.sub(r"\$\{[^}]+\}", "*", u)
    normalized_services.add(f"{m.upper()} {u_norm}")

print(f"Total Services mapped in services.js: {len(normalized_services)}")

# Scan website pages
page_data = {}
for pfile in website_pages.glob("*.jsx"):
    content = pfile.read_text(encoding="utf-8")
    
    # 1. UI Fields
    # Inputs with name, placeholder, label
    inputs = re.findall(r'<input[^>]+name=["\']([^"\']+)["\']|<input[^>]+placeholder=["\']([^"\']+)["\']|<textarea[^>]+placeholder=["\']([^"\']+)["\']', content)
    clean_inputs = []
    for a, b, c in inputs:
        val = a or b or c
        if val and val not in clean_inputs: clean_inputs.append(val)
        
    selects = re.findall(r'<select[^>]+name=["\']([^"\']+)["\']', content)
    for s in selects:
        if s not in clean_inputs: clean_inputs.append(f"Select: {s}")
        
    labels = re.findall(r'<label[^>]*>([^<]+)</label>', content)
    clean_labels = [l.strip() for l in labels if l.strip() and len(l.strip()) < 40][:15]
    
    # 2. Used API calls
    api_calls = list(set(re.findall(r'(smartflowApi\.[a-zA-Z0-9_]+|adminApi\.[a-zA-Z0-9_]+|publicApi\.[a-zA-Z0-9_]+)', content)))
    
    # 3. Direct fetch/axios
    direct_calls = list(set(re.findall(r'(axios\.[a-zA-Z0-9_]+|fetch\([\'\"][^\'\"]+[\'\"])', content)))
    
    # 4. Check for mock/dummy/hardcoded data
    mock_matches = re.findall(r'(const \w+\s*=\s*\[\s*\{[^]]+\}\s*\])', content)
    has_hardcoded_arrays = len(mock_matches) > 0
    
    page_data[pfile.name] = {
        "file": str(pfile),
        "size_kb": round(len(content)/1024, 1),
        "inputs": clean_inputs,
        "labels": clean_labels,
        "api_calls": api_calls,
        "direct_calls": direct_calls,
        "has_hardcoded_arrays": has_hardcoded_arrays
    }

print(f"Total Website Pages Scanned: {len(page_data)}")

output_report = {
    "backend_total": len(all_backend_endpoints),
    "services_mapped": len(normalized_services),
    "pages": page_data
}

with open(root / "page_analysis_data.json", "w", encoding="utf-8") as f:
    json.dump(output_report, f, indent=2, ensure_ascii=False)

print("Saved page_analysis_data.json successfully!")
