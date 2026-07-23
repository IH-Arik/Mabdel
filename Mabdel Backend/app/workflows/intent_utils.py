from __future__ import annotations

import re

ALLOWED_INTENTS = {
    "invoice",
    "email",
    "bulk_message",
    "calendar",
    "lease",
    "agreement",
    "group",
    "call",
    "contact",
}

_NORMALIZATION_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bcreate[_\s-]*invoice\b", re.I), "create invoice"),
    (re.compile(r"\bnew[_\s-]*invoice\b", re.I), "new invoice"),
    (re.compile(r"\bsend[_\s-]*bulk[_\s-]*message\b", re.I), "send bulk message"),
    (re.compile(r"\bcreate[_\s-]*bulk[_\s-]*message\b", re.I), "create bulk message"),
    (re.compile(r"\bbulk[_\s-]*messaging\b", re.I), "bulk message"),
    (re.compile(r"\bbulk[_\s-]*messages\b", re.I), "bulk message"),
    (re.compile(r"\bbulk\s+massage\b", re.I), "bulk message"),
    (re.compile(r"\bbark\s+message\b", re.I), "bulk message"),
    (re.compile(r"\bbluk\s+message\b", re.I), "bulk message"),
    (re.compile(r"\bblok\s+message\b", re.I), "bulk message"),
    (re.compile(r"\bblock\s+message\b", re.I), "bulk message"),
    (re.compile(r"\b(schedule|create|new|set up|setup)\s+(?:a\s+|an\s+)?meeting\b", re.I), "schedule meeting"),
    (re.compile(r"\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?agreement\b", re.I), "create agreement"),
    (re.compile(r"\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?lease\s+list\b", re.I), "create lease"),
    (re.compile(r"\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?least\b", re.I), "create lease"),
    (re.compile(r"\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?leash\b", re.I), "create lease"),
    (re.compile(r"\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?leese\b", re.I), "create lease"),
]

_INTENT_PATTERNS: list[tuple[str, tuple[re.Pattern[str], ...]]] = [
    ("invoice", (
        re.compile(r"\binvoice\b", re.I),
        re.compile(r"\bbill(?:ing)?\b", re.I),
    )),
    ("bulk_message", (
        re.compile(r"\bbulk\s+message\b", re.I),
        re.compile(r"\bbulk\s+(?:e-?mail|mail|sms)\b", re.I),
        re.compile(r"\bmass\s+(?:message|e-?mail|mail|sms)\b", re.I),
        re.compile(r"\bbroadcast\b", re.I),
    )),
    ("calendar", (
        re.compile(r"\bschedule\s+meeting\b", re.I),
        re.compile(r"\bmeeting\b", re.I),
        re.compile(r"\bcalendar\b", re.I),
    )),
    ("lease", (
        re.compile(r"\blease\b", re.I),
        re.compile(r"\brental\b", re.I),
        re.compile(r"\btenant\b", re.I),
        re.compile(r"\blandlord\b", re.I),
    )),
    ("agreement", (
        re.compile(r"\bagreement\b", re.I),
        re.compile(r"\bcontract\b", re.I),
        re.compile(r"\bnda\b", re.I),
    )),
    ("group", (
        re.compile(r"\bgroup\b", re.I),
        re.compile(r"\bcommunity\b", re.I),
        re.compile(r"\bteam\b", re.I),
    )),
    ("contact", (
        re.compile(r"\bcontact\b", re.I),
        re.compile(r"\bphonebook\b", re.I),
        re.compile(r"\baddress book\b", re.I),
    )),
    ("call", (
        re.compile(r"\bcall\b", re.I),
        re.compile(r"\bdial\b", re.I),
        re.compile(r"\bphone\b", re.I),
    )),
    ("email", (
        re.compile(r"\bemail\b", re.I),
        re.compile(r"\bmail\b", re.I),
    )),
]


def normalize_workflow_command(command: str | None) -> str:
    text = str(command or "").strip()
    if not text:
        return ""

    text = re.sub(r"[_-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    for pattern, replacement in _NORMALIZATION_RULES:
        text = pattern.sub(replacement, text)
    return re.sub(r"\s+", " ", text).strip()


def infer_intent_from_command(command: str | None) -> str | None:
    text = normalize_workflow_command(command)
    if not text:
        return None

    for intent, patterns in _INTENT_PATTERNS:
        if any(pattern.search(text) for pattern in patterns):
            return intent
    return None
