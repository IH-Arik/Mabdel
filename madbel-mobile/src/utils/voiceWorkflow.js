const INTENT_ORDER = [
  "invoice",
  "bulk_message",
  "calendar",
  "lease",
  "agreement",
  "group",
  "contact",
  "call",
  "email",
];

const INTENT_PATTERNS = {
  invoice: [
    /\bcreate[_\s-]*invoice\b/i,
    /\bnew[_\s-]*invoice\b/i,
    /\binvoice\b/i,
    /\bbill(?:ing)?\b/i,
  ],
  bulk_message: [
    /\bsend[_\s-]*bulk[_\s-]*message\b/i,
    /\bcreate[_\s-]*bulk[_\s-]*message\b/i,
    /\bbulk[_\s-]*message\b/i,
    /\bbulk[_\s-]*messaging\b/i,
    /\bmass[_\s-]*message\b/i,
  ],
  calendar: [
    /\bschedule[_\s-]*meeting\b/i,
    /\bcreate[_\s-]*meeting\b/i,
    /\bmeeting\b/i,
    /\bcalendar\b/i,
  ],
  lease: [
    /\bcreate[_\s-]*lease\b/i,
    /\bnew[_\s-]*lease\b/i,
    /\blease\b/i,
    /\brental\b/i,
    /\btenant\b/i,
    /\blandlord\b/i,
  ],
  agreement: [
    /\bnew[_\s-]*agreement\b/i,
    /\bcreate[_\s-]*agreement\b/i,
    /\bagreement\b/i,
    /\bcontract\b/i,
    /\bnda\b/i,
  ],
  group: [/\bgroup\b/i, /\bcommunity\b/i, /\bteam chat\b/i],
  contact: [/\bcontact\b/i, /\bperson\b/i, /\bphonebook\b/i],
  call: [/\bcall\b/i, /\bphone\b/i, /\bdial\b/i],
  email: [/\bemail\b/i, /\bmail\b/i],
};

const NORMALIZATION_RULES = [
  [/\bcreate[_\s-]*invoice\b/gi, "create invoice"],
  [/\bnew[_\s-]*invoice\b/gi, "new invoice"],
  [/\bsend[_\s-]*bulk[_\s-]*message\b/gi, "send bulk message"],
  [/\bcreate[_\s-]*bulk[_\s-]*message\b/gi, "create bulk message"],
  [/\bbulk[_\s-]*message\b/gi, "bulk message"],
  [/\bbulk[_\s-]*messaging\b/gi, "bulk message"],
  [/\b(schedule|create|new|set up|setup)\s+(?:a\s+|an\s+)?meeting\b/gi, "schedule meeting"],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?agreement\b/gi, "create agreement"],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?lease\b/gi, "create lease"],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?lease\s+list\b/gi, "create lease"],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?least\b/gi, "create lease"],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?leash\b/gi, "create lease"],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?leese\b/gi, "create lease"],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bark\s+message\b/gi, "send bulk message"],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bluk\s+message\b/gi, "send bulk message"],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?blok\s+message\b/gi, "send bulk message"],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?block\s+message\b/gi, "send bulk message"],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bulk\s+massage\b/gi, "send bulk message"],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bulk\s+messages\b/gi, "send bulk message"],
  [/\bbark\s+message\b/gi, "bulk message"],
  [/\bbluk\s+message\b/gi, "bulk message"],
  [/\bblok\s+message\b/gi, "bulk message"],
  [/\bblock\s+message\b/gi, "bulk message"],
  [/\bbulk\s+massage\b/gi, "bulk message"],
];

export const normalizeVoiceWorkflowTranscript = (value) => {
  let text = String(value || "").trim();
  if (!text) return "";

  text = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  NORMALIZATION_RULES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.replace(/\s+/g, " ").trim();
};

export const inferVoiceWorkflowIntent = (value) => {
  const text = normalizeVoiceWorkflowTranscript(value);
  if (!text) return null;

  for (const intent of INTENT_ORDER) {
    const patterns = INTENT_PATTERNS[intent] || [];
    if (patterns.some((pattern) => pattern.test(text))) {
      return intent;
    }
  }

  return null;
};
