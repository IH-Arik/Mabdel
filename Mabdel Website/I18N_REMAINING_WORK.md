# Website i18n — Remaining Work Prompt

Use this prompt (paste into a new session, or continue in this one) to keep translating the Website into the same 10 languages as the mobile app.

## Prompt to use

```
Continue the Website i18n rollout. Infrastructure is already built:
- src/i18n/translations.js — flat key/value translation dictionary, one block per language code (en-US, bn-BD, hi-IN, ar-SA, es-ES, fr-FR, pt-BR, ru-RU, ur-PK, tr-TR)
- src/context/LanguageContext.jsx — useLanguage() hook exposing { t, language, setLanguage, isRtl, languages }
- src/components/LanguageSwitcher.jsx — dropdown, already wired into MainLayout.jsx, Login.jsx, and Landing.jsx headers

Already fully translated and verified live: Login.jsx, Landing.jsx, MainLayout.jsx, Dashboard.jsx, Calls.jsx, Conversations.jsx, Contacts.jsx.

Next file to translate: <PICK FROM THE LIST BELOW, LARGEST-IMPACT FIRST>

For each file, follow this exact process:
1. Read the full file.
2. Identify every user-facing hardcoded English string: headings, labels, buttons, placeholders, empty states, error/success messages, confirm() dialogs, aria-labels/titles, table headers, select options.
3. Do NOT translate: brand names (GoCustify, Mabdel, WhatsApp, Facebook, Instagram, SMS, CSV), illustrative example placeholder text that's just a format hint (e.g. "e.g. Alex", "alex.t@lumina.ai", a sample street address), backend-returned raw values (status strings, provider names) unless there's an existing pattern for mapping them.
4. Design translation keys with a short page-specific prefix (e.g. `docs_`, `inv_`, `cal_`, `grp_`) to avoid collisions with existing keys already in translations.js. Use `{paramName}` placeholders for interpolation (e.g. `'{n} contacts'`), matching the existing `t(key, params)` interpolate() convention (simple `{{param}}`-free single-brace replace, no plural rules — always phrase strings to read naturally with a bare count, don't build singular/plural branching).
5. Add the new keys to the END of each of the 10 language blocks in translations.js, in the same order every time. Write real, natural translations for each language — not machine-transliteration placeholders. Arabic and Urdu are RTL; nothing extra is needed in the strings themselves for that (the RTL layout flip is automatic via LanguageContext), just translate the text normally.
6. After editing translations.js, validate all 10 blocks still have identical key sets with a throwaway Node script:
   import { TRANSLATIONS } from './src/i18n/translations.js';
   (compare Object.keys(TRANSLATIONS[lang]) against en-US for every lang, report any mismatch)
   Run it, fix any mismatch, then delete the script.
7. Wire the component: import { useLanguage } from '../context/LanguageContext' (adjust relative path for nested folders like Profile/tabs/), call const { t } = useLanguage() inside the component, replace every hardcoded string with t('key') or t('key', { param: value }). If a module-level helper function (defined outside the component) needs translated fallback text, add a `t` parameter to that function and thread it through every call site — don't move the function inside the component unless it's trivial to do so.
8. Fix any react-hooks/exhaustive-deps warnings introduced by using `t` inside useCallback/useMemo/useEffect (add `t` to the dependency array).
9. Run `npx eslint src/pages/<File>.jsx` (from Mabdel Website/) and confirm zero NEW errors (pre-existing unused-import warnings in a file are fine to leave — check via git diff or by noting what was already flagged before your edit).
10. Verify live: dev servers should already be running (backend :8000, website :5173 — start with `.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` from Mabdel Backend/, and `npm run dev` from Mabdel Website/ if not up). Mint a fresh JWT with:
    cd "Mabdel Backend" && .venv/Scripts/python.exe -c "from app.core.security import create_access_token; print(create_access_token('69efae8b5af39608a990e09e', 'ittesafarik@gmail.com'))"
    Then use Playwright: set localStorage 'access_token' to that token and 'mabdel_website_lang' to some non-English language code, navigate to the page, screenshot it, and grep the page text for both the expected translated strings AND for any leftover English chrome you specifically translated (to catch misses). Read the screenshot to visually confirm layout didn't break (especially RTL languages ar-SA/ur-PK).
11. Report what was done in 2-3 sentences, move to the next file.

Do not stop to ask for confirmation between files — keep going through the list below in order until told to stop or until the list is exhausted.
```

## Remaining files, in suggested priority order (biggest user-facing impact first)

| # | File | Lines | Notes |
|---|------|-------|-------|
| 1 | `src/pages/Documents.jsx` | 2028 | Biggest file — leases + agreements list/detail, likely has many status labels and modal forms |
| 2 | `src/pages/Invoices.jsx` | 1700 | Invoice list/detail/create, line items, payment status |
| 3 | `src/pages/Groups.jsx` | 1327 | Group chat / community management |
| 4 | `src/pages/Calendar.jsx` | 1201 | Meeting scheduling, has the analog time picker — don't touch date-math, only UI text |
| 5 | `src/pages/VoiceConversation.jsx` | 1041 | AI voice assistant chat UI |
| 6 | `src/pages/Subscription.jsx` | 914 | Public-facing pricing/signup page — mirror Landing.jsx's approach, also has LanguageSwitcher-worthy header |
| 7 | `src/pages/BulkMessaging.jsx` | 885 | Campaign creation/list |
| 8 | `src/pages/Activities.jsx` | 524 | |
| 9 | `src/pages/JoinEvent.jsx` | 482 | Public-facing meeting join page |
| 10 | `src/pages/Shop.jsx` | 449 | |
| 11 | `src/pages/CreatePost.jsx` | 456 | Social post composer |
| 12 | `src/pages/Integrations.jsx` | 441 | Social/Google/DocuSign connection cards |
| 13 | `src/pages/Notifications.jsx` | 331 | |
| 14 | `src/pages/AIWorkflow.jsx` | 298 | |
| 15 | `src/pages/Profile/tabs/AccountSettingsTab.jsx` | 298 | |
| 16 | `src/pages/Onboarding.jsx` | 244 | Public-facing |
| 17 | `src/pages/Profile/tabs/ProfileTab.jsx` | 241 | |
| 18 | `src/pages/Profile/tabs/SupportTab.jsx` | 227 | |
| 19 | `src/pages/Profile/tabs/BusinessProfileTab.jsx` | 199 | |
| 20 | `src/pages/Profile/tabs/VoiceHistoryTab.jsx` | 180 | |
| 21 | `src/pages/AiCall.jsx` | 159 | |
| 22 | `src/pages/ContentPage.jsx` | 140 | Renders Privacy Policy/Terms/etc — check whether the actual legal *content* should be translated too or just the page chrome (recommend: chrome only, legal text is a much bigger separate task) |
| 23 | `src/pages/Profile/tabs/NotificationsTab.jsx` | 117 | |
| 24 | `src/pages/Profile/tabs/SubscriptionTab.jsx` | 117 | |
| 25 | `src/pages/Profile/tabs/SecurityTab.jsx` | 111 | |
| 26 | `src/pages/Profile/tabs/PrivacyTab.jsx` | 106 | |
| 27 | `src/pages/Profile/index.jsx` | 98 | Tab-switcher shell for all Profile/tabs/* — do this one WITH its first tab file for shared context |
| 28 | `src/pages/AdminPanel.jsx` | 87 | Has its own separate teal theme — do not touch colors, text only |
| 29 | `src/pages/Profile/tabs/AIConfigTab.jsx` | 68 | |
| 30 | `src/pages/Begin.jsx` | 47 | Public-facing |
| 31 | `src/pages/Profile/shared.jsx` | 22 | Shared small components used by the tabs above — do this first if doing any Profile/tabs file, since it's likely imported by all of them |

## Known minor gaps to fix opportunistically (not blocking)

- `Contacts.jsx`'s `fetchContacts()` data-normalization fallbacks (`item.location || item.address || 'Remote'`, `item.company || 'Individual'`, `item.last_interaction || 'Active'`, `item.last_contact_days || 'Today'`) are still hardcoded English — add `contacts_fallback_remote`, `contacts_fallback_individual`, `contacts_fallback_active`, `contacts_fallback_today` keys and wire them in if picking this back up.
- Status badges that echo raw backend values verbatim (e.g. lease/invoice/contact `status` field displayed as-is) are not translated anywhere yet — would need a shared status-label-mapping helper (`t('status_' + status.toLowerCase())`) if full polish is wanted later. Out of scope for the current pass; flagged for awareness only.
