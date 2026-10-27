# How to use this folder

This folder exists so the mobile developer can close the Website ↔️ App feature gap without needing to re-discover anything — the gap list, the API contracts, and a ready-to-use build prompt are already here.

## Files in this folder

| File | What it's for |
|---|---|
| `01_GAP_ANALYSIS.md` | What's missing from mobile, why it matters, and a size estimate. Read this first to decide what to build and in what order. |
| `02_API_REFERENCE.md` | The exact backend contract (method, path, auth, request/response fields) for every missing feature. The backend is already built — this tells you exactly what to call. |
| `03_BUILD_PROMPT.md` | A copy-paste prompt for an AI coding assistant (Claude Code, Cursor, etc.) to build the screen for one feature at a time. |
| `04_INSTRUCTIONS.md` | This file. |

## Recommended order to build

Build in this order — roughly easiest/highest-impact first, admin panel last since it's internal-only:

1. Stripe Connect for invoices (Small, directly affects whether customers get paid)
2. DocuSign connection (Small)
3. CalDAV integration (Small)
4. AI-call meeting requests (Small)
5. Telnyx self-service (Medium)
6. AI Workflow prompt-to-action (Medium)
7. Business email domain management (Large)
8. AI Call / Receptionist configuration (Large — biggest, consider splitting into sub-tasks per sub-screen)
9. Admin panel (Medium, internal tool — lowest priority, confirm it's needed on mobile before starting)

## Per-feature workflow

1. Open `01_GAP_ANALYSIS.md`, read the entry for the feature you're building.
2. Open `02_API_REFERENCE.md`, find the matching section, confirm the endpoints and field names.
3. Open `03_BUILD_PROMPT.md`, copy the **base prompt** + that feature's **feature block**, paste both into your AI coding assistant inside the `madbel-mobile` repo.
4. Review what it builds against the web page it was told to use as a reference — don't accept a screen that silently drops a validation rule, error state, or field the web version has.
5. Test against the real, running backend (not a mock) by exercising the actual create/edit/delete flow through the new screen, the same way every other feature in this project gets verified.
6. Once it works, commit it as its own scoped commit (one feature per commit) so each gap closes independently and is easy to review.

## If a backend endpoint turns out to be missing or wrong

Everything in `02_API_REFERENCE.md` was pulled directly from the live backend source — if something doesn't match once you try it (a field renamed, a permission that blocks you, a 404), stop and flag it rather than guessing or hand-building a workaround. This should not happen since the backend is already live and used by the website, but if it does, it's a real bug worth reporting, not something to patch around in mobile code.
