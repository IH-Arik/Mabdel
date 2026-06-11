import os
import re
import json
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
DASHBOARD_DIR = WORKSPACE_DIR / "madbel-dashboard"
PAGES_DIR = DASHBOARD_DIR / "src" / "Pages"
SERVICES_DIR = DASHBOARD_DIR / "src" / "services"
BACKEND_ROUTES_PATH = WORKSPACE_DIR / "scratch" / "backend_routes.json"

def map_path(path):
    mapped_path = path if path.startswith("/") else f"/{path}"
    
    # Path translation mapper for FastAPI backend dashboard compatibility
    if mapped_path.startswith("/admin/notifications"):
        mapped_path = mapped_path.replace("/admin/notifications", "/dashboard/notifications")
    elif mapped_path == "/admin/password" or mapped_path == "/auth/admin/change-password":
        mapped_path = "/dashboard/admin/change-password"
    elif mapped_path.startswith("/auth/admin/logout"):
        mapped_path = "/dashboard/admin/logout"
    elif mapped_path.startswith("/auth/admin/"):
        mapped_path = mapped_path.replace("/auth/admin/", "/dashboard/admin/auth/")
    elif mapped_path.startswith("/cms/admin/"):
        mapped_path = mapped_path.replace("/cms/admin/", "/dashboard/admin/settings/content")
    elif mapped_path.startswith("/reports/admin"):
        mapped_path = mapped_path.replace("/reports/admin", "/dashboard/admin/reports")
    elif mapped_path.startswith("/billing/admin/transactions"):
        mapped_path = "/dashboard/admin/earnings/transactions"
    elif mapped_path.startswith("/admin/dashboard/overview") or mapped_path.startswith("/dashboard/overview"):
        mapped_path = "/dashboard/admin/summary"
    elif mapped_path.startswith("/admin/dashboard/analytics") or mapped_path.startswith("/dashboard/analytics"):
        mapped_path = "/dashboard/admin/summary"
    elif mapped_path.startswith("/admin/dashboard/recent-users"):
        mapped_path = "/dashboard/admin/users"
    elif mapped_path.startswith("/admin/dashboard/notifications/preview"):
        mapped_path = "/dashboard/notifications"
    elif mapped_path.startswith("/super/"):
        mapped_path = mapped_path.replace("/super/", "/dashboard/super/")
    elif mapped_path.startswith("/admin/"):
        mapped_path = mapped_path.replace("/admin/", "/dashboard/admin/")

    if mapped_path.startswith("/api/"):
        return mapped_path
    else:
        return f"/api/v1{mapped_path}"

def normalize_path(path):
    if not path:
        return ""
    path = path.lower()
    # Normalize parameter placeholders: :id, {user_id}, ${...}
    path = re.sub(r"\$\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\:[a-zA-Z0-9_]+", "{}", path)
    path = path.strip("/")
    return path

def find_active_imports_and_calls():
    active_api_calls = set()
    
    # We only care about active page folders
    active_folders = [
        "Dashboard", "UserList", "Earnings", "Subscriptions", 
        "MakeAdmin", "Analysis", "Messages", "Reports", 
        "Settings", "AdminProfile", "Auth"
    ]
    
    for folder in active_folders:
        folder_path = PAGES_DIR / folder
        if not folder_path.exists():
            continue
            
        for file_path in folder_path.rglob("*.jsx"):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            # Find imported functions from services
            imports = re.findall(r"import\s*\{\s*([^}]+)\s*\}\s*from\s*['\"](?:\.\./)+services/([^'\"]+)['\"]", content)
            for imp_funcs, service_file in imports:
                funcs = [f.strip() for f in imp_funcs.split(",")]
                for func in funcs:
                    if func:
                        active_api_calls.add((func, service_file))
                        
    return active_api_calls

def check_service_definitions(active_calls):
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Normalize backend routes
    backend_map = {}
    for r in backend_routes:
        n = normalize_path(r["path"])
        if n not in backend_map:
            backend_map[n] = []
        backend_map[n].append(r)

    results = []
    for func, service_file in active_calls:
        if not service_file.endswith(".js"):
            service_file = service_file + ".js"
            
        service_path = SERVICES_DIR / service_file
        if not service_path.exists():
            results.append({
                "function": func,
                "service": service_file,
                "status": "Service file missing",
                "calls": []
            })
            continue
            
        with open(service_path, "r", encoding="utf-8") as f:
            service_content = f.read()
            
        # Parse functions and their API requests
        # Find function declaration index
        func_idx = service_content.find(f"export const {func}")
        if func_idx == -1:
            func_idx = service_content.find(f"export function {func}")
            
        if func_idx == -1:
            results.append({
                "function": func,
                "service": service_file,
                "status": "Not Defined in Service File",
                "calls": []
            })
            continue

        # Extract function body snippet (approx 800 chars to cover the declaration and call)
        snippet = service_content[func_idx:func_idx+800]
        
        # Find method inside snippet
        method = "GET"
        method_match = re.search(r"method\s*:\s*['\"\`]([A-Z]{3,6})['\"\`]", snippet)
        if method_match:
            method = method_match.group(1).upper()
        else:
            for m in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                if f"method: \"{m}\"" in snippet or f"method: '{m}'" in snippet:
                    method = m
                    break
        
        # Find paths in snippet
        paths_found = re.findall(r"['\"\`](/[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", snippet)
        
        calls = []
        for path in paths_found:
            resolved_path = map_path(path)
            norm_res = normalize_path(resolved_path)
            
            # Check backend match
            matched_backend = None
            if norm_res in backend_map:
                # First try exact method match
                for r in backend_map[norm_res]:
                    if r["method"].upper() == method:
                        matched_backend = r
                        break
                # If no exact method match, take the first one
                if not matched_backend:
                    matched_backend = backend_map[norm_res][0]
                    
            calls.append({
                "raw_path": path,
                "resolved_path": resolved_path,
                "method": method,
                "matched_backend": matched_backend
            })
            
        # Overall status for this service function
        func_status = "Defined but no paths found"
        if calls:
            # If all calls have a matched backend route with the correct method
            all_matched = True
            any_matched = False
            for c in calls:
                if c["matched_backend"]:
                    any_matched = True
                    if c["matched_backend"]["method"].upper() != c["method"]:
                        all_matched = False
                else:
                    all_matched = False
            
            if all_matched:
                func_status = "Matched"
            elif any_matched:
                func_status = "Partial/Method Mismatch"
            else:
                func_status = "Missing in Backend"

        results.append({
            "function": func,
            "service": service_file,
            "status": func_status,
            "calls": calls
        })
            
    return results

def main():
    active_calls = find_active_imports_and_calls()
    analysis = check_service_definitions(active_calls)
    
    # Sort and write to file
    missing = []
    partial = []
    matched = []
    
    for item in analysis:
        if item["status"] == "Missing in Backend" or item["status"] == "Service file missing" or item["status"] == "Not Defined in Service File":
            missing.append(item)
        elif item["status"] == "Partial/Method Mismatch" or item["status"] == "Defined but no paths found":
            partial.append(item)
        else:
            matched.append(item)
            
    report_lines = []
    report_lines.append(f"--- ACTIVE FRONTEND FUNCTIONS MISSING IN BACKEND ({len(missing)}) ---")
    for item in sorted(missing, key=lambda x: (x["service"], x["function"])):
        report_lines.append(f"Function: {item['function']} ({item['service']}) - {item['status']}")
        for c in item["calls"]:
            report_lines.append(f"  -> Path: [{c['method']}] {c['raw_path']} (Resolved: {c['resolved_path']})")
            
    report_lines.append(f"\n--- ACTIVE FRONTEND FUNCTIONS WITH PARTIAL MATCHES/ISSUES ({len(partial)}) ---")
    for item in sorted(partial, key=lambda x: (x["service"], x["function"])):
        report_lines.append(f"Function: {item['function']} ({item['service']}) - {item['status']}")
        for c in item["calls"]:
            matched_info = f"Matched: [{c['matched_backend']['method']}] {c['matched_backend']['path']}" if c["matched_backend"] else "Not Matched"
            report_lines.append(f"  -> Path: [{c['method']}] {c['raw_path']} (Resolved: {c['resolved_path']}) | {matched_info}")

    report_lines.append(f"\n--- ACTIVE FRONTEND FUNCTIONS FULLY MATCHED ({len(matched)}) ---")
    for item in sorted(matched, key=lambda x: (x["service"], x["function"])):
        report_lines.append(f"Function: {item['function']} ({item['service']})")
        for c in item["calls"]:
            report_lines.append(f"  -> Path: [{c['method']}] {c['resolved_path']} matches {c['matched_backend']['path']}")

    output_path = WORKSPACE_DIR / "scratch" / "active_apis_report.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"Report written to {output_path}")

if __name__ == "__main__":
    main()
