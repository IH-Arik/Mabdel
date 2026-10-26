"""
Generate a complete, page-wise sorted Postman Collection (v2.1.0) for Mabdel AI / GoCustify backend.
Ensures 100% of all registered routes and endpoints are included without missing a single one.
"""
import json
import re
import sys
import uuid
from collections import defaultdict
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app
from starlette.routing import Route, WebSocketRoute

# 1. Fetch OpenAPI schema
openapi = app.openapi()
components_schemas = openapi.get("components", {}).get("schemas", {})

def resolve_ref(ref_str: str) -> dict:
    if not ref_str:
        return {}
    schema_name = ref_str.split("/")[-1]
    return components_schemas.get(schema_name, {})

def generate_example_from_schema(s: dict, depth: int = 0) -> any:
    if depth > 5 or not s or not isinstance(s, dict):
        return None

    if "$ref" in s:
        resolved = resolve_ref(s["$ref"])
        return generate_example_from_schema(resolved, depth + 1)

    if "examples" in s and s["examples"] and isinstance(s["examples"], list):
        return s["examples"][0]
    if "example" in s and s["example"] is not None:
        return s["example"]
    if "default" in s and s["default"] is not None:
        return s["default"]

    if "allOf" in s:
        merged = {}
        for sub in s["allOf"]:
            sub_val = generate_example_from_schema(sub, depth + 1)
            if isinstance(sub_val, dict):
                merged.update(sub_val)
        return merged if merged else None

    if "anyOf" in s and s["anyOf"]:
        for sub in s["anyOf"]:
            if sub.get("type") != "null":
                val = generate_example_from_schema(sub, depth + 1)
                if val is not None:
                    return val
        return None

    if "oneOf" in s and s["oneOf"]:
        for sub in s["oneOf"]:
            if sub.get("type") != "null":
                val = generate_example_from_schema(sub, depth + 1)
                if val is not None:
                    return val
        return None

    stype = s.get("type")
    if stype == "object" or "properties" in s:
        props = s.get("properties", {})
        res = {}
        for prop_name, prop_spec in props.items():
            if prop_name in ("created_at", "updated_at"):
                continue
            val = generate_example_from_schema(prop_spec, depth + 1)
            if val is not None:
                res[prop_name] = val
            else:
                # Fallback based on field name
                lower_name = prop_name.lower()
                if "email" in lower_name:
                    res[prop_name] = "user@example.com"
                elif "phone" in lower_name:
                    res[prop_name] = "+1234567890"
                elif "name" in lower_name:
                    res[prop_name] = "Sample Name"
                elif "url" in lower_name:
                    res[prop_name] = "https://example.com"
                elif "id" in lower_name:
                    res[prop_name] = "sample_id_123"
                else:
                    res[prop_name] = "string"
        return res

    elif stype == "array":
        item_spec = s.get("items", {})
        item_val = generate_example_from_schema(item_spec, depth + 1)
        return [item_val] if item_val is not None else []

    elif stype == "string":
        fmt = s.get("format", "")
        if fmt == "email":
            return "user@example.com"
        if fmt == "date-time":
            return "2026-09-29T12:00:00Z"
        if fmt == "date":
            return "2026-09-29"
        if fmt == "uuid":
            return "123e4567-e89b-12d3-a456-426614174000"
        if "enum" in s and s["enum"]:
            return s["enum"][0]
        title = s.get("title", "").lower()
        if "email" in title:
            return "user@example.com"
        if "password" in title:
            return "SecurePassword123!"
        if "phone" in title:
            return "+1234567890"
        return "sample_text"

    elif stype == "integer":
        return 1
    elif stype == "number":
        return 10.5
    elif stype == "boolean":
        return True

    return None

def categorize_route(method: str, path: str):
    # 01 - Authentication & Onboarding
    if path.startswith("/api/v1/auth"):
        return "01 - Authentication & Onboarding", "Authentication"
    if path.startswith("/api/v1/onboarding"):
        return "01 - Authentication & Onboarding", "Onboarding Wizard"

    # 02 - Dashboard & Analytics
    if path.startswith("/api/v1/smartflow/home"):
        return "02 - Dashboard & Analytics", "Home Overview"
    if path.startswith("/api/v1/smartflow/reports"):
        return "02 - Dashboard & Analytics", "Reports & Analytics"
    if path.startswith("/api/v1/activities"):
        return "02 - Dashboard & Analytics", "Activities Feed"
    if path.startswith("/api/v1/events"):
        return "02 - Dashboard & Analytics", "Events & Audit Logs"

    # 03 - Unified Inbox & Conversations
    if path.startswith("/api/v1/smartflow/ws/conversations") or path.startswith("/api/v1/smartflow/ws/inbox"):
        return "03 - Unified Inbox & Conversations", "WebSockets (Real-time Live Stream)"
    if path.startswith("/api/v1/smartflow/ai/compose") or path.startswith("/api/v1/smartflow/ai/transcribe"):
        return "03 - Unified Inbox & Conversations", "AI Writing & Dictation"
    if path.startswith("/api/v1/smartflow/conversations"):
        return "03 - Unified Inbox & Conversations", "Conversations & Threads"
    if path.startswith("/api/v1/smartflow/messages"):
        return "03 - Unified Inbox & Conversations", "Messages (SMS, Email, WhatsApp)"
    if path == "/api/inbox":
        return "03 - Unified Inbox & Conversations", "Compatibility Inbox"

    # 04 - Calls & Voice AI (Receptionist)
    if path.startswith("/api/v1/smartflow/ai-call-settings"):
        return "04 - Calls & Voice AI (Receptionist)", "Receptionist Settings & Briefing"
    if path.startswith("/api/v1/smartflow/voice"):
        return "04 - Calls & Voice AI (Receptionist)", "Voice Engine"
    if path.startswith("/api/v1/calls/stream"):
        return "04 - Calls & Voice AI (Receptionist)", "Realtime Audio Stream (WebSocket)"
    if path.startswith("/api/v1/smartflow/calls") or path.startswith("/api/v1/calls"):
        return "04 - Calls & Voice AI (Receptionist)", "Call Logs & Actions"
    if path in ("/api/calls", "/api/ai-call-analytics") or path.startswith("/api/calls"):
        return "04 - Calls & Voice AI (Receptionist)", "Compatibility Calls"

    # 05 - Contacts & Audience Groups
    if path.startswith("/api/v1/smartflow/contacts") or path == "/api/contacts":
        return "05 - Contacts & Audience Groups", "Contacts"
    if path.startswith("/api/v1/smartflow/groups") or path.startswith("/api/v1/groups"):
        return "05 - Contacts & Audience Groups", "Contact Groups & Audience"

    # 06 - Calendar, Appointments & Booking
    if path.startswith("/calendar/share"):
        return "06 - Calendar, Appointments & Booking", "Public Booking Share Link"
    if path.startswith("/api/v1/smartflow/calendar") or path.startswith("/api/v1/calendar") or path.startswith("/api/calendar"):
        return "06 - Calendar, Appointments & Booking", "Calendar & Appointments"

    # 07 - Bulk Messaging & SMS Campaigns
    if path.startswith("/api/v1/smartflow/bulk-messages"):
        return "07 - Bulk Messaging & Campaigns", "Campaigns & Broadcasts"

    # 08 - Documents, Agreements & Leases
    if path.startswith("/api/v1/smartflow/agreements"):
        return "08 - Documents, Agreements & Leases", "Agreements & E-Sign"
    if path.startswith("/api/v1/smartflow/leases"):
        return "08 - Documents, Agreements & Leases", "Lease Contracts"
    if path.startswith("/api/v1/smartflow/documents") or path.startswith("/api/documents"):
        return "08 - Documents, Agreements & Leases", "Documents & Files"

    # 09 - AI Workflows & Automations
    if path.startswith("/api/v1/smartflow/ai") or path.startswith("/api/v1/ai"):
        return "09 - AI Workflows & Automations", "SmartFlow Workflows & AI Models"

    # 10 - Integrations (Channels, Telnyx, Stripe)
    if path.startswith("/api/v1/smartflow/integrations/whatsapp"):
        return "10 - Integrations (Channels, Telnyx, Stripe)", "WhatsApp Integration (QR & Official)"
    if path.startswith("/api/v1/smartflow/integrations") or path.startswith("/api/integrations"):
        return "10 - Integrations (Channels, Telnyx, Stripe)", "Multi-Channel Integrations"
    if path.startswith("/api/v1/telnyx"):
        return "10 - Integrations (Channels, Telnyx, Stripe)", "Telnyx Telephony & Phone Numbers"
    if path.startswith("/api/v1/stripe"):
        return "10 - Integrations (Channels, Telnyx, Stripe)", "Stripe Connect"

    # 11 - Settings & Business Profile
    if path.startswith("/api/v1/smartflow/business-profile"):
        return "11 - Settings & Business Profile", "Business Profile & Working Hours"
    if path.startswith("/api/v1/smartflow/email-domain"):
        return "11 - Settings & Business Profile", "Custom Email Domain & DNS"
    if path.startswith("/api/v1/smartflow/account"):
        return "11 - Settings & Business Profile", "Account Settings"
    if path.startswith("/api/v1/smartflow/team"):
        return "11 - Settings & Business Profile", "Team Management & Invites"
    if path.startswith("/api/v1/smartflow/settings"):
        return "11 - Settings & Business Profile", "System & App Settings"
    if path.startswith("/api/v1/smartflow/notifications") or path.startswith("/api/v1/app"):
        return "11 - Settings & Business Profile", "Notifications & Preferences"
    if path.startswith("/api/v1/smartflow/devices"):
        return "11 - Settings & Business Profile", "Registered Devices & Push"
    if path.startswith("/api/v1/smartflow/users"):
        return "11 - Settings & Business Profile", "User Profile"
    if path.startswith("/api/v1/email"):
        return "11 - Settings & Business Profile", "Email Communications"

    # 12 - Billing, Invoices & Shop
    if path.startswith("/api/v1/smartflow/subscription"):
        return "12 - Billing, Invoices & Shop", "Subscription & Plans"
    if path.startswith("/api/v1/invoices"):
        return "12 - Billing, Invoices & Shop", "Invoices & Receipts"
    if path.startswith("/api/v1/shop"):
        return "12 - Billing, Invoices & Shop", "Add-on Shop"

    # 13 - Support & Social Media
    if path.startswith("/api/v1/smartflow/support"):
        return "13 - Support & Social Media", "Support Tickets & FAQ"
    if path.startswith("/api/v1/smartflow/social-posts"):
        return "13 - Support & Social Media", "Social Posts Scheduler"

    # 14 - Admin & Owner Dashboard
    if path.startswith("/api/v1/dashboard/admin"):
        return "14 - Admin & Owner Dashboard", "Admin Metrics, Users & Orgs"
    if path.startswith("/api/v1/dashboard/rbac"):
        return "14 - Admin & Owner Dashboard", "Role-Based Access Control (RBAC)"
    if path.startswith("/api/v1/dashboard/owner"):
        return "14 - Admin & Owner Dashboard", "Owner Team Management"
    if path.startswith("/api/v1/dashboard/availability-slots"):
        return "14 - Admin & Owner Dashboard", "Availability Slots"
    if path.startswith("/api/v1/dashboard/demo-requests"):
        return "14 - Admin & Owner Dashboard", "Demo Requests"
    if path.startswith("/api/v1/dashboard/meeting-requests"):
        return "14 - Admin & Owner Dashboard", "Meeting Requests"
    if path.startswith("/api/v1/dashboard/notifications"):
        return "14 - Admin & Owner Dashboard", "Admin Broadcast Notifications"
    if path.startswith("/api/v1/dashboard/subscription"):
        return "14 - Admin & Owner Dashboard", "Subscription Administration"
    if path.startswith("/api/v1/dashboard/super"):
        return "14 - Admin & Owner Dashboard", "Super Admin Controls"
    if path.startswith("/api/v1/dashboard/webhooks"):
        return "14 - Admin & Owner Dashboard", "Webhooks Monitoring"

    # 15 - Public & Marketing Website
    if path.startswith("/api/v1/public"):
        return "15 - Public & Marketing Website", "Public Marketing APIs"
    if path.startswith("/api/v1/content"):
        return "15 - Public & Marketing Website", "Blog & Legal Content"

    # 16 - System, Webhooks & Health
    if path.startswith("/webhooks"):
        return "16 - System, Webhooks & Health", "Incoming Webhooks"
    if path in ("/health", "/ready"):
        return "16 - System, Webhooks & Health", "Health Checks"
    if path in ("/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"):
        return "16 - System, Webhooks & Health", "API Documentation & Specs"

    # Fallback to general
    return "17 - Miscellaneous APIs", "General"

def is_public_endpoint(method: str, path: str) -> bool:
    if path in ("/health", "/ready", "/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"):
        return True
    if path.startswith("/webhooks"):
        return True
    if path.startswith("/calendar/share"):
        return True
    if path.startswith("/api/v1/public"):
        return True
    if path.startswith("/api/v1/content"):
        return True
    if path in (
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/resend-verification",
        "/api/v1/auth/send-otp",
        "/api/v1/auth/resend-otp",
        "/api/v1/auth/verify-otp",
        "/api/v1/auth/refresh",
        "/api/v1/auth/refresh-token",
        "/api/v1/auth/google",
        "/api/v1/auth/subscription-signup",
    ):
        return True
    return False

def build_postman_item(method: str, path: str, route_obj, openapi_op: dict) -> dict:
    summary = openapi_op.get("summary") or getattr(route_obj, "name", "")
    if summary:
        # Convert snake_case or operationId to Title Case
        clean_name = summary.replace("_", " ").title()
    else:
        clean_name = f"{method} {path}"

    desc = openapi_op.get("description") or getattr(route_obj, "endpoint", None).__doc__ or ""
    desc = desc.strip()

    # URL Path segments
    url_raw = "{{baseUrl}}" + path
    url_segments = [seg for seg in path.strip("/").split("/") if seg]

    # Handle path variables (e.g. {user_id} -> :user_id)
    postman_path_segments = []
    variables = []
    for seg in url_segments:
        if seg.startswith("{") and seg.endswith("}"):
            var_name = seg[1:-1]
            postman_path_segments.append(f":{var_name}")
            variables.append({
                "key": var_name,
                "value": "1",
                "description": f"Path parameter: {var_name}"
            })
        else:
            postman_path_segments.append(seg)

    # Query parameters
    query_params = []
    for param in openapi_op.get("parameters", []):
        if param.get("in") == "query":
            pname = param.get("name")
            pdefault = param.get("schema", {}).get("default")
            pdesc = param.get("description", "")
            preq = param.get("required", False)
            query_params.append({
                "key": pname,
                "value": str(pdefault) if pdefault is not None else "",
                "description": pdesc,
                "disabled": not preq
            })

    # Headers
    headers = [
        {
            "key": "Accept",
            "value": "application/json",
            "type": "text"
        }
    ]

    body_obj = None
    req_body_spec = openapi_op.get("requestBody", {})
    if req_body_spec:
        content_spec = req_body_spec.get("content", {})
        if "application/json" in content_spec:
            headers.append({
                "key": "Content-Type",
                "value": "application/json",
                "type": "text"
            })
            schema = content_spec["application/json"].get("schema", {})
            example_val = generate_example_from_schema(schema)
            if example_val is None:
                example_val = {}
            body_obj = {
                "mode": "raw",
                "raw": json.dumps(example_val, indent=2),
                "options": {
                    "raw": {
                        "language": "json"
                    }
                }
            }
        elif "multipart/form-data" in content_spec:
            schema = content_spec["multipart/form-data"].get("schema", {})
            form_fields = []
            for field_name, field_spec in schema.get("properties", {}).items():
                if field_spec.get("format") == "binary":
                    form_fields.append({
                        "key": field_name,
                        "type": "file",
                        "src": []
                    })
                else:
                    form_fields.append({
                        "key": field_name,
                        "value": str(field_spec.get("default", "value")),
                        "type": "text"
                    })
            body_obj = {
                "mode": "formdata",
                "formdata": form_fields
            }
        elif "application/x-www-form-urlencoded" in content_spec:
            schema = content_spec["application/x-www-form-urlencoded"].get("schema", {})
            urlencoded_fields = []
            for field_name, field_spec in schema.get("properties", {}).items():
                urlencoded_fields.append({
                    "key": field_name,
                    "value": str(field_spec.get("default", "value")),
                    "type": "text"
                })
            body_obj = {
                "mode": "urlencoded",
                "urlencoded": urlencoded_fields
            }

    # Auth configuration
    item_auth = None
    if is_public_endpoint(method, path):
        item_auth = {
            "type": "noauth"
        }

    postman_request = {
        "method": "GET" if method == "WS" else method,
        "header": headers,
        "url": {
            "raw": url_raw,
            "host": ["{{baseUrl}}"],
            "path": postman_path_segments,
        },
        "description": desc
    }

    if method == "WS":
        clean_name = f"[WebSocket] {clean_name}"
        postman_request["header"].append({
            "key": "Upgrade",
            "value": "websocket",
            "type": "text"
        })
        postman_request["header"].append({
            "key": "Connection",
            "value": "Upgrade",
            "type": "text"
        })

    if query_params:
        postman_request["url"]["query"] = query_params
    if variables:
        postman_request["url"]["variable"] = variables
    if body_obj:
        postman_request["body"] = body_obj
    if item_auth:
        postman_request["auth"] = item_auth

    return {
        "name": f"[{method}] {clean_name}",
        "request": postman_request,
        "response": []
    }

def main():
    print("Collecting all FastAPI routes...")
    # Map (method, path) -> (route_obj, openapi_op)
    all_endpoints = []
    seen = set()

    openapi_paths = openapi.get("paths", {})

    for r in app.routes:
        if isinstance(r, Route):
            methods = [m for m in r.methods if m not in ("HEAD", "OPTIONS")]
            for m in methods:
                key = (m.upper(), r.path)
                if key in seen:
                    continue
                seen.add(key)
                op = openapi_paths.get(r.path, {}).get(m.lower(), {})
                all_endpoints.append((m.upper(), r.path, r, op))
        elif isinstance(r, WebSocketRoute):
            key = ("WS", r.path)
            if key in seen:
                continue
            seen.add(key)
            all_endpoints.append(("WS", r.path, r, {}))

    print(f"Total unique registered endpoints: {len(all_endpoints)}")

    # Group into folders: folder_name -> subfolder_name -> list of items
    folder_tree = defaultdict(lambda: defaultdict(list))

    for method, path, route_obj, op in all_endpoints:
        folder, subfolder = categorize_route(method, path)
        item = build_postman_item(method, path, route_obj, op)
        folder_tree[folder][subfolder].append(item)

    # Convert to Postman Collection JSON structure
    postman_folders = []
    total_items_in_collection = 0

    for folder_name in sorted(folder_tree.keys()):
        sub_items = []
        for sub_name in sorted(folder_tree[folder_name].keys()):
            items = folder_tree[folder_name][sub_name]
            # Sort items by path and method
            items.sort(key=lambda x: (x["request"]["url"]["raw"], x["request"]["method"]))
            total_items_in_collection += len(items)
            sub_items.append({
                "name": sub_name,
                "item": items
            })
        postman_folders.append({
            "name": folder_name,
            "item": sub_items
        })

    print(f"Total items organized into collection: {total_items_in_collection}")
    assert total_items_in_collection == len(all_endpoints), "Mismatch between total endpoints and collection items!"

    collection_id = str(uuid.uuid4())
    collection_data = {
        "info": {
            "_postman_id": collection_id,
            "name": "Mabdel AI (GoCustify) - Complete API Collection (Page-wise)",
            "description": (
                "# Mabdel AI / GoCustify Platform API Collection\n\n"
                "Comprehensive Postman collection containing **100% of all platform endpoints** "
                "organized page-wise and module-wise.\n\n"
                "### Included Pages & Modules:\n"
                "- 01. Authentication & Onboarding Wizard\n"
                "- 02. Dashboard, Home & Analytics\n"
                "- 03. Unified Inbox & Conversations (SMS, Email, WhatsApp, Real-time WebSockets)\n"
                "- 04. Calls & Voice AI (Receptionist Realtime Audio Stream & Settings)\n"
                "- 05. Contacts & Audience Groups\n"
                "- 06. Calendar, Appointments & Booking\n"
                "- 07. Bulk Messaging & SMS Campaigns\n"
                "- 08. Documents, Agreements & Lease Contracts\n"
                "- 09. AI Automations & SmartFlow Workflows\n"
                "- 10. Integrations (WhatsApp, Meta, Telegram, Telnyx Telephony, Stripe Connect)\n"
                "- 11. Business Profile, Custom Email Domain & Settings\n"
                "- 12. Billing, Invoices & Add-on Shop\n"
                "- 13. Support Tickets & Social Media\n"
                "- 14. Admin & Owner Dashboard (RBAC, Team, Demos, Super Admin)\n"
                "- 15. Public Website & Legal Content\n"
                "- 16. Webhooks & System Health Checks\n\n"
                "### Environment Variables:\n"
                "- `baseUrl`: Base URL of the API (Default: `http://localhost:8000`)\n"
                "- `authToken`: JWT access token for authenticated requests\n"
                "- `adminToken`: Admin / Superadmin JWT access token\n"
            ),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "variable": [
            {
                "key": "baseUrl",
                "value": "http://localhost:8000",
                "type": "string",
                "description": "API Base URL (e.g. http://localhost:8000 or production https://api.gocustify.com)"
            },
            {
                "key": "authToken",
                "value": "",
                "type": "string",
                "description": "User JWT Bearer token obtained from /api/v1/auth/login"
            },
            {
                "key": "adminToken",
                "value": "",
                "type": "string",
                "description": "Admin JWT Bearer token for /api/v1/dashboard/* routes"
            }
        ],
        "auth": {
            "type": "bearer",
            "bearer": [
                {
                    "key": "token",
                    "value": "{{authToken}}",
                    "type": "string"
                }
            ]
        },
        "item": postman_folders
    }

    # Save to both project root and backend dir
    out_root = Path("c:/project/Mabdel AI/Mabdel_AI_Postman_Collection.json")
    with open(out_root, "w", encoding="utf-8") as f:
        json.dump(collection_data, f, indent=2, ensure_ascii=False)
    print(f"Postman collection successfully written to: {out_root}")

    out_backend = Path("c:/project/Mabdel AI/Mabdel Backend/Mabdel_AI_Postman_Collection.json")
    with open(out_backend, "w", encoding="utf-8") as f:
        json.dump(collection_data, f, indent=2, ensure_ascii=False)
    print(f"Backup copy written to: {out_backend}")

if __name__ == "__main__":
    main()
