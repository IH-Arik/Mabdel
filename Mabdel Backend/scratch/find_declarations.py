import json
import re
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
REPORT_PATH = WORKSPACE_DIR / "scratch" / "api_usage_report.json"
MOBILE_DIR = WORKSPACE_DIR / "madbel-mobile"
WEB_DIR = WORKSPACE_DIR / "frontend"

def main():
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        report_data = json.load(f)

    # Gather files to search for definitions
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

    declared_but_unused_endpoints = []
    
    for r in report_data:
        if r["is_webhook"]:
            continue
        
        # It's declared but unused if it is declared in at least one platform,
        # but not used on any platform where it is declared.
        # Actually, let's filter for those where either web or mobile has it declared but unused.
        # Specifically, if it is declared in mobile but not used in mobile, OR declared in web but not used in web.
        mobile_declared_unused = r["mobile_declared"] and not r["mobile_used"]
        web_declared_unused = r["web_declared"] and not r["web_used"]
        
        if mobile_declared_unused or web_declared_unused:
            declared_but_unused_endpoints.append(r)

    print(f"Analyzing {len(declared_but_unused_endpoints)} declared but unused endpoints...")

    summary_by_file = {}

    for r in declared_but_unused_endpoints:
        path = r["path"]
        method = r["method"]
        normalized_path = re.sub(r"\{[a-zA-Z0-9_]+\}", ".*", path)
        search_pattern = normalized_path.replace("/", r"\/")

        for file_path in api_files:
            if not file_path.exists():
                continue
            
            relative_path = file_path.relative_to(WORKSPACE_DIR)
            
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            for idx, line in enumerate(lines):
                # check if path is in the line (either exact or matching search pattern regex)
                if path in line or re.search(search_pattern, line):
                    # Found definition! Now find function/endpoint/hook name
                    func_name = None
                    hook_names = []
                    
                    # If it's services.js (web axios client)
                    if "services.js" in file_path.name:
                        func_match = re.search(r"([a-zA-Z0-9_]+)\s*:", line)
                        if func_match:
                            func_name = func_match.group(1)
                            # E.g. smartflowApi.getHome
                            api_obj = "smartflowApi" if "smartflowApi" in "".join(lines[:idx]) else "adminApi"
                            func_name = f"{api_obj}.{func_name}"
                    
                    # If it's a mobile slice or endpoint file (RTK query)
                    else:
                        # Find the query/mutation name (search upwards)
                        found_endpoint = None
                        for offset in range(0, min(15, idx + 1)):
                            check_line = lines[idx - offset]
                            match = re.search(r"([a-zA-Z0-9_]+)\s*:\s*builder\.(query|mutation)", check_line)
                            if not match:
                                # Sometimes it's a custom endpoint object key in injectEndpoints
                                match = re.search(r"^\s*([a-zA-Z0-9_]+)\s*:\s*builder\.", check_line)
                            if match:
                                found_endpoint = match.group(1)
                                break
                        
                        if found_endpoint:
                            func_name = found_endpoint
                            # Hook names: useFoundEndpointQuery, useFoundEndpointMutation
                            hook_base = found_endpoint[0].upper() + found_endpoint[1:]
                            hook_names = [f"use{hook_base}Query", f"use{hook_base}Mutation", f"useLazy{hook_base}Query"]

                    # Add to summary
                    file_key = str(relative_path).replace("\\", "/")
                    if file_key not in summary_by_file:
                        summary_by_file[file_key] = []
                    
                    summary_by_file[file_key].append({
                        "path": path,
                        "method": method,
                        "line_num": idx + 1,
                        "func_name": func_name,
                        "hooks": hook_names
                    })

    # Save to a clean markdown report
    md_content = "# Frontend Declared But Unused APIs Report\n\n"
    md_content += "This report lists the exact files, line numbers, and function/hook names of backend APIs that are declared in the frontend code but never imported or used in screen components.\n\n"

    for file_path, items in sorted(summary_by_file.items()):
        md_content += f"## `{file_path}`\n\n"
        md_content += "| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |\n"
        md_content += "| :--- | :--- | :--- | :--- | :--- |\n"
        for item in sorted(items, key=lambda x: x["line_num"]):
            hooks_str = ", ".join([f"`{h}`" for h in item["hooks"]]) if item["hooks"] else "N/A (Axios)"
            md_content += f"| {item['line_num']} | `{item['method']}` | `{item['path']}` | `{item['func_name']}` | {hooks_str} |\n"
        md_content += "\n"

    report_md_path = WORKSPACE_DIR / "scratch" / "frontend_unused_apis_detail.md"
    with open(report_md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    print(f"Markdown report saved to {report_md_path}")

if __name__ == "__main__":
    main()
