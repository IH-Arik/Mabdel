import os
import subprocess
from pathlib import Path
import markdown

md_path = Path("c:/project/Mabdel AI/API_DOCUMENTATION.md")
html_path = Path("c:/project/Mabdel AI/api_docs_printable.html")
pdf_path = Path("c:/project/Mabdel AI/API_DOCUMENTATION.pdf")

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Convert markdown to HTML
html_body = markdown.markdown(
    md_content,
    extensions=["tables", "fenced_code", "toc"]
)

# Replace status badges and HTTP methods with styled HTML spans
method_replacements = {
    "`GET`": '<span class="badge badge-get">GET</span>',
    "`POST`": '<span class="badge badge-post">POST</span>',
    "`PUT`": '<span class="badge badge-put">PUT</span>',
    "`PATCH`": '<span class="badge badge-patch">PATCH</span>',
    "`DELETE`": '<span class="badge badge-delete">DELETE</span>',
    "`WS`": '<span class="badge badge-ws">WS</span>',
}
for k, v in method_replacements.items():
    html_body = html_body.replace(k, v)

# HTML Template with executive typography and print CSS
html_template = f"""<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <title>GoCustify / Mabdel AI — পূর্ণাঙ্গ API ডকুমেন্টেশন</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        @page {{
            size: A4;
            margin: 18mm 15mm 18mm 15mm;
            @bottom-right {{
                content: "Page " counter(page);
                font-family: 'Inter', sans-serif;
                font-size: 8pt;
                color: #64748b;
            }}
        }}

        * {{
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }}

        body {{
            font-family: 'Hind Siliguri', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 9.5pt;
            line-height: 1.55;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
        }}

        h1, h2, h3, h4 {{
            font-family: 'Inter', 'Hind Siliguri', sans-serif;
            color: #0f172a;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin-top: 1.6em;
            margin-bottom: 0.6em;
            page-break-after: avoid;
        }}

        h1 {{
            font-size: 22pt;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 8px;
            margin-top: 0;
            color: #1e3a8a;
        }}

        h2 {{
            font-size: 15pt;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 5px;
            margin-top: 2em;
            color: #1e40af;
            page-break-before: auto;
        }}

        h3 {{
            font-size: 12pt;
            margin-top: 1.4em;
            color: #0f172a;
        }}

        p, li {{
            color: #334155;
            margin-top: 0.3em;
            margin-bottom: 0.5em;
        }}

        blockquote {{
            margin: 1.2em 0;
            padding: 10px 16px;
            background-color: #f8fafc;
            border-left: 4px solid #3b82f6;
            border-radius: 0 6px 6px 0;
            font-size: 9pt;
            color: #475569;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1.2em 0 1.8em 0;
            font-size: 8.2pt;
            page-break-inside: auto;
        }}

        tr {{
            page-break-inside: avoid;
            page-break-after: auto;
        }}

        thead {{
            display: table-header-group;
        }}

        th {{
            background-color: #f1f5f9;
            color: #0f172a;
            font-weight: 600;
            text-align: left;
            padding: 7px 9px;
            border: 1px solid #cbd5e1;
            font-family: 'Inter', 'Hind Siliguri', sans-serif;
        }}

        td {{
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }}

        tbody tr:nth-child(even) {{
            background-color: #f8fafc;
        }}

        code {{
            font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
            font-size: 8pt;
            background-color: #f1f5f9;
            color: #0f172a;
            padding: 2px 4px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }}

        pre {{
            background-color: #0f172a;
            color: #f8fafc;
            padding: 12px 14px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 8pt;
            line-height: 1.45;
            margin: 1em 0;
            page-break-inside: avoid;
            border: 1px solid #1e293b;
        }}

        pre code {{
            background-color: transparent;
            color: #f8fafc;
            padding: 0;
            border: none;
            font-size: 8pt;
        }}

        .badge {{
            display: inline-block;
            font-family: 'Inter', sans-serif;
            font-size: 7pt;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }}
        .badge-get {{ background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }}
        .badge-post {{ background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }}
        .badge-put {{ background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }}
        .badge-patch {{ background-color: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }}
        .badge-delete {{ background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }}
        .badge-ws {{ background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }}

        hr {{
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 2em 0;
        }}

        .cover-header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
            color: #ffffff;
            padding: 24px 28px;
            border-radius: 8px;
            margin-bottom: 25px;
        }}
        .cover-header h1 {{
            color: #ffffff;
            border-bottom: none;
            margin: 0 0 8px 0;
            font-size: 24pt;
        }}
        .cover-header p {{
            color: #e0f2fe;
            margin: 4px 0;
            font-size: 10pt;
        }}
        .meta-tag {{
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            color: #ffffff;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 8.5pt;
            margin-right: 6px;
            margin-top: 6px;
        }}
    </style>
</head>
<body>
    <div class="cover-header">
        <h1>GoCustify / Mabdel AI</h1>
        <p><strong>পূর্ণাঙ্গ API ও সিস্টেম আর্কিটেকচার মাস্টার ডকুমেন্টেশন</strong></p>
        <div>
            <span class="meta-tag">ভার্সন: ২.০.০</span>
            <span class="meta-tag">মোট এন্ডপয়েন্ট: ৪২৬টি</span>
            <span class="meta-tag">লাইভ অডিটেড</span>
            <span class="meta-tag">১৬টি পেজ-ভিত্তিক মডিউল</span>
        </div>
    </div>
    {html_body}
</body>
</html>
"""

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"Generated printable HTML: {html_path} ({len(html_template)} bytes)")

# Path to Chrome or Edge
chrome_paths = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]

browser_exe = None
for p in chrome_paths:
    if os.path.exists(p):
        browser_exe = p
        break

if not browser_exe:
    print("ERROR: Neither Chrome nor Edge executable was found.")
    exit(1)

print(f"Using browser for PDF generation: {browser_exe}")

cmd = [
    browser_exe,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={str(pdf_path)}",
    str(html_path.resolve())
]

proc = subprocess.run(cmd, capture_output=True, text=True)
if pdf_path.exists() and pdf_path.stat().st_size > 0:
    print(f"SUCCESS: PDF generated successfully at {pdf_path}")
    print(f"PDF File Size: {round(pdf_path.stat().st_size / (1024*1024), 2)} MB ({pdf_path.stat().st_size} bytes)")
else:
    print(f"FAILED to generate PDF. Exit code: {proc.returncode}")
    print(f"Stdout: {proc.stdout}")
    print(f"Stderr: {proc.stderr}")
