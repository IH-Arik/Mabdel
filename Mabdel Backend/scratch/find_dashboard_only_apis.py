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
    # replace parameter placeholders like :id, :trx_id, {user_id}, etc.
    path = re.sub(r"\$\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\:[a-zA-Z0-9_]+", "{}", path)
    path = path.strip("/")
    return path

def extract_apis_from_file(file_path):
    apis = []
    if not file_path.exists():
        return apis
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find apiRequest("path", ...) or apiRequestWithFallback(["path1", "path2"], ...)
    # Let's search for patterns like:
    # apiRequest("...") or apiRequest('...') or apiRequest(`...`)
    # apiRequestWithFallback(["..."]) or apiRequestWithFallback(['...']) etc.
    
    # Simple regex matches for string literals starting with slash
    # Let's match all quotes containing slashes
    candidates = re.findall(r"['\"\`](/[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", content)
    for path in candidates:
        if path.startswith("/"):
            # Try to determine method by checking the surrounding lines or parameters
            method = "GET"
            # Look around where the path was found
            idx = content.find(path)
            if idx != -1:
                # Find method: "POST", "PUT", "DELETE", "PATCH", etc.
                snippet = content[max(0, idx-100):min(len(content), idx+200)]
                m_match = re.search(r"method\s*:\s*['\"\`]([A-Z]{3,6})['\"\`]", snippet)
                if m_match:
                    method = m_match.group(1).upper()
                else:
                    # check for common HTTP client helper calls if any
                    pass
            apis.append({
                "path": path,
                "method": method,
                "file": file_path.name
            })
    return apis

def main():
    # Load backend routes
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Normalize backend routes
    backend_norm = {}
    for r in backend_routes:
        method = r["method"].upper()
        path = r["path"]
        n_path = normalize_path(path)
        if n_path not in backend_norm:
            backend_norm[n_path] = []
        backend_norm[n_path].append({
            "method": method,
            "original_path": path
        })

    # Read dashboard services
    dashboard_apis = []
    for file_path in DASHBOARD_SERVICES_DIR.glob("*.js"):
        if file_path.name in ["httpClient.js", "staticMockApi.js"]:
            continue
        dashboard_apis.extend(extract_apis_from_file(file_path))

    # De-duplicate dashboard apis
    seen_dashboard = {}
    for api in dashboard_apis:
        # Resolve path prefix if it doesn't start with /api/
        original_path = api["path"]
        resolved_paths = []
        if original_path.startswith("/api/"):
            resolved_paths.append(original_path)
        else:
            # httpClient adds /api/v1 to paths not starting with /api/
            # and falls back to without prefix
            resolved_paths.append(f"/api/v1{original_path}")
            resolved_paths.append(original_path)

        for rp in resolved_paths:
            n_path = normalize_path(rp)
            method = api["method"]
            key = (method, n_path)
            if key not in seen_dashboard:
                seen_dashboard[key] = {
                    "original_path": original_path,
                    "resolved_path": rp,
                    "method": method,
                    "file": api["file"],
                    "normalized": n_path
                }

    # Match dashboard apis with backend routes
    matched = []
    missing_in_backend = [] # requested by dashboard but not in backend
    
    for key, d_api in seen_dashboard.items():
        method, n_path = key
        # Check if n_path matches any backend route
        # Also check if method matches
        has_path = n_path in backend_norm
        has_method_match = False
        backend_original = None
        if has_path:
            for b_api in backend_norm[n_path]:
                if b_api["method"] == method or (method == "GET" and b_api["method"] in ["GET", "POST"]): # fallback or matching
                    has_method_match = True
                    backend_original = b_api["original_path"]
                    break
        
        if has_path and has_method_match:
            matched.append({
                "dashboard_path": d_api["original_path"],
                "dashboard_file": d_api["file"],
                "method": method,
                "backend_path": backend_original
            })
        else:
            # Let's try matching with different prefixes or checking if it exists at all
            missing_in_backend.append(d_api)

    # Let's find backend routes that are specifically for dashboard/admin/super but not called in the dashboard
    backend_dashboard_routes = []
    for r in backend_routes:
        path = r["path"]
        method = r["method"].upper()
        if "dashboard" in path or "admin" in path or "super" in path:
            # Check if this route is matched by dashboard
            n_path = normalize_path(path)
            # Find if this (method, n_path) is in seen_dashboard
            is_called = False
            for (dm, dn) in seen_dashboard.keys():
                if dn == n_path and dm == method:
                    is_called = True
                    break
            if not is_called:
                backend_dashboard_routes.append(r)

    # Print results
    print(f"Total Dashboard declared APIs: {len(seen_dashboard)}")
    print(f"Matched with backend: {len(matched)}")
    print(f"Missing in backend: {len(missing_in_backend)}")
    print(f"Backend dashboard-specific routes not used by dashboard: {len(backend_dashboard_routes)}")

    # Let's write a report to scratch/dashboard_api_analysis.json
    analysis_results = {
        "dashboard_declared_count": len(seen_dashboard),
        "matched_count": len(matched),
        "missing_in_backend_count": len(missing_in_backend),
        "backend_unused_dashboard_routes_count": len(backend_dashboard_routes),
        "missing_in_backend": missing_in_backend,
        "backend_unused_dashboard_routes": backend_dashboard_routes,
        "matched": matched
    }
    
    with open(WORKSPACE_DIR / "scratch" / "dashboard_api_analysis.json", "w", encoding="utf-8") as f:
        json.dump(analysis_results, f, indent=2)

if __name__ == "__main__":
    main()
