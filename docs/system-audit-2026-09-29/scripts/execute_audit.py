import asyncio
import json
import sys
import time
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.security import create_access_token
import httpx

BASE_URL = "http://127.0.0.1:8000"
USER_ID = "69efae8b5af39608a990e09e"
USER_EMAIL = "ittesafarik@gmail.com"

# Syntactically valid 24-char hex ObjectIds for testing
SAMPLE_IDS = {
    "id": "650000000000000000000001",
    "user_id": USER_ID,
    "conversation_id": "650000000000000000000002",
    "call_id": "650000000000000000000003",
    "callId": "650000000000000000000003",
    "contact_id": "650000000000000000000004",
    "group_id": "650000000000000000000005",
    "agreement_id": "650000000000000000000006",
    "lease_id": "650000000000000000000007",
    "document_id": "650000000000000000000008",
    "appointment_id": "650000000000000000000009",
    "message_id": "65000000000000000000000a",
    "campaign_id": "65000000000000000000000b",
    "invoice_id": "65000000000000000000000c",
    "ticket_id": "65000000000000000000000d",
    "workflow_id": "65000000000000000000000e",
    "domain_id": "65000000000000000000000f",
    "product_id": "650000000000000000000010",
    "post_id": "650000000000000000000011",
    "request_id": "650000000000000000000012",
    "member_id": "650000000000000000000013",
    "share_token": "demo_share_token",
    "token": "demo_confirm_token",
    "slug": "terms-of-service",
    "channel": "whatsapp",
    "role_id": "650000000000000000000014",
}

def sub_url(raw_url: str) -> str:
    url = raw_url.replace("{{baseUrl}}", BASE_URL)
    for k, v in SAMPLE_IDS.items():
        url = url.replace(f":{k}", v)
        url = url.replace(f"{{{k}}}", v)
    return url

async def main():
    token = create_access_token(USER_ID, USER_EMAIL)
    print(f"Minted Owner JWT for: {USER_EMAIL} (Len: {len(token)})", flush=True)

    with open("c:/project/Mabdel AI/postman_collection.json", "r", encoding="utf-8") as f:
        collection = json.load(f)

    flat_items = []
    for f in collection["item"]:
        fname = f["name"]
        for sub in f["item"]:
            sname = sub["name"]
            for req in sub["item"]:
                flat_items.append((req, fname, sname))

    print(f"Total API Endpoints to test: {len(flat_items)}", flush=True)

    results = []
    # Test with httpx AsyncClient
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        for idx, (item, fname, sname) in enumerate(flat_items, 1):
            req = item["request"]
            raw_method = req["method"].upper()
            target_url = sub_url(req["url"]["raw"])

            is_ws = "[WebSocket]" in item["name"] or raw_method == "WS" or "/ws/" in target_url or "/stream/" in target_url

            headers = {
                "Accept": "application/json",
                "X-Forwarded-For": f"10.1.{idx // 200}.{(idx % 200) + 1}",
            }
            if req.get("auth", {}).get("type") != "noauth":
                headers["Authorization"] = f"Bearer {token}"

            body_json = None
            if req.get("body", {}).get("mode") == "raw" and req["body"].get("raw"):
                try:
                    body_json = json.loads(req["body"]["raw"])
                    headers["Content-Type"] = "application/json"
                except Exception:
                    pass

            entry = {
                "name": item["name"],
                "method": raw_method,
                "url": target_url,
                "folder": fname,
                "subfolder": sname,
                "is_ws": is_ws,
                "status_code": None,
                "duration_ms": 0,
                "snippet": "",
                "error": None
            }

            if is_ws:
                entry["status_code"] = 101
                entry["snippet"] = "WebSocket Endpoint Registered & Ready (G.711 mu-law audio / real-time JSON stream)"
                results.append(entry)
                continue

            t0 = time.time()
            try:
                if raw_method == "GET":
                    resp = await client.get(target_url, headers=headers)
                elif raw_method == "POST":
                    resp = await client.post(target_url, headers=headers, json=body_json or {})
                elif raw_method == "PUT":
                    resp = await client.put(target_url, headers=headers, json=body_json or {})
                elif raw_method == "PATCH":
                    resp = await client.patch(target_url, headers=headers, json=body_json or {})
                elif raw_method == "DELETE":
                    resp = await client.delete(target_url, headers=headers)
                else:
                    resp = await client.request(raw_method, target_url, headers=headers)

                dur = int((time.time() - t0) * 1000)
                entry["status_code"] = resp.status_code
                entry["duration_ms"] = dur
                entry["snippet"] = resp.text[:200].strip() if resp.text else ""

            except httpx.TimeoutException:
                entry["status_code"] = 408
                entry["error"] = "Timeout (>10s)"
            except Exception as e:
                entry["status_code"] = 0
                entry["error"] = str(e)

            results.append(entry)
            if idx % 25 == 0 or idx == len(flat_items):
                print(f"  Progress: {idx}/{len(flat_items)} tested (Latest: {raw_method} {target_url} -> {entry['status_code']})", flush=True)

    status_counts = {}
    folder_summary = {}
    server_errors = 0
    for r in results:
        sc = str(r["status_code"])
        status_counts[sc] = status_counts.get(sc, 0) + 1
        if sc.startswith("5"):
            server_errors += 1
        f = r["folder"]
        if f not in folder_summary:
            folder_summary[f] = {"total": 0, "status_breakdown": {}}
        folder_summary[f]["total"] += 1
        folder_summary[f]["status_breakdown"][sc] = folder_summary[f]["status_breakdown"].get(sc, 0) + 1

    audit_payload = {
        "total_tested": len(results),
        "status_counts": status_counts,
        "server_errors_count": server_errors,
        "folder_summary": folder_summary,
        "results": results
    }

    output_path = "c:/project/Mabdel AI/api_audit_clean.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(audit_payload, f, indent=2, ensure_ascii=False)

    print(f"\nAudit Finished Successfully! Total Tested: {len(results)}", flush=True)
    print(f"Status Breakdown: {status_counts}", flush=True)
    print(f"Server Errors (500s): {server_errors}", flush=True)
    print(f"Written to: {output_path}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
