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
| **AI Calls** | Twilio দিয়ে call, Whisper দিয়ে auto-transcript, GPT-4o দিয়ে summary ও sentiment |
| **Bulk Messaging** | CSV upload করো, variable (`{{name}}`) দিয়ে personalized campaign পাঠাও |
| **Documents** | AI দিয়ে Lease Agreement ও Business Agreement তৈরি, DocuSign integration |
| **Invoices** | Line item দিয়ে invoice তৈরি, PDF export, auto reminder |
| **Calendar** | Meeting create/edit/share, Google/Apple calendar sync (planned) |
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
| Calls/SMS | Twilio |
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
- Calls (outbound, incoming, transcript, AI summary, recording)
- Invoices (create, PDF, email delivery, reminders)
- Agreements & Leases (AI generation, DocuSign, sign, renew)
- Bulk Messaging (CSV, scheduling, variable substitution)
- Integrations (Google, Meta, LinkedIn OAuth; WhatsApp, Telegram manual)
- Groups & Community (chat, member roles, invite links)
- Calendar (create, edit, share events)
- Notifications (push, mark read, delete)
- RBAC (backend permission system, Redis-cached)
- Admin Dashboard (analytics, user management, support tickets)
- Onboarding (multi-slide, subscription trial)

### অসম্পূর্ণ / Missing ❌

| Item | সমস্যা |
|---|---|
| **Shop cart/checkout** | "Add to Cart" button আছে, কিন্তু কোনো API নেই — UI only |
| **Mobile RBAC gating** | Backend-এ permission check আছে, কিন্তু mobile screen-এ enforce হয় না |
| **Google/Apple Calendar sync** | FEATURES.md-তে mention আছে, implement হয়নি |
| **Global business chat** | FEATURES.md-তে note আছে, status unclear |

---

## সংক্ষেপে

এটা একটা **production-ready, enterprise-grade monorepo** যেটা basically একটা "mini HubSpot + DocuSign + Twilio" একসাথে। প্রায় সব core feature complete (~90%), শুধু Shop module আর mobile-এর RBAC enforcement বাকি আছে।

AI integration (GPT-4o, Whisper, LangGraph) বেশ deep — শুধু reply suggestion না, পুরো workflow automation আছে। একটা voice command থেকে invoice তৈরি, meeting schedule, bulk campaign — সব AI দিয়ে করা যায়।

### Target Users
- রিয়েল এস্টেট এজেন্ট
- ছোট ব্যবসার সেলস টিম
- Service-based business (যেমন: contractor, consultant)

### Business Model
Subscription-based SaaS — Owner account থেকে team member add হয়, subscription inherit করে।

---

*Generated: August 2026*
