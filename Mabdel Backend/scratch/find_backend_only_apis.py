import json
import re
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
BACKEND_ROUTES_PATH = WORKSPACE_DIR / "scratch" / "backend_routes.json"
MOBILE_DIR = WORKSPACE_DIR / "madbel-mobile"
WEB_DIR = WORKSPACE_DIR / "frontend"

def normalize_path(path):
    if not path:
        return ""
    path = path.lower()
    path = re.sub(r"\$\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\:[a-zA-Z0-9_]+", "{}", path)
    path = path.strip("/")
    return path

def main():
    # Load backend routes
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Files to search in frontend
    api_files = [
        WEB_DIR / "src" / "api" / "services.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "authSlice.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelAppContentSlice.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelCompatibilitySlice.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelInvoiceUtilitySlice.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelSmartflowSlice.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelApi" / "endpoints" / "authEndpoints.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelApi" / "endpoints" / "appContentEndpoints.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelApi" / "endpoints" / "compatibilityEndpoints.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelApi" / "endpoints" / "invoiceUtilityEndpoints.js",
        MOBILE_DIR / "src" / "redux" / "slices" / "madbelApi" / "endpoints" / "smartflowEndpoints.js"
    ]

    frontend_apis = []

    for file_path in api_files:
        if not file_path.exists():
            continue
        
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        for idx, line in enumerate(lines):
            matches = re.findall(r"['\"\`](/api[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", line)
            for path in matches:
                method = None
                for m in ["get", "post", "put", "delete", "patch"]:
                    if f"client.{m}" in line:
                        method = m.upper()
                        break
                
                if not method:
                    for offset in range(-5, 6):
                        check_idx = idx + offset
                        if 0 <= check_idx < len(lines):
                            check_line = lines[check_idx]
                            m_match = re.search(r"method\s*:\s*['\"\`]([A-Z]{3,6})['\"\`]", check_line)
                            if m_match:
                                method = m_match.group(1).upper()
                                break
                
                if not method:
                    method = "GET"

                frontend_apis.append({
                    "path": path,
                    "method": method,
                    "normalized": normalize_path(path)
                })

    # Normalize frontend list into a set for fast lookup
    norm_frontend = {}
    for f in frontend_apis:
        method = f["method"]
        n_path = f["normalized"]
        if method not in norm_frontend:
            norm_frontend[method] = set()
        norm_frontend[method].add(n_path)

    # Find backend-only routes (in backend, but not declared in frontend)
    backend_only = []
    seen = set()

    for r in backend_routes:
        method = r["method"].upper()
        path = r["path"]
        
        # Don't list docs or schema routes
        if path in ["/docs", "/redoc", "/openapi.json"]:
            continue
            
        n_path = normalize_path(path)
        
        # Check if declared in frontend
        declared_in_frontend = False
        if method in norm_frontend and n_path in norm_frontend[method]:
            declared_in_frontend = True
            
        if not declared_in_frontend:
            key = (method, path)
            if key not in seen:
                seen.add(key)
                backend_only.append(r)

    print(f"Found {len(backend_only)} backend-only routes.")
    
    # Save the output report
    md_content = "# Backend-Only APIs (Implemented in Backend but missing in Frontend)\n\n"
    md_content += "This report lists all the backend endpoints that are implemented in the FastAPI backend but are **never declared or used** anywhere in the frontend codebases.\n\n"
    md_content += f"**Total Backend-only APIs:** {len(backend_only)}\n\n"
    md_content += "| Method | API Path | Description |\n"
    md_content += "| :--- | :--- | :--- |\n"
    
    for api in sorted(backend_only, key=lambda x: x["path"]):
        desc = "Admin feature / webhook / system route"
        if "webhook" in api["path"]:
            desc = "Webhook Callback"
        elif "admin" in api["path"]:
            desc = "Admin dashboard service"
        elif "super" in api["path"]:
            desc = "Super Admin service"
        md_content += f"| `{api['method']}` | `{api['path']}` | {desc} |\n"

    report_path = WORKSPACE_DIR / "scratch" / "backend_only_apis.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    print(f"Report saved to {report_path}")

if __name__ == "__main__":
    main()
