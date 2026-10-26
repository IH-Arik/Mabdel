# GoCustify AI — সম্পূর্ণ Project Analysis

---

## এটা কী?

এটা একটা **AI-powered Business Communication SaaS Platform**। ছোট ব্যবসা, রিয়েল এস্টেট এজেন্ট, সেলস টিম — যারা WhatsApp, Instagram, Telegram, Email, SMS একসাথে ম্যানেজ করতে পারে না, তাদের জন্য। সব কিছু এক জায়গায় এনে AI দিয়ে কাজ সহজ করাই এর মূল লক্ষ্য।

---

## আর্কিটেকচার — ৪টা আলাদা App, ১টা Backend

```
Mabdel Backend      →  FastAPI + Python 3.11 + MongoDB + Redis
Mabdel Website      →  React 18 + Vite + Zustand (Web App)
madbel-mobile       →  React Native 0.74 + Redux/RTK (iOS/Android)
madbel-dashboard    →  React + Tailwind (Admin Panel)
```

Backend একটাই, বাকি তিনটা client সেটাকে consume করে। WebSocket দিয়ে real-time chat চলে।

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GoCustify AI Platform                    │
├──────────────────┬──────────────────┬───────────────────────┤
│   Web App        │   Mobile App     │   Admin Dashboard     │
│ React 18 + Vite  │ React Native     │ React + Tailwind      │
│   Port :5173     │   iOS / Android  │   Port :5174          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         └──────────────────┬─────────────────────┘
                            ▼
              ┌─────────────────────────────┐
              │   FastAPI Backend (Python)  │
              │   REST API  /api/v1/*       │
              │   WebSocket /ws/*           │
              │   Port :8000               │
              └──────┬──────────────┬───────┘
                     │              │
         ┌───────────┘     ┌────────┘
         ▼                 ▼
  ┌─────────────┐  ┌────────────────┐
  │   MongoDB   │  │ OpenAI GPT-4o  │
  │  (Database) │  │ Whisper STT    │
  └──────┬──────┘  └────────────────┘
         │
  ┌──────┴───────┐
  │ Redis Cache  │
  └──────────────┘
```

---

## মূল Features

| Module | কী করে |
|---|---|
| **Unified Inbox** | WhatsApp, Instagram, Telegram, SMS, Email — সব conversation এক জায়গায় |
| **AI Voice Assistant** | কথা বললে AI বুঝে, invoice তৈরি করে, meeting schedule করে |
| **AI Receptionist** | Telnyx দিয়ে real call, OpenAI Realtime API দিয়ে live speech-to-speech (স্ক্রিপ্টেড IVR না) — appointment book/reschedule/cancel, provider ও appointment-type aware, caller-name confirm করে তারপর existing booking change করে, emergency keyword শুনলে team-কে SMS + in-app alert পাঠায় (medical হলে caller-কে 911 বলতেও পারে), per-action approval, call disposition tagging |
| **Bulk Messaging** | CSV upload করো, variable (`{{name}}`) দিয়ে personalized campaign পাঠাও |
| **Documents** | AI দিয়ে Lease Agreement ও Business Agreement তৈরি, DocuSign integration |
| **Invoices** | Line item দিয়ে invoice তৈরি, PDF export, auto reminder |
| **Calendar** | Meeting create/edit/share, Google Calendar ও Apple (CalDAV) two-way sync লাইভ, business hours-এ holiday/blocked-date ও daily-break exception |
| **Groups** | Business internal team group chat |
| **Integrations** | Google, Meta, LinkedIn OAuth; WhatsApp, Telegram manual connect |
| **Shop** | Product listing আছে, কিন্তু cart/checkout নেই (UI only) |
| **Admin Dashboard** | User growth, AI usage cost, earnings, support tickets |
| **RBAC** | Owner team member-কে permission দিতে পারে (backend আছে, mobile-এ নেই) |

---

## Tech Stack বিস্তারিত

### Backend (`Mabdel Backend`)

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.110 + Uvicorn (async) |
| Language | Python 3.11+ |
| Database | MongoDB (Motor async driver) |
| Cache | Redis (RBAC permission cache) |
| AI/ML | OpenAI GPT-4o, Whisper STT, LangGraph (workflow routing) |
| Auth | JWT (HS256) + OAuth2 (Google, Meta, LinkedIn) |
| Calls/SMS | Telnyx (voice + SMS, per-business numbers) |
| Push Notifications | Firebase (FCM) |
| Email | Resend API |
| Validation | Pydantic v2 |

### Web App (`Mabdel Website`)

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| State | Zustand |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 + Framer Motion |
| HTTP Client | Axios |

### Mobile App (`madbel-mobile`)

| Layer | Technology |
|---|---|
| Framework | React Native 0.74 (Expo-based) |
| Navigation | React Navigation v6 |
| State | Redux Toolkit + RTK Query |
| Styling | NativeWind (Tailwind for mobile) |
| Voice/Audio | expo-av + WebSocket |

### Admin Dashboard (`madbel-dashboard`)

| Layer | Technology |
|---|---|
| Framework | React + Tailwind CSS |
| Purpose | User management, analytics, support tickets, earnings |

---

## Backend API Namespaces

```
/api/v1/auth/*                  → Register, Login, OTP, OAuth, Refresh Token
/api/v1/smartflow/*             → Conversations, Contacts, AI, Calls, Documents
/api/v1/smartflow/ai/*          → GPT chat, Voice workflow, Image generation
/api/v1/smartflow/calls/*       → Call management, Transcripts, AI summaries
/api/v1/smartflow/leases/*      → Lease generation, Signing, Renewal
/api/v1/smartflow/agreements/*  → Agreement studio
/api/v1/smartflow/bulk-messages/* → Campaign management
/api/v1/smartflow/integrations/*  → OAuth & manual platform connections
/api/v1/invoices/*              → Invoice CRUD, PDF, Reminders
/api/v1/events/*                → Calendar event management
/api/v1/activities/*            → Activity feed
/api/v1/shop/*                  → Product catalog
/api/v1/dashboard/admin/*       → Admin-only analytics & management
```

---

## Feature Completion Status

### সম্পূর্ণ আছে ✅

- Authentication (Login, OTP verification, Google Sign-in, Refresh Token)
- Conversations & Unified Inbox (multi-platform)
- Contacts (import, add, edit, delete, call)
- **AI Receptionist** (Telnyx + OpenAI Realtime voice, booking/reschedule/cancel, identity confirmation, providers & appointment types, named playbooks, business-hours exceptions, per-action approval, emergency escalation incl. 911 guidance, call disposition tagging) — see dedicated section below
- Calls (outbound, incoming, transcript, AI summary, recording)
- Invoices (create, PDF, email delivery, reminders)
- Agreements & Leases (AI generation, DocuSign, sign, renew)
- Bulk Messaging (CSV, scheduling, variable substitution)
- Integrations (Google, Meta, LinkedIn OAuth; WhatsApp, Telegram manual)
- Groups & Community (chat, member roles, invite links)
- Calendar (create, edit, share events; Google + Apple/CalDAV two-way sync)
- Notifications (push, mark read, delete)
- RBAC (backend permission system, Redis-cached)
- Admin Dashboard (analytics, user management, support tickets)
- Onboarding (multi-slide, subscription trial)

### অসম্পূর্ণ / Missing ❌

| Item | সমস্যা |
|---|---|
| **Shop cart/checkout** | "Add to Cart" button আছে, কিন্তু কোনো API নেই — UI only |
| **Mobile RBAC gating** | Backend-এ permission check আছে, কিন্তু mobile screen-এ enforce হয় না |
| **Global business chat** | FEATURES.md-তে note আছে, status unclear |
| **Onboarding wizard data loss** | `Onboarding.jsx`-এ role/goals/company local state-এ থাকে, কখনো backend-এ save হয় না — শুধু `setTimeout` দিয়ে `/dashboard`-এ redirect করে |
| **AI Receptionist script-writing assist** | Greeting/knowledge/instructions fields plain textarea — "write with AI" বা mic-dictation এখনো wire করা হয়নি (inbox/bulk messaging-এ আছে, AI Config tab-এ নাই) |

---

## AI Receptionist — বিস্তারিত (সর্বশেষ আপডেট: 2026-10-10)

মূল ৫টা client ask (inbox AI reply, voice dictation, auto customer SMS, AI booking/reschedule/cancel, human-sounding receptionist) সম্পূর্ণ হওয়ার পর আরও গভীর কাজ হয়েছে:

| ফিচার | বিবরণ |
|---|---|
| **Providers & Appointment Types** | নির্দিষ্ট staff/resource (real team member অথবা login-less named resource) ও তাদের নিজস্ব duration সহ appointment type — parallel booking সাপোর্ট করে |
| **Named Playbooks** | "caller X বললে, এই প্রশ্নগুলো জিজ্ঞেস করো, এই provider-এর সাথে book করো, এই ব্যক্তিকে notify করো" — LLM-guided, rigid script না |
| **Business Hours Exceptions** | Holiday/blocked-date ও daily break (লাঞ্চ টাইম) — শুধু সাপ্তাহিক generic shedule না |
| **Per-Action Approval** | New booking, reschedule, cancellation — প্রতিটার জন্য আলাদা approval toggle |
| **Call Disposition** | প্রতিটা call স্বয়ংক্রিয়ভাবে ট্যাগ হয় (booked/rescheduled/cancelled/message_taken/transferred/faq_only) — derive হয় actual tool-call সাফল্য থেকে, শুধু attempt থেকে না |
| **Emergency Escalation** | Built-in + custom keyword phrase ডিটেক্ট করলে সাথে সাথে team-কে in-app notification + SMS (dashboard open থাকা লাগবে না) পাঠায়, transfer করে (number configured থাকলে); medical practice-এর জন্য আলাদা মোড — AI caller-কে বলে "hang up করে 911 call করুন" |
| **Identity Confirmation** | শুধু phone number match যথেষ্ট না — existing appointment change করার আগে caller-এর নাম confirm করে (lenient token-overlap match, e.g. "Nadia" matches "Nadia Rahman") |
| **SMS Confirmations & Reminders** | প্রতিটা booking/change/cancellation-এ auto SMS, configurable reminder (e.g. ২৪ ঘণ্টা আগে) |

সবকটাই backend test suite (600+ tests) ও live OpenAI Realtime API call দিয়ে verify করা।

---

## সংক্ষেপে

এটা একটা **production-ready, enterprise-grade monorepo** যেটা basically একটা "mini HubSpot + DocuSign + AI call center" একসাথে। প্রায় সব core feature complete (~90%), শুধু Shop module, mobile-এর RBAC enforcement, আর Onboarding wizard-এর backend-save বাকি আছে।

AI integration (GPT-4o, Whisper, OpenAI Realtime, LangGraph) বেশ deep — শুধু reply suggestion না, পুরো workflow automation আছে। একটা voice command থেকে invoice তৈরি, meeting schedule, bulk campaign — সব AI দিয়ে করা যায়, আর ফোনে real-time কথাও বলে একটা human receptionist-এর মতো।

### Target Users
- রিয়েল এস্টেট এজেন্ট
- ছোট ব্যবসার সেলস টিম
- Service-based business (যেমন: contractor, consultant)

### Business Model
Subscription-based SaaS — Owner account থেকে team member add হয়, subscription inherit করে।

---

*Generated: August 2026 — AI Receptionist section updated: October 2026*
