import os
import re
from pathlib import Path

pages_dir = Path("c:/project/Mabdel AI/Mabdel Website/src/pages")

pages = [
    "Landing.jsx",
    "Login.jsx",
    "Subscription.jsx",
    "Onboarding.jsx",
    "Dashboard.jsx",
    "Conversations.jsx",
    "UnifiedConversations.jsx",
    "Calls.jsx",
    "AiCall.jsx",
    "VoiceConversation.jsx",
    "Contacts.jsx",
    "Groups.jsx",
    "Calendar.jsx",
    "ConfirmMeeting.jsx",
    "BulkMessaging.jsx",
    "Documents.jsx",
    "SignDocument.jsx",
    "AIWorkflow.jsx",
    "Integrations.jsx",
    "Invoices.jsx",
    "Shop.jsx",
    "CreatePost.jsx",
    "Activities.jsx",
    "JoinEvent.jsx",
    "Notifications.jsx",
    "AdminPanel.jsx",
    "ContentPage.jsx"
]

results = {}

for p in pages:
    fpath = pages_dir / p
    if not fpath.exists():
        continue
    content = fpath.read_text(encoding="utf-8")
    
    # Find inputs
    inputs = re.findall(r'<input[^>]+name=["\']([^"\']+)["\']|<input[^>]+placeholder=["\']([^"\']+)["\']', content)
    clean_inputs = set()
    for a, b in inputs:
        if a: clean_inputs.add(f"name:{a}")
        if b: clean_inputs.add(f"placeholder:{b}")
        
    # Find api calls
    api_calls = re.findall(r'(smartflowApi\.[a-zA-Z0-9_]+|adminApi\.[a-zA-Z0-9_]+|publicApi\.[a-zA-Z0-9_]+)', content)
    
    # Find hardcoded / mock data patterns
    has_mock = bool(re.search(r'(mock|dummy|fake|sampleData|INITIAL_DATA)', content, re.IGNORECASE))
    
    results[p] = {
        "lines": len(content.splitlines()),
        "size_kb": round(len(content)/1024, 1),
        "inputs_count": len(clean_inputs),
        "inputs_sample": list(clean_inputs)[:6],
        "api_calls": list(set(api_calls)),
        "has_mock": has_mock
    }

for p, r in results.items():
    print(f"=== {p} ({r['size_kb']} KB, {r['lines']} lines) ===")
    print(f"  Inputs ({r['inputs_count']}): {', '.join(r['inputs_sample'])}")
    print(f"  API Calls ({len(r['api_calls'])}): {', '.join(r['api_calls'])}")
    print(f"  Has Mock/Fallback mentions: {r['has_mock']}\n")
