import os
import re
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
DASHBOARD_DIR = WORKSPACE_DIR / "madbel-dashboard"
PAGES_DIR = DASHBOARD_DIR / "src" / "Pages"
SERVICES_DIR = DASHBOARD_DIR / "src" / "services"

def find_active_imports_and_calls():
    # 1. Read all files in Pages directory to find service imports and function calls
    active_api_calls = set()
    
    # We only care about pages that are active in the sidebar/routes
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
            # e.g., import { listUsers, blockUser } from "../../services/adminApi"
            imports = re.findall(r"import\s*\{\s*([^}]+)\s*\}\s*from\s*['\"](?:\.\./)+services/([^'\"]+)['\"]", content)
            for imp_funcs, service_file in imports:
                funcs = [f.strip() for f in imp_funcs.split(",")]
                for func in funcs:
                    if func:
                        active_api_calls.add((func, service_file))
                        
    return active_api_calls

def check_service_definitions(active_calls):
    # 2. Check if the called service functions are defined in the service files
    results = []
    for func, service_file in active_calls:
        # Resolve service file name (e.g. adminApi -> adminApi.js)
        if not service_file.endswith(".js"):
            service_file = service_file + ".js"
            
        service_path = SERVICES_DIR / service_file
        if not service_path.exists():
            results.append({
                "function": func,
                "service": service_file,
                "status": "Service file missing"
            })
            continue
            
        with open(service_path, "r", encoding="utf-8") as f:
            service_content = f.read()
            
        # Check if function is declared as an export
        # e.g., export const listUsers = ... or export function listUsers...
        is_defined = re.search(r"export\s+(?:const|function|let)\s+" + re.escape(func) + r"\b", service_content)
        
        if is_defined:
            # Extract what endpoint it calls
            # Search for apiRequest or apiRequestWithFallback calls within the function body
            # Let's search from the function definition onwards
            func_idx = service_content.find(func)
            snippet = service_content[func_idx:func_idx+300]
            endpoints = re.findall(r"['\"\`](/[a-zA-Z0-9_\-\/\$\{\}\:\.]+?)['\"\`]", snippet)
            results.append({
                "function": func,
                "service": service_file,
                "status": "Defined",
                "endpoints": endpoints
            })
        else:
            results.append({
                "function": func,
                "service": service_file,
                "status": "Not Defined in Service File"
            })
            
    return results

def main():
    active_calls = find_active_imports_and_calls()
    print(f"Detected {len(active_calls)} unique service functions imported in active frontend pages:\n")
    
    analysis = check_service_definitions(active_calls)
    
    # Print report
    print(f"{'Function':<30} | {'Service File':<20} | {'Status':<15} | {'Called Endpoints'}")
    print("-" * 90)
    for item in sorted(analysis, key=lambda x: (x["service"], x["function"])):
        endpoints_str = ", ".join(item.get("endpoints", []))
        print(f"{item['function']:<30} | {item['service']:<20} | {item['status']:<15} | {endpoints_str}")

if __name__ == "__main__":
    main()
