import json
from pathlib import Path

WORKSPACE_DIR = Path(r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel")
MAPPED_REPORT_PATH = WORKSPACE_DIR / "scratch" / "dashboard_mapped_report.json"
BACKEND_ROUTES_PATH = WORKSPACE_DIR / "scratch" / "backend_routes.json"

def main():
    with open(MAPPED_REPORT_PATH, "r", encoding="utf-8") as f:
        mapped_data = json.load(f)
        
    with open(BACKEND_ROUTES_PATH, "r", encoding="utf-8") as f:
        backend_routes = json.load(f)

    # Backend dashboard routes
    backend_dashboard_routes = []
    for r in backend_routes:
        path = r["path"]
        method = r["method"].upper()
        if "dashboard" in path or "admin" in path or "super" in path:
            backend_dashboard_routes.append({
                "method": method,
                "path": path
            })

    # Group dashboard items by file
    files_info = {}
    for item in mapped_data:
        file = item["file"]
        if file not in files_info:
            files_info[file] = []
        # avoid duplicate path/method in same file
        if not any(x["dashboard_path"] == item["dashboard_path"] and x["method"] == item["method"] for x in files_info[file]):
            files_info[file].append(item)

    # Let's write a markdown analysis
    md = "# Dashboard & Backend API Mapping Report\n\n"
    
    md += "## 1. Backend এ Dashboard/Admin এর জন্য কি কি API আছে:\n"
    md += "FastAPI ব্যাকএন্ডে টোটাল **৩১টি** অ্যাডমিন/ড্যাশবোর্ড রিলেটেড এপিআই রুট ডিক্লেয়ার করা আছে:\n\n"
    md += "| Method | Backend API Route | Description |\n"
    md += "| :--- | :--- | :--- |\n"
    for r in sorted(backend_dashboard_routes, key=lambda x: x["path"]):
        desc = "Admin feature"
        if "super" in r["path"]:
            desc = "Super Admin feature"
        elif "auth" in r["path"]:
            desc = "Admin Auth"
        elif "chats" in r["path"]:
            desc = "Admin Chat Support"
        elif "earnings" in r["path"]:
            desc = "Earnings & Invoices"
        md += f"| `{r['method']}` | `{r['path']}` | {desc} |\n"
    md += "\n"

    md += "## 2. Dashboard (`madbel-dashboard`) এ কি কি API রিকোয়েস্ট ডিক্লেয়ার করা আছে:\n"
    md += "ড্যাশবোর্ড ফ্রন্টএন্ডের `services/` ফোল্ডারে বিভিন্ন ফাইল অনুযায়ী মোট এপিআই রিকোয়েস্টের তালিকা এবং ব্যাকএন্ডের সাথে তাদের ম্যাপিং স্ট্যাটাস নিচে দেওয়া হলো:\n\n"

    for file, items in sorted(files_info.items()):
        md += f"### 📂 File: `{file}`\n"
        md += "| Function Name | Method | Called Path | Matched Backend Route | Status |\n"
        md += "| :--- | :--- | :--- | :--- | :--- |\n"
        for item in sorted(items, key=lambda x: x["function"]):
            status = item["status"]
            backend_path = item["matched_backend_path"]
            
            if status == "Matched":
                status_str = "✅ Matched"
                bp_str = f"`{backend_path}`"
            elif status == "Needs Mapping":
                status_str = "⚠️ Prefix Mismatch"
                bp_str = f"`{backend_path}`"
            else:
                status_str = "❌ Missing in Backend"
                bp_str = "None"
                
            md += f"| `{item['function']}` | `{item['method']}` | `{item['dashboard_path']}` | {bp_str} | {status_str} |\n"
        md += "\n"

    report_path = WORKSPACE_DIR / "scratch" / "dashboard_api_comparison.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md)
        
    print(f"Comparison report generated and saved to {report_path}")

if __name__ == "__main__":
    main()
