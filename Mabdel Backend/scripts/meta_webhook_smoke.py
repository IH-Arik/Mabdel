"""Check a deployed backend's Meta webhook the way Meta itself will call it.

    python -m scripts.meta_webhook_smoke --base-url https://api.gocustify.com \\
        --platform facebook_messenger --verify-token <META_WEBHOOK_VERIFY_TOKEN> \\
        --app-secret <Meta app secret> --account-id <your Page id>

Steps: (1) the verification handshake must echo the bare challenge, (2) a wrong verify
token must be refused, (3) an unsigned or badly signed event must be refused, (4) a
correctly signed test DM must be acknowledged with 200. Step 4 is a REAL delivery: when
--account-id is a connected Page/Instagram account, the test message lands in that
account's Unified inbox (use --no-message to skip it). Secrets are only ever sent to the
--base-url you give, never printed.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import sys
import time

import httpx

PLATFORMS = ("facebook_messenger", "instagram")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--platform", choices=PLATFORMS, default="facebook_messenger")
    parser.add_argument("--verify-token", required=True)
    parser.add_argument("--app-secret", required=True)
    parser.add_argument("--account-id", required=True, help="the Page id (Messenger) or Instagram professional account id")
    parser.add_argument("--no-message", action="store_true", help="skip the signed test DM (step 4)")
    args = parser.parse_args()

    url = f"{args.base_url.rstrip('/')}/api/v1/smartflow/integrations/{args.platform}/webhook"
    failures = 0

    def report(ok: bool, label: str, detail: str = "") -> None:
        nonlocal failures
        failures += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  {label}{'  -> ' + detail if detail else ''}")

    with httpx.Client(timeout=20.0) as client:
        challenge = str(int(time.time()))
        r = client.get(url, params={"hub.mode": "subscribe", "hub.verify_token": args.verify_token, "hub.challenge": challenge})
        report(r.status_code == 200 and r.text == challenge, "handshake echoes the bare challenge", f"HTTP {r.status_code}, body {r.text[:60]!r}")

        r = client.get(url, params={"hub.mode": "subscribe", "hub.verify_token": "definitely-wrong", "hub.challenge": challenge})
        report(r.status_code != 200, "wrong verify token is refused", f"HTTP {r.status_code}")

        event_id = f"smoke-{int(time.time())}"
        body = {
            "object": "page" if args.platform == "facebook_messenger" else "instagram",
            "entry": [
                {
                    "id": args.account_id,
                    "time": int(time.time()),
                    "messaging": [
                        {
                            "sender": {"id": "SMOKE_TEST_SENDER"},
                            "recipient": {"id": args.account_id},
                            "timestamp": int(time.time() * 1000),
                            "message": {"mid": event_id, "text": "GoCustify webhook smoke test"},
                        }
                    ],
                }
            ],
        }
        raw = json.dumps(body).encode()

        r = client.post(url, content=raw, headers={"content-type": "application/json"})
        report(r.status_code == 401, "unsigned event is refused", f"HTTP {r.status_code}")
        r = client.post(url, content=raw, headers={"content-type": "application/json", "X-Hub-Signature-256": "sha256=" + "0" * 64})
        report(r.status_code == 401, "badly signed event is refused", f"HTTP {r.status_code}")

        if args.no_message:
            print("SKIP  signed test DM (--no-message)")
        else:
            signature = "sha256=" + hmac.new(args.app_secret.encode(), raw, hashlib.sha256).hexdigest()
            r = client.post(url, content=raw, headers={"content-type": "application/json", "X-Hub-Signature-256": signature})
            counts = ""
            try:
                counts = json.dumps(r.json().get("data"))
            except Exception:
                pass
            report(r.status_code == 200, "signed test DM is acknowledged with 200", f"HTTP {r.status_code} {counts}")
            if r.status_code == 200:
                data = (r.json() or {}).get("data") or {}
                if data.get("processed"):
                    print("      A test message from 'SMOKE_TEST_SENDER' is now in that account's Unified inbox.")
                else:
                    print("      Acknowledged but not stored: no CONNECTED integration has that account id yet (connect it first).")

    print("\nAll checks passed." if not failures else f"\n{failures} check(s) failed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
