import os
import json
import re
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
BACKEND_ROUTES_PATH = WORKSPACE_DIR / "scratch" / "backend_routes.json"
DASHBOARD_SERVICES_DIR = WORKSPACE_DIR / "madbel-dashboard" / "src" / "services"

def normalize_path(path):
    if not path:
        return ""
    path = path.lower()
    path = re.sub(r"\$\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\:[a-zA-Z0-9_]+", "{}", path)
    path = path.strip("/")
    return path

def analyze_dashboard_services():
    # Load backend routes
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Normalize backend routes
    # Map normalized path to list of routes
    backend_map = {}
    for r in backend_routes:
        n = normalize_path(r["path"])
        if n not in backend_map:
            backend_map[n] = []
        backend_map[n].append(r)

    results = []
    
    # Read each file in services
    for file_path in DASHBOARD_SERVICES_DIR.glob("*.js"):
        if file_path.name in ["httpClient.js", "staticMockApi.js", "index.js"]:
            continue
            
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        # Parse functions and their API requests
        # A typical declaration: export const getMyProfile = () => apiRequest(...)
        # Or: export const updateMyProfile = (body) => apiRequest(...)
        # Or multi-line declarations. Let's do a regex or line-by-line parsing.
        
        current_func = None
        for idx, line in enumerate(lines):
            func_match = re.search(r"export\s+const\s+([a-zA-Z0-9_]+)\s*=", line)
            if func_match:
                current_func = func_match.group(1)
            
            # Find paths inside apiRequest or apiRequestWithFallback
            paths_in_line = re.findall(r"['\"\`](/[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", line)
            if paths_in_line and current_func:
                # Find method
                method = "GET"
                snippet = "".join(lines[max(0, idx-3):min(len(lines), idx+4)])
                m_match = re.search(r"method\s*:\s*['\"\`]([A-Z]{3,6})['\"\`]", snippet)
                if m_match:
                    method = m_match.group(1).upper()
                else:
                    for m in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                        if f"method: \"{m}\"" in snippet or f"method: '{m}'" in snippet:
                            method = m
                            break
                
                for path in paths_in_line:
                    # httpClient resolves this way:
                    # If it starts with /api/, it's used as is.
                    # Else, it's prefixed with /api/v1.
                    resolved_path = path if path.startswith("/api/") else f"/api/v1{path}"
                    n_path = normalize_path(resolved_path)
                    
                    # Try to find a backend route match
                    match_found = None
                    # 1. Exact match on normalized path
                    if n_path in backend_map:
                        for r in backend_map[n_path]:
                            if r["method"].upper() == method:
                                match_found = r
                                break
                        if not match_found:
                            # Match path but different method
                            match_found = backend_map[n_path][0] # just take first
                    
                    # 2. Try matching without prefix if it was added
                    if not match_found and not path.startswith("/api/"):
                        n_path_noprefix = normalize_path(path)
                        if n_path_noprefix in backend_map:
                            for r in backend_map[n_path_noprefix]:
                                if r["method"].upper() == method:
                                    match_found = r
                                    break
                            if not match_found:
                                match_found = backend_map[n_path_noprefix][0]
                                
                    # 3. Try matching dashboard/admin prefix (mismatches)
                    # E.g. /api/v1/admin/users vs /api/v1/dashboard/admin/users
                    # Let's search if there's a backend path ending with similar tokens
                    if not match_found:
                        tokens = [t for t in n_path.split("/") if t and t != "api" and t != "v1"]
                        # try to search backend for paths containing these tokens
                        for bn, brs in backend_map.items():
                            btokens = [t for t in bn.split("/") if t and t != "api" and t != "v1"]
                            # if btokens has similar ending structure
                            if len(tokens) >= 2 and len(btokens) >= 2:
                                if tokens[-2:] == btokens[-2:]:
                                    # potential match!
                                    for r in brs:
                                        if r["method"].upper() == method:
                                            match_found = r
                                            break
                                    if match_found:
                                        break
                    
                    results.append({
                        "file": file_path.name,
                        "function": current_func,
                        "dashboard_path": path,
                        "resolved_path": resolved_path,
                        "method": method,
                        "matched_backend_path": match_found["path"] if match_found else None,
                        "matched_backend_method": match_found["method"] if match_found else None,
                        "status": "Matched" if match_found and match_found["path"] == resolved_path else (
                            "Needs Mapping" if match_found else "Not Found in Backend"
                        )
                    })

    # Save details
    with open(WORKSPACE_DIR / "scratch" / "dashboard_mapped_report.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    print(f"Parsed {len(results)} dashboard functions.")

if __name__ == "__main__":
    analyze_dashboard_services()
