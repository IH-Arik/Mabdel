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
    # Normalize: lower case
    path = path.lower()
    # Replace variable placeholders of various formats:
    # 1. `${var_name}` (JS template literal variable)
    # 2. `{var_name}` (FastAPI path param)
    # 3. `:var_name` (Express-style path param)
    path = re.sub(r"\$\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\{[a-zA-Z0-9_]+\}", "{}", path)
    path = re.sub(r"\:[a-zA-Z0-9_]+", "{}", path)
    # Strip leading/trailing slashes
    path = path.strip("/")
    return path

def main():
    # Load backend routes
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Normalize backend routes
    norm_backend = {}
    for r in backend_routes:
        method = r["method"].upper()
        n_path = normalize_path(r["path"])
        if method not in norm_backend:
            norm_backend[method] = set()
        norm_backend[method].add(n_path)

    print(f"Loaded {sum(len(v) for v in norm_backend.values())} normalized backend routes.")

    # Files to search
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
        
        relative_path = file_path.relative_to(WORKSPACE_DIR)
        
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        for idx, line in enumerate(lines):
            # Check for pattern match of paths starting with /api
            matches = re.findall(r"['\"\`](/api[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", line)
            for path in matches:
                # Determine HTTP method
                method = None
                
                # Check line content for Axios call format
                # e.g., client.get(...) or client.post(...)
                for m in ["get", "post", "put", "delete", "patch"]:
                    if f"client.{m}" in line:
                        method = m.upper()
                        break
                
                # If Axios method not on line, check nearby lines (builder syntax)
                if not method:
                    # Search around the current line for method: "METHOD"
                    for offset in range(-5, 6):
                        check_idx = idx + offset
                        if 0 <= check_idx < len(lines):
                            check_line = lines[check_idx]
                            m_match = re.search(r"method\s*:\s*['\"\`]([A-Z]{3,6})['\"\`]", check_line)
                            if m_match:
                                method = m_match.group(1).upper()
                                break
                
                # Default to GET if not found
                if not method:
                    method = "GET"

                frontend_apis.append({
                    "file": str(relative_path).replace("\\", "/"),
                    "line": idx + 1,
                    "path": path,
                    "method": method,
                    "normalized": normalize_path(path)
                })

    print(f"Extracted {len(frontend_apis)} api calls from frontend files.")

    # Find frontend-only APIs (present in frontend but not in backend)
    frontend_only = []
    seen = set()

    for api in frontend_apis:
        method = api["method"]
        n_path = api["normalized"]
        
        # Check if matched in backend
        backend_has_it = False
        if method in norm_backend and n_path in norm_backend[method]:
            backend_has_it = True
            
        if not backend_has_it:
            # Check if this exact combination is already reported
            key = (api["file"], api["line"], method, api["path"])
            if key not in seen:
                seen.add(key)
                frontend_only.append(api)

    print(f"Found {len(frontend_only)} frontend-only APIs.")
    
    # Save the output report
    md_content = "# Frontend-Only APIs (Declared in Frontend but missing in Backend)\n\n"
    md_content += "This report lists the APIs that are called or declared in the frontend code but have no corresponding route implemented in the FastAPI backend.\n\n"
    
    if not frontend_only:
        md_content += "🎉 **No frontend-only APIs found!** All APIs declared in the frontend are implemented in the backend.\n"
    else:
        current_file = None
        for api in sorted(frontend_only, key=lambda x: (x["file"], x["line"])):
            if api["file"] != current_file:
                current_file = api["file"]
                md_content += f"\n## `file:///{WORKSPACE_DIR.as_posix()}/{current_file}`\n\n"
                md_content += "| Line | Method | API Path | Normalized Path |\n"
                md_content += "| :--- | :--- | :--- | :--- |\n"
            md_content += f"| {api['line']} | `{api['method']}` | `{api['path']}` | `{api['normalized']}` |\n"

    report_path = WORKSPACE_DIR / "scratch" / "frontend_only_apis.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    print(f"Report saved to {report_path}")

if __name__ == "__main__":
    main()
