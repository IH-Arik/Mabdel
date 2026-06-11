import json
import re
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
REPORT_PATH = WORKSPACE_DIR / "scratch" / "api_usage_report.json"
MOBILE_DIR = WORKSPACE_DIR / "madbel-mobile"
WEB_DIR = WORKSPACE_DIR / "frontend"
ARTIFACT_DIR = Path(r"C:\Users\ittes\.gemini\antigravity-ide\brain\a125fd0d-21ce-49f6-a3ca-09e36062cd4a")
ARTIFACT_PATH = ARTIFACT_DIR / "unused_frontend_apis.md"

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
        
        mobile_declared_unused = r["mobile_declared"] and not r["mobile_used"]
        web_declared_unused = r["web_declared"] and not r["web_used"]
        
        if mobile_declared_unused or web_declared_unused:
            declared_but_unused_endpoints.append(r)

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
                if path in line or re.search(search_pattern, line):
                    func_name = None
                    hook_names = []
                    
                    if "services.js" in file_path.name:
                        func_match = re.search(r"([a-zA-Z0-9_]+)\s*:", line)
                        if func_match:
                            func_name = func_match.group(1)
                            api_obj = "smartflowApi" if "smartflowApi" in "".join(lines[:idx]) else "adminApi"
                            func_name = f"{api_obj}.{func_name}"
                    else:
                        found_endpoint = None
                        for offset in range(0, min(15, idx + 1)):
                            check_line = lines[idx - offset]
                            match = re.search(r"([a-zA-Z0-9_]+)\s*:\s*builder\.(query|mutation)", check_line)
                            if not match:
                                match = re.search(r"^\s*([a-zA-Z0-9_]+)\s*:\s*builder\.", check_line)
                            if match:
                                found_endpoint = match.group(1)
                                break
                        
                        if found_endpoint:
                            func_name = found_endpoint
                            hook_base = found_endpoint[0].upper() + found_endpoint[1:]
                            hook_names = [f"use{hook_base}Query", f"use{hook_base}Mutation", f"useLazy{hook_base}Query"]

                    file_key = str(relative_path).replace("\\", "/")
                    if file_key not in summary_by_file:
                        summary_by_file[file_key] = []
                    
                    # Avoid duplicate records in the same file/line
                    exists = False
                    for item in summary_by_file[file_key]:
                        if item["line_num"] == idx + 1 and item["path"] == path and item["method"] == method:
                            exists = True
                            break
                    if not exists:
                        summary_by_file[file_key].append({
                            "path": path,
                            "method": method,
                            "line_num": idx + 1,
                            "func_name": func_name,
                            "hooks": hook_names
                        })

    # Save to a clean markdown report in Bengali
    md_content = """# ফ্রন্টএন্ডে ঘোষিত কিন্তু অব্যবহৃত এপিআই রিপোর্ট (Unused Frontend APIs)

এই রিপোর্টে ফ্রন্টএন্ড কোডের (Web এবং Mobile) এপিআই ক্লায়েন্ট/সার্ভিসেস ফাইলে যেসব এপিআই ডিক্লেয়ার বা ডিফাইন করা হয়েছে, কিন্তু কোনো স্ক্রিন বা কম্পোনেন্টে এডিট বা ব্যবহার করা হয়নি, তাদের বিস্তারিত তথ্য ফাইল অনুযায়ী দেওয়া হলো।

---

## 📊 ফাইলভিত্তিক বিবরণ (Summary by File)

"""
    for file_path, items in sorted(summary_by_file.items()):
        md_content += f"### 📂 File: [`{file_path}`](file:///{WORKSPACE_DIR.as_posix()}/{file_path})\n\n"
        md_content += "| লাইন নম্বর | Method | API Path (এপিআই রুট) | JS Function / RTK Endpoint | জেনারেটেড হুকসমূহ (Generated Hooks) |\n"
        md_content += "| :--- | :--- | :--- | :--- | :--- |\n"
        for item in sorted(items, key=lambda x: x["line_num"]):
            hooks_str = ", ".join([f"`{h}`" for h in item["hooks"]]) if item["hooks"] else "N/A (Axios used)"
            func_str = f"`{item['func_name']}`" if item['func_name'] else "N/A"
            md_content += f"| L{item['line_num']} | `{item['method']}` | `{item['path']}` | {func_str} | {hooks_str} |\n"
        md_content += "\n---\n\n"

    # Write the file
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACT_PATH, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    print(f"Bilingual report saved to {ARTIFACT_PATH}")

if __name__ == "__main__":
    main()
