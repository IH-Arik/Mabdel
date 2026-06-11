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

# Translate frontend path according to our new httpClient.js mapper
def translate_frontend_path(path):
    mapped = path if path.startswith("/") else f"/{path}"
    
    if mapped.startswith("/admin/notifications"):
        mapped = mapped.replace("/admin/notifications", "/dashboard/notifications")
    elif mapped == "/admin/password" or mapped == "/auth/admin/change-password":
        mapped = "/dashboard/admin/change-password"
    elif mapped.startswith("/auth/admin/logout"):
        mapped = "/dashboard/admin/logout"
    elif mapped.startswith("/auth/admin/"):
        mapped = mapped.replace("/auth/admin/", "/dashboard/admin/auth/")
    elif mapped.startswith("/cms/admin/"):
        mapped = mapped.replace("/cms/admin/", "/dashboard/admin/settings/content")
    elif mapped.startswith("/reports/admin"):
        mapped = mapped.replace("/reports/admin", "/dashboard/admin/reports")
    elif mapped.startswith("/billing/admin/transactions"):
        mapped = "/dashboard/admin/earnings/transactions"
    elif mapped.startswith("/admin/dashboard/overview") or mapped.startswith("/dashboard/overview"):
        mapped = "/dashboard/admin/summary"
    elif mapped.startswith("/admin/dashboard/analytics") or mapped.startswith("/dashboard/analytics"):
        mapped = "/dashboard/admin/summary"
    elif mapped.startswith("/admin/dashboard/recent-users"):
        mapped = "/dashboard/admin/users"
    elif mapped.startswith("/admin/dashboard/notifications/preview"):
        mapped = "/dashboard/notifications"
    elif mapped.startswith("/admin/"):
        mapped = mapped.replace("/admin/", "/dashboard/admin/")

    if mapped.startswith("/api/"):
        return mapped
    return f"/api/v1{mapped}"

def main():
    # Load backend routes
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Filter backend routes for dashboard/admin/super/webhooks/notifications
    backend_dashboard_routes = []
    for r in backend_routes:
        path = r["path"]
        method = r["method"].upper()
        if "dashboard" in path or "admin" in path or "super" in path or "notifications" in path:
            backend_dashboard_routes.append({
                "method": method,
                "path": path,
                "normalized": normalize_path(path)
            })

    # Read frontend dashboard files to collect all calls
    frontend_calls = []
    for file_path in DASHBOARD_SERVICES_DIR.glob("*.js"):
        if file_path.name in ["httpClient.js", "staticMockApi.js", "index.js"]:
            continue
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # find path literals
        paths = re.findall(r"['\"\`](/[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", content)
        for path in paths:
            if not path.startswith("/"):
                continue
            
            # Find HTTP method in surrounding code
            method = "GET"
            idx = content.find(path)
            if idx != -1:
                snippet = content[max(0, idx-100):min(len(content), idx+200)]
                m_match = re.search(r"method\s*:\s*['\"\`]([A-Z]{3,6})['\"\`]", snippet)
                if m_match:
                    method = m_match.group(1).upper()
                else:
                    for m in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                        if f"method: \"{m}\"" in snippet or f"method: '{m}'" in snippet:
                            method = m
                            break
            
            # Translate path according to our new mapper
            translated_path = translate_frontend_path(path)
            
            frontend_calls.append({
                "original_path": path,
                "translated_path": translated_path,
                "normalized": normalize_path(translated_path),
                "method": method,
                "file": file_path.name
            })

    # Find backend dashboard routes that have NO matching frontend calls (by normalized path and method)
    unused_backend_routes = []
    for br in backend_dashboard_routes:
        # Check if matched by any frontend call
        matched = False
        for fc in frontend_calls:
            if fc["normalized"] == br["normalized"] and fc["method"] == br["method"]:
                matched = True
                break
        
        if not matched:
            unused_backend_routes.append(br)

    print(f"Total backend dashboard routes: {len(backend_dashboard_routes)}")
    print(f"Total unused backend dashboard routes: {len(unused_backend_routes)}")
    
    # Save the unused backend routes list to json
    with open(WORKSPACE_DIR / "scratch" / "unreferenced_backend_dashboard_apis.json", "w", encoding="utf-8") as f:
        json.dump(unused_backend_routes, f, indent=2)

if __name__ == "__main__":
    main()
