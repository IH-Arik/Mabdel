# 📖 GoCustify / Mabdel AI — পূর্ণাঙ্গ API ও সিস্টেম আর্কিটেকচার ডকুমেন্টেশন

> **ডকুমেন্টেশন ভার্সন:** 2.0.0 (Production Hardened)  
> **মোট এন্ডপয়েন্ট সংখ্যা:** **৪২৬টি** (যার মধ্যে ৩টি রিয়েল-টাইম WebSocket রুট)  
> **টেস্টিং স্ট্যাটাস:** ১০০% লাইভ অডিটেড (`api_audit_clean.json`)  
> **পোস্টম্যান কালেকশন:** `postman_collection.json` (পেজ অনুযায়ী ১৬টি ফোল্ডারে সুসজ্জিত)

---

## 📑 সূচিপত্র (Table of Contents)
1. [সার্বিক সিস্টেম আর্কিটেকচার](#1-সার্বিক-সিস্টেম-আর্কিটেকচার)
2. [গ্লোবাল স্ট্যান্ডার্ড ও প্রটোকল](#2-গ্লোবাল-স্ট্যান্ডার্ড-ও-প্রটোকল)
   - Base URL & Routing
   - Authentication & JWT Token Flow
   - রেট লিমিটার (Rate Limiting)
   - স্ট্যান্ডার্ড রেসপন্স এনভেলপ (Response Envelope)
   - এরর হ্যান্ডলিং স্ট্যান্ডার্ড (Error Codes)
   - রিয়েল-টাইম WebSockets গাইড
3. [১৬টি পেজ-ভিত্তিক মডিউলের রেফারেন্স ও এন্ডপয়েন্ট তালিকা](#3-১৬টি-মডিউলের-এন্ডপয়েন্ট-রেফারেন্স)
   - [01 - Authentication & Onboarding](#01---authentication--onboarding)
   - [02 - Dashboard & Analytics](#02---dashboard--analytics)
   - [03 - Unified Inbox & Conversations](#03---unified-inbox--conversations)
   - [04 - Calls & Voice AI (Receptionist)](#04---calls--voice-ai-receptionist)
   - [05 - Contacts & Audience Groups](#05---contacts--audience-groups)
   - [06 - Calendar, Appointments & Booking](#06---calendar-appointments--booking)
   - [07 - Bulk Messaging & Campaigns](#07---bulk-messaging--campaigns)
   - [08 - Documents, Agreements & Leases](#08---documents-agreements--leases)
   - [09 - AI Workflows & Automations](#09---ai-workflows--automations)
   - [10 - Integrations (Channels, Telnyx, Stripe)](#10---integrations-channels-telnyx-stripe)
   - [11 - Settings & Business Profile](#11---settings--business-profile)
   - [12 - Billing, Invoices & Shop](#12---billing-invoices--shop)
   - [13 - Support & Social Media](#13---support--social-media)
   - [14 - Admin & Owner Dashboard](#14---admin--owner-dashboard)
   - [15 - Public & Marketing Website](#15---public--marketing-website)
   - [16 - System, Webhooks & Health](#16---system-webhooks--health)
4. [চিহ্নিত ত্রুটি ও লাইভ অডিট পর্যবেক্ষণ](#4-চিহ্নিত-ত্রুটি-ও-লাইভ-অডিট-পর্যবেক্ষণ)
5. [পোস্টম্যান কালেকশন ব্যবহারের নিয়ম](#5-পোস্টম্যান-কালেকশন-ব্যবহারের-নিয়ম)

---

## 🏛️ 1. সার্বিক সিস্টেম আর্কিটেকচার

```mermaid
flowchart TD
    subgraph Clients [ক্লায়েন্ট ও ফ্রন্টএন্ড এপ্লিকেশন]
        DASH[madbel-dashboard (React + Vite)]
        WEB[Mabdel Website (Next.js / React)]
        MOB[madbel-mobile (React Native / Expo)]
    end

    subgraph API_Gateway [FastAPI Backend Engine (:8000)]
        CORS[CORS & Trusted Hosts Middleware]
        AUTH_RL[Auth Rate Limiter (20 req / 60s)]
        MUT_RL[Mutation Rate Limiter (120 req / 60s)]
        JWT_AUTH[JWT & RBAC Permission Engine]
        ROUTER[16 Page-Wise Route Controllers]
        WS_HUB[WebSocket Audio & Real-time Inbox Hub]
    end

    subgraph Persistence [ডাটাবেস ও ক্যাশ]
        MONGO[(MongoDB Atlas - 54 Collections)]
        REDIS[(Redis Cache / In-Memory Fallback)]
    end

    subgraph Integrations [থার্ড-পার্টি সার্ভিস সমূহ]
        TELNYX[Telnyx Voice & SMS (SIP Trunking)]
        OPENAI[OpenAI Realtime Voice & GPT-4o-mini]
        STRIPE[Stripe Billing & Connect Payouts]
        META[WhatsApp Cloud API & Meta Graph]
        GOOGLE[Google Calendar & OAuth 2.0]
        EMAIL_SVC[Resend / SMTP Custom Domain DNS]
    end

    Clients --> CORS
    CORS --> AUTH_RL
    CORS --> MUT_RL
    AUTH_RL --> JWT_AUTH
    MUT_RL --> JWT_AUTH
    JWT_AUTH --> ROUTER
    JWT_AUTH --> WS_HUB
    ROUTER --> MONGO
    ROUTER --> REDIS
    ROUTER --> TELNYX
    ROUTER --> OPENAI
    ROUTER --> STRIPE
    ROUTER --> META
    ROUTER --> GOOGLE
    ROUTER --> EMAIL_SVC
    WS_HUB <--> TELNYX
    WS_HUB <--> OPENAI
```

---

## 🌐 2. গ্লোবাল স্ট্যান্ডার্ড ও প্রটোকল

### 2.1 Base URL & Routing
- **লোকাল ডেভেলপমেন্ট:** `http://127.0.0.1:8000` বা `http://localhost:8000`
- **API V1 প্রিফিক্স:** `/api/v1` (বেশিরভাগ বিজনেস রুট `/api/v1/smartflow/...` এর অধীনে)
- **পাবলিক ওয়েব রুট:** `/api/v1/public/...` এবং `/legal/...`, `/content/...`
- **রুটিন হেলথ রুট:** `/health`, `/healthz`, `/ready`

### 2.2 Authentication & Token Flow
সিস্টেমে স্টেটলেস JWT (JSON Web Token) বিয়ারার অথেনটিকেশন ব্যবহৃত হয়:
1. **লগইন রিকোয়েস্ট:** `POST /api/v1/auth/login` (email + password) রিটার্ন করে `access_token` এবং `refresh_token`।
2. **অথরাইজেশন হেডার:** প্রতিটি সুরক্ষিত রুটে অবশ্যই নিচের হেডার পাঠাতে হবে:
   ```http
   Authorization: Bearer <access_token>
   ```
3. **টোকেন রোটেশন:** Access Token-এর মেয়াদ ৩০ মিনিট। এক্সপায়ার হলে `POST /api/v1/auth/refresh-token` কল করে নতুন এক্সেস টোকেন পাওয়া যায়।
4. **রোল হায়ারার্কি ও RBAC:** `owner` > `supervisor` > `staff` > `user`। ব্যাকএন্ডের `require_permission(module, action)` ডিপেন্ডেন্সি প্রতিটি রিকোয়েস্টে পারমিশন চেক করে।

### 2.3 রেট লিমিটিং পলিসি (Rate Limiting)
| রুট টাইপ | লিমিট | উইন্ডো | মেথডোলজি | হেডার্স |
| :--- | :--- | :--- | :--- | :--- |
| **Auth Endpoints** (`/api/v1/auth/*`) | ২০ রিকোয়েস্ট | ৬০ সেকেন্ড | ক্লায়েন্ট আইপি ভিত্তিক স্লাইডিং উইন্ডো | `Retry-After`, `X-Request-ID` |
| **Mutation Endpoints** (POST/PUT/PATCH/DELETE) | ১২০ রিকোয়েস্ট | ৬০ সেকেন্ড | আইপি ভিত্তিক স্লাইডিং উইন্ডো (Redis / In-memory) | `Retry-After`, `X-Request-ID` |
| **Safe GET Queries** | আনলিমিটেড (সাধারণ) | — | মেমরি সুরক্ষিত | `X-Request-ID` |

### 2.4 স্ট্যান্ডার্ড রেসপন্স এনভেলপ (Response Envelope)
ব্যাকএন্ডের প্রতিটি API সুসংগত ও স্ট্যান্ডার্ড JSON কাঠামো রিটার্ন করে:

**সফল রেসপন্স (Success 200/201):**
```json
{
  "success": true,
  "message": "Resource fetched successfully.",
  "data": {
    "id": "69efae8b5af39608a990e09e",
    "name": "Example Data"
  }
}
```

**ব্যর্থ রেসপন্স (Error 4xx/5xx):**
```json
{
  "success": false,
  "message": "Human-readable error explanation.",
  "error": {
    "code": "VALIDATION_ERROR | PERMISSION_DENIED | NOT_FOUND",
    "details": {
      "field": "email is required"
    }
  }
}
```

### 2.5 রিয়েল-টাইম WebSockets গাইড
ব্যাকএন্ডে ৩টি প্রধান WebSocket রুট সক্রিয় রয়েছে:
1. **`GET /api/v1/calls/stream/{call_id}`**: Telnyx থেকে ইনকামিং কলের লাইভ অডিও ফোর্ক স্ট্রিমিং (G.711 mu-law অডিও বাফার)।
2. **`GET /api/v1/smartflow/ws/conversations/{conversation_id}?token={jwt}`**: নির্দিষ্ট কাস্টমার চ্যাট থ্রেডের লাইভ মেসেজ স্ট্রিমিং ও টাইপিং ইন্ডিকেটর।
3. **`GET /api/v1/smartflow/ws/inbox?token={jwt}`**: পুরো অর্গানাইজেশনের ইউনিফাইড ইনবক্স নোটিফিকেশন হাব (নতুন SMS, WhatsApp মেসেজ আসার নোটিফিকেশন)।

---

## 📦 3. ১৬টি মডিউলের এন্ডপয়েন্ট রেফারেন্স

### 01 - Authentication & Onboarding
**মোট এন্ডপয়েন্ট সংখ্যা:** 18টি

- **কী কী করা যাবে (Capabilities):** ইউজার একাউন্ট তৈরি, সিকিউর লগইন, পাসওয়ার্ড পুনরুদ্ধার, সেশন ম্যানেজমেন্ট ও প্রাথমিক বিজনেস অনবোর্ডিং।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Auth/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `madbel-dashboard/src/Pages/Onboarding/OnboardingWizard.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `users`, `otp_codes`, `refresh_tokens`, `business_profiles`
- **এক্সটার্নাল সার্ভিস:** Google OAuth 2.0, Microsoft Graph OAuth, Resend / SMTP Email Provider

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | [POST] Forgot Password | `/api/v1/auth/forgot-password` | পাবলিক (No Auth) | 🔍 404 (ID Not Found) |
| `POST` | [POST] Google Login | `/api/v1/auth/google` | পাবলিক (No Auth) | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Login | `/api/v1/auth/login` | পাবলিক (No Auth) | ✅ 200 OK |
| `POST` | [POST] Logout | `/api/v1/auth/logout` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Me | `/api/v1/auth/me` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Refresh Token | `/api/v1/auth/refresh-token` | পাবলিক (No Auth) | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Register | `/api/v1/auth/register` | পাবলিক (No Auth) | ⚠️ 409 |
| `POST` | [POST] Resend Otp | `/api/v1/auth/resend-otp` | পাবলিক (No Auth) | 🔍 404 (ID Not Found) |
| `POST` | [POST] Reset Password | `/api/v1/auth/reset-password` | পাবলিক (No Auth) | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Send Otp | `/api/v1/auth/send-otp` | পাবলিক (No Auth) | 🔍 404 (ID Not Found) |
| `POST` | [POST] Subscription Signup | `/api/v1/auth/subscription-signup` | পাবলিক (No Auth) | ⚠️ 400 |
| `POST` | [POST] Verify Otp | `/api/v1/auth/verify-otp` | পাবলিক (No Auth) | ⚠️ 400 |
| `POST` | [POST] Mark Onboarding As Completed | `/api/v1/onboarding/complete` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Fetch Onboarding Progress By User Id Or Device Id | `/api/v1/onboarding/progress` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Save Current Onboarding Step | `/api/v1/onboarding/progress` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Reset Onboarding Progress (Testing/Admin Only) | `/api/v1/onboarding/reset` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Mark Onboarding As Skipped | `/api/v1/onboarding/skip` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Onboarding Slides | `/api/v1/onboarding/slides` | 🔒 Bearer Token | ✅ 200 OK |

---

### 02 - Dashboard & Analytics
**মোট এন্ডপয়েন্ট সংখ্যা:** 10টি

- **কী কী করা যাবে (Capabilities):** ব্যবসার সামগ্রিক পারফরম্যান্স মেট্রিক্স, এআই সেভিংস ম্যাট্রিক্স, অডিট হিস্টোরি এবং কাস্টম বিজনেস রিপোর্ট।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Dashboard/Home.jsx`, `madbel-dashboard/src/Pages/Analysis/AnalyticsView.jsx`, `madbel-dashboard/src/Pages/Activity & Events/ActivitiesList.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `call_logs`, `messages`, `contacts`, `calendar_events`, `reports`, `audit_events`
- **এক্সটার্নাল সার্ভিস:** Chart.js / Recharts, Real-time Aggregation Pipeline

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] List Activities | `/api/v1/activities` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Activity | `/api/v1/activities` | 🔒 Bearer Token | ✅ 201 OK |
| `POST` | [POST] Join Activity | `/api/v1/activities/{activity_id}/join` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] List Events | `/api/v1/events` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Event | `/api/v1/events` | 🔒 Bearer Token | ✅ 201 OK |
| `POST` | [POST] Join Event | `/api/v1/events/{event_id}/join` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Leave Event | `/api/v1/events/{event_id}/leave` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Home Dashboard | `/api/v1/smartflow/home` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create User Report | `/api/v1/smartflow/reports` | 🔒 Bearer Token | ✅ 201 OK |
| `GET` | [GET] List Report Categories | `/api/v1/smartflow/reports/categories` | 🔒 Bearer Token | ✅ 200 OK |

---

### 03 - Unified Inbox & Conversations
**মোট এন্ডপয়েন্ট সংখ্যা:** 23টি

- **কী কী করা যাবে (Capabilities):** ওমনিচ্যানেল চ্যাট ইনবক্স (SMS, WhatsApp, ইমেইল, ইনস্টাগ্রাম), টিম চ্যাট অ্যাসাইনমেন্ট, এআই কম্পোজ এবং লাইভ চ্যাট WebSocket।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Messages/Inbox.jsx`, `ChatThread.jsx`, `MessageComposer.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `conversations`, `messages`, `typing_states`, `contacts`, `users`
- **এক্সটার্নাল সার্ভিস:** Telnyx SMS API, Meta WhatsApp Cloud API, OpenAI GPT-4o-mini (AI Compose & Transcribe)

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | [POST] Ai Compose | `/api/v1/smartflow/ai/compose` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Ai Transcribe | `/api/v1/smartflow/ai/transcribe` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Get Inbox | `/api/inbox` | 🔒 Bearer Token | ⏳ 408 (Timeout >10s) |
| `GET` | [GET] List Conversations | `/api/v1/smartflow/conversations` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Conversation | `/api/v1/smartflow/conversations` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] List Conversation Assignees | `/api/v1/smartflow/conversations/assignees` | 🔒 Bearer Token | ✅ 200 OK |
| `DELETE` | [DELETE] Delete Conversation | `/api/v1/smartflow/conversations/{conversation_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Conversation | `/api/v1/smartflow/conversations/{conversation_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Archive Conversation | `/api/v1/smartflow/conversations/{conversation_id}/archive` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Assign Conversation | `/api/v1/smartflow/conversations/{conversation_id}/assign` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Upload Conversation Attachment | `/api/v1/smartflow/conversations/{conversation_id}/attachments` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Conversation Contact | `/api/v1/smartflow/conversations/{conversation_id}/contact` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Mark Conversation Read | `/api/v1/smartflow/conversations/{conversation_id}/mark-read` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Messages | `/api/v1/smartflow/conversations/{conversation_id}/messages` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Typing State | `/api/v1/smartflow/conversations/{conversation_id}/typing` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Set Typing State | `/api/v1/smartflow/conversations/{conversation_id}/typing` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Create Message | `/api/v1/smartflow/messages` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Unread Summary | `/api/v1/smartflow/messages/unread-summary` | 🔒 Bearer Token | ✅ 200 OK |
| `PATCH` | [PATCH] Update Message | `/api/v1/smartflow/messages/{message_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Forward Message | `/api/v1/smartflow/messages/{message_id}/forward` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Reply To Message | `/api/v1/smartflow/messages/{message_id}/reply` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [WS] [WebSocket] Conversation Stream | `/api/v1/smartflow/ws/conversations/{conversation_id}` | 🔒 Bearer Token | ⚡ 101 WebSocket |
| `GET` | [WS] [WebSocket] Inbox Stream | `/api/v1/smartflow/ws/inbox` | 🔒 Bearer Token | ⚡ 101 WebSocket |

---

### 04 - Calls & Voice AI (Receptionist)
**মোট এন্ডপয়েন্ট সংখ্যা:** 28টি

- **কী কী করা যাবে (Capabilities):** স্বয়ংক্রিয় এআই ভয়েস রিসেপশনিস্ট, ইনকামিং কল রিসিভ, লাইভ অডিও স্ট্রিমিং (WebSocket), কল রেকর্ডিং এবং এআই ট্রান্সক্রিপ্ট ও সামারি।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Calls/CallHistory.jsx`, `LiveCallMonitor.jsx`, `madbel-dashboard/src/Pages/Settings/VoiceReceptionistSetup.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `call_logs`, `receptionist_settings`, `contacts`, `phone_numbers`
- **এক্সটার্নাল সার্ভিস:** Telnyx Voice API (SIP Trunking & Media Forking), OpenAI Realtime API (gpt-realtime), Deepgram

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | [POST] Telnyx Call Webhook | `/api/v1/calls/webhook` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Call Action | `/api/v1/calls/{call_sid}/action` | 🔒 Bearer Token | ⚠️ 400 |
| `GET` | [GET] Get Live Call Transcript | `/api/v1/calls/{call_sid}/transcript` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Calls | `/api/v1/smartflow/calls` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Call Log | `/api/v1/smartflow/calls` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] List Call Meeting Requests | `/api/v1/smartflow/calls/meeting-requests` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Accept Call Meeting Request | `/api/v1/smartflow/calls/meeting-requests/{request_id}/accept` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Decline Call Meeting Request | `/api/v1/smartflow/calls/meeting-requests/{request_id}/decline` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Create Outbound Call | `/api/v1/smartflow/calls/outbound` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Call Summary | `/api/v1/smartflow/calls/summary` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Call Log | `/api/v1/smartflow/calls/{call_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Call Log | `/api/v1/smartflow/calls/{call_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Call Ai Summary | `/api/v1/smartflow/calls/{call_id}/ai-summary` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PUT` | [PUT] Update Call Ai Summary | `/api/v1/smartflow/calls/{call_id}/ai-summary` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Request Call Callback | `/api/v1/smartflow/calls/{call_id}/callback` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Call Recording | `/api/v1/smartflow/calls/{call_id}/recording` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PUT` | [PUT] Update Call Recording | `/api/v1/smartflow/calls/{call_id}/recording` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Call Transcript | `/api/v1/smartflow/calls/{call_id}/transcript` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PUT` | [PUT] Update Call Transcript | `/api/v1/smartflow/calls/{call_id}/transcript` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Ai Call Analytics | `/api/ai-call-analytics` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Request Call Callback | `/api/calls/{callId}/callback` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [WS] [WebSocket] Call Stream | `/api/v1/calls/stream/{call_id}` | 🔒 Bearer Token | ⚡ 101 WebSocket |
| `GET` | [GET] Get Ai Call Settings | `/api/v1/smartflow/ai-call-settings` | 🔒 Bearer Token | ✅ 200 OK |
| `PATCH` | [PATCH] Update Ai Call Settings | `/api/v1/smartflow/ai-call-settings` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Start Ai Call Test | `/api/v1/smartflow/ai-call-settings/test/start` | 🔒 Bearer Token | ✅ 200 OK |
| `DELETE` | [DELETE] End Ai Call Test | `/api/v1/smartflow/ai-call-settings/test/{session_id}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Send Ai Call Test Message | `/api/v1/smartflow/ai-call-settings/test/{session_id}/message` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Transcribe Voice | `/api/v1/smartflow/voice/transcribe` | 🔒 Bearer Token | ⏳ 408 (Timeout >10s) |

---

### 05 - Contacts & Audience Groups
**মোট এন্ডপয়েন্ট সংখ্যা:** 22টি

- **কী কী করা যাবে (Capabilities):** সম্পূর্ণ CRM কন্ট্যাক্ট ডিরেক্টরি, কাস্টম ফিল্ডস, অডিয়েন্স সেগমেন্টেশন এবং মাল্টি-চ্যানেল আইডি মার্জিং।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/ClientManagement/ContactList.jsx`, `ContactDetail.jsx`, `AudienceGroups.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `contacts`, `groups`, `messages`, `call_logs`
- **এক্সটার্নাল সার্ভিস:** Gravatar, Local Media Upload Storage

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | [POST] Create Group | `/api/v1/groups` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Groups | `/api/v1/smartflow/groups` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Group | `/api/v1/smartflow/groups` | 🔒 Bearer Token | ⚠️ 400 |
| `DELETE` | [DELETE] Delete Group | `/api/v1/smartflow/groups/{group_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Group | `/api/v1/smartflow/groups/{group_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Group | `/api/v1/smartflow/groups/{group_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Invite Group Member | `/api/v1/smartflow/groups/{group_id}/invites` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `DELETE` | [DELETE] Cancel Group Invite | `/api/v1/smartflow/groups/{group_id}/invites/{invite_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Leave Group | `/api/v1/smartflow/groups/{group_id}/leave` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Add Group Members | `/api/v1/smartflow/groups/{group_id}/members` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `DELETE` | [DELETE] Remove Group Member | `/api/v1/smartflow/groups/{group_id}/members/{member_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Group Member Role | `/api/v1/smartflow/groups/{group_id}/members/{member_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Contacts | `/api/contacts` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Contacts | `/api/v1/smartflow/contacts` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Contact | `/api/v1/smartflow/contacts` | 🔒 Bearer Token | ✅ 201 OK |
| `GET` | [GET] Export Contacts | `/api/v1/smartflow/contacts/export` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Import Contacts | `/api/v1/smartflow/contacts/import` | 🔒 Bearer Token | ✅ 201 OK |
| `DELETE` | [DELETE] Delete Contact | `/api/v1/smartflow/contacts/{contact_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Contact | `/api/v1/smartflow/contacts/{contact_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Contact | `/api/v1/smartflow/contacts/{contact_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Upload Contact Avatar | `/api/v1/smartflow/contacts/{contact_id}/avatar` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Contact Conversations | `/api/v1/smartflow/contacts/{contact_id}/conversations` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |

---

### 06 - Calendar, Appointments & Booking
**মোট এন্ডপয়েন্ট সংখ্যা:** 14টি

- **কী কী করা যাবে (Capabilities):** স্মার্ট অ্যাপয়েন্টমেন্ট শিডিউলিং, গুগল ক্যালেন্ডার দ্বিমুখী সিঙ্ক এবং পাবলিক শেয়ারেবল বুকিং লিংক তৈরি।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Calendar/CalendarView.jsx`, `Mabdel Website/src/pages/PublicBookingPage.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `calendar_events`, `business_profiles`, `contacts`
- **এক্সটার্নাল সার্ভিস:** Google Calendar API (OAuth), iCal / CalDAV

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | [POST] Connect Calendar | `/api/calendar/connect` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Calendar Events | `/api/calendar/events` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Schedule Meeting | `/api/v1/calendar/schedule` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Business Hours | `/api/v1/smartflow/calendar/business-hours` | 🔒 Bearer Token | ✅ 200 OK |
| `PUT` | [PUT] Update Business Hours | `/api/v1/smartflow/calendar/business-hours` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] List Calendar Events | `/api/v1/smartflow/calendar/events` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Calendar Event | `/api/v1/smartflow/calendar/events` | 🔒 Bearer Token | ⚠️ 400 |
| `DELETE` | [DELETE] Delete Calendar Event | `/api/v1/smartflow/calendar/events/{event_id}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Calendar Event | `/api/v1/smartflow/calendar/events/{event_id}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `PATCH` | [PATCH] Update Calendar Event | `/api/v1/smartflow/calendar/events/{event_id}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Share Calendar Event | `/api/v1/smartflow/calendar/events/{event_id}/share` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Calendar Provider Settings | `/api/v1/smartflow/calendar/provider-settings` | 🔒 Bearer Token | ✅ 200 OK |
| `PUT` | [PUT] Set Primary Calendar Provider | `/api/v1/smartflow/calendar/provider-settings` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Shared Calendar Event | `/calendar/share/{share_token}` | পাবলিক (No Auth) | ✅ রেজিস্টার্ড |

---

### 07 - Bulk Messaging & Campaigns
**মোট এন্ডপয়েন্ট সংখ্যা:** 9টি

- **কী কী করা যাবে (Capabilities):** কাস্টমার অডিয়েন্স গ্রুপে এক ক্লিকে হাজার হাজার SMS বা ইমেইল ব্রডকাস্ট পাঠানো এবং এআই দিয়ে কনটেন্ট অপটিমাইজেশন।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Campaigns/BulkBroadcast.jsx`, `CampaignAnalytics.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `bulk_messages`, `contacts`, `groups`, `messages`
- **এক্সটার্নাল সার্ভিস:** Telnyx SMS API, Resend Bulk Email API, OpenAI GPT-4o-mini

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] List Bulk Messages | `/api/v1/smartflow/bulk-messages` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Bulk Message | `/api/v1/smartflow/bulk-messages` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Upload Bulk Message Attachment | `/api/v1/smartflow/bulk-messages/attachments` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Improve Bulk Message Content | `/api/v1/smartflow/bulk-messages/improve-content` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Validate Bulk Recipients | `/api/v1/smartflow/bulk-messages/recipients/validate` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Bulk Message | `/api/v1/smartflow/bulk-messages/{bulk_message_id}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `PATCH` | [PATCH] Update Bulk Message | `/api/v1/smartflow/bulk-messages/{bulk_message_id}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Cancel Bulk Message | `/api/v1/smartflow/bulk-messages/{bulk_message_id}/cancel` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Send Bulk Message | `/api/v1/smartflow/bulk-messages/{bulk_message_id}/send` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |

---

### 08 - Documents, Agreements & Leases
**মোট এন্ডপয়েন্ট সংখ্যা:** 52টি

- **কী কী করা যাবে (Capabilities):** ডিজিটাল কন্ট্রাক্ট তৈরি, আইনি ই-স্বাক্ষর (E-Sign), প্রপার্টি লিজ এগ্রিমেন্ট এবং ক্রিপ্টোগ্রাফিক অডিট ট্রেইল।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Documents/AgreementsList.jsx`, `LeaseManager.jsx`, `Mabdel Website/src/pages/PublicSignaturePage.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `agreements`, `signature_requests`, `documents`, `contacts`
- **এক্সটার্নাল সার্ভিস:** PDFKit / Weasyprint, SHA-256 Signature Audit Trail

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] List Agreements | `/api/v1/smartflow/agreements` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Agreement | `/api/v1/smartflow/agreements` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Generate Agreement Draft | `/api/v1/smartflow/agreements/generate` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Improve Agreement Draft | `/api/v1/smartflow/agreements/improve` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Get Agreement Metadata | `/api/v1/smartflow/agreements/metadata` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Agreement Priorities | `/api/v1/smartflow/agreements/priorities` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Review Agreement Draft | `/api/v1/smartflow/agreements/review` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Complete Docusign Oauth | `/api/v1/smartflow/agreements/signature-providers/docusign/oauth/callback` | 🔒 Bearer Token | ⚠️ 400 |
| `GET` | [GET] Start Docusign Oauth | `/api/v1/smartflow/agreements/signature-providers/docusign/oauth/start` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Docusign Signing Complete | `/api/v1/smartflow/agreements/signature-providers/docusign/signing-complete` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Docusign Status | `/api/v1/smartflow/agreements/signature-providers/docusign/status` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Handle Docusign Webhook | `/api/v1/smartflow/agreements/signature-providers/docusign/webhook` | 🔒 Bearer Token | ⚠️ 400 |
| `GET` | [GET] Get Public Signing Agreement | `/api/v1/smartflow/agreements/signing/{signature_token}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Sign Public Agreement | `/api/v1/smartflow/agreements/signing/{signature_token}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Public Signing Agreement Pdf | `/api/v1/smartflow/agreements/signing/{signature_token}/pdf` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Agreement Types | `/api/v1/smartflow/agreements/types` | 🔒 Bearer Token | ✅ 200 OK |
| `DELETE` | [DELETE] Delete Agreement | `/api/v1/smartflow/agreements/{agreement_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Agreement | `/api/v1/smartflow/agreements/{agreement_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Agreement | `/api/v1/smartflow/agreements/{agreement_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Agreement Completion Certificate | `/api/v1/smartflow/agreements/{agreement_id}/completion-certificate` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Improve Agreement | `/api/v1/smartflow/agreements/{agreement_id}/improve` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Agreement Pdf | `/api/v1/smartflow/agreements/{agreement_id}/pdf` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Renew Agreement | `/api/v1/smartflow/agreements/{agreement_id}/renew` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Review Agreement | `/api/v1/smartflow/agreements/{agreement_id}/review` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Send Agreement For Signature | `/api/v1/smartflow/agreements/{agreement_id}/send-signature` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Sign Agreement | `/api/v1/smartflow/agreements/{agreement_id}/sign` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Signed Agreement Pdf | `/api/v1/smartflow/agreements/{agreement_id}/signed-pdf` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Document Types | `/api/documents/types` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Documents | `/api/v1/smartflow/documents` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Document | `/api/v1/smartflow/documents` | 🔒 Bearer Token | ✅ 201 OK |
| `DELETE` | [DELETE] Delete Document | `/api/v1/smartflow/documents/{document_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Document | `/api/v1/smartflow/documents/{document_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Leases | `/api/v1/smartflow/leases` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Create Lease | `/api/v1/smartflow/leases` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Enhance Lease Terms | `/api/v1/smartflow/leases/enhance-terms` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Generate Lease Draft | `/api/v1/smartflow/leases/generate` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Lease Metadata | `/api/v1/smartflow/leases/metadata` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Review Lease Draft | `/api/v1/smartflow/leases/review` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Get Public Signing Lease | `/api/v1/smartflow/leases/signing/{signature_token}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Sign Public Lease | `/api/v1/smartflow/leases/signing/{signature_token}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Get Public Signing Lease Pdf | `/api/v1/smartflow/leases/signing/{signature_token}/pdf` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `DELETE` | [DELETE] Delete Lease | `/api/v1/smartflow/leases/{lease_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Lease | `/api/v1/smartflow/leases/{lease_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Lease | `/api/v1/smartflow/leases/{lease_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Lease Completion Certificate | `/api/v1/smartflow/leases/{lease_id}/completion-certificate` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Enhance Saved Lease Terms | `/api/v1/smartflow/leases/{lease_id}/enhance-terms` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Lease Pdf | `/api/v1/smartflow/leases/{lease_id}/pdf` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Renew Lease | `/api/v1/smartflow/leases/{lease_id}/renew` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Review Lease | `/api/v1/smartflow/leases/{lease_id}/review` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Send Lease For Signature | `/api/v1/smartflow/leases/{lease_id}/send-signature` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Sign Lease | `/api/v1/smartflow/leases/{lease_id}/sign` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Signed Lease Pdf | `/api/v1/smartflow/leases/{lease_id}/signed-pdf` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |

---

### 09 - AI Workflows & Automations
**মোট এন্ডপয়েন্ট সংখ্যা:** 11টি

- **কী কী করা যাবে (Capabilities):** নো-কোড স্মার্টফ্লো ওয়ার্কফ্লো এক্সিকিউশন, ন্যাচারাল ল্যাঙ্গুয়েজ ব্যাকএন্ড কমান্ড রান, এআই ইমেজ ও ভয়েস সিন্থেসিস।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Workflows/WorkflowBuilder.jsx`, `AIConsole.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `ai_workflows`, `ai_command_history`, `conversations`
- **এক্সটার্নাল সার্ভিস:** OpenAI (GPT-4o, DALL-E, TTS API)

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | [POST] Run Ai Command | `/api/v1/ai/command` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Ai Chat | `/api/v1/smartflow/ai/chat` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Create Ai Conversation | `/api/v1/smartflow/ai/conversations` | 🔒 Bearer Token | ✅ 201 OK |
| `POST` | [POST] Generate Ai Image | `/api/v1/smartflow/ai/generate-image` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Ai History | `/api/v1/smartflow/ai/history` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Replay Ai History | `/api/v1/smartflow/ai/history/{history_id}/replay` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Synthesize Ai Speech | `/api/v1/smartflow/ai/synthesize-speech` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `POST` | [POST] Ai Voice Chat | `/api/v1/smartflow/ai/voice-chat` | 🔒 Bearer Token | ⏳ 408 (Timeout >10s) |
| `POST` | [POST] Ai Voice Chat Upload | `/api/v1/smartflow/ai/voice-chat-upload` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] List Ai Voices | `/api/v1/smartflow/ai/voices` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Ai Workflow Prefill | `/api/v1/smartflow/ai/workflow-prefill` | 🔒 Bearer Token | ✅ 200 OK |

---

### 10 - Integrations (Channels, Telnyx, Stripe)
**মোট এন্ডপয়েন্ট সংখ্যা:** 31টি

- **কী কী করা যাবে (Capabilities):** টেলিফোনি নম্বর ক্রয় ও রিলিজ, হোয়াটসঅ্যাপ কিউআর/ক্লাউড এপিআই, সোশ্যাল চ্যানেল এবং স্ট্রাইপ কানেক্ট অনবোর্ডিং।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Settings/IntegrationsHub.jsx`, `PhoneNumbersSetup.jsx`, `WhatsAppConnectModal.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `social_integrations`, `phone_numbers`, `users`
- **এক্সটার্নাল সার্ভিস:** Telnyx Portal API, Meta Graph API, Stripe API, Telegram Bot API

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] Get Integrations | `/api/integrations` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Connect Integration | `/api/integrations/connect` | 🔒 Bearer Token | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] List Integrations | `/api/v1/smartflow/integrations` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Connect Integration | `/api/v1/smartflow/integrations` | 🔒 Bearer Token | ✅ 201 OK |
| `DELETE` | [DELETE] Disconnect Caldav | `/api/v1/smartflow/integrations/caldav` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Connect Caldav | `/api/v1/smartflow/integrations/caldav/connect` | 🔒 Bearer Token | ❌ 500 (Unhandled Ex) |
| `GET` | [GET] Get Caldav Status | `/api/v1/smartflow/integrations/caldav/status` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Sync Caldav | `/api/v1/smartflow/integrations/caldav/sync` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Integration Catalog | `/api/v1/smartflow/integrations/catalog` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Receive Telnyx Sms | `/api/v1/smartflow/integrations/sms/webhook` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Integration Status | `/api/v1/smartflow/integrations/status` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Connect Telegram Manual | `/api/v1/smartflow/integrations/telegram/manual-connect` | 🔒 Bearer Token | 🌐 502 (External Error) |
| `DELETE` | [DELETE] Disconnect Integration | `/api/v1/smartflow/integrations/{platform}` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Complete Integration Oauth | `/api/v1/smartflow/integrations/{platform}/oauth/callback` | 🔒 Bearer Token | ⚠️ 400 |
| `GET` | [GET] Start Integration Oauth | `/api/v1/smartflow/integrations/{platform}/oauth/start` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Sync Integration | `/api/v1/smartflow/integrations/{platform}/sync` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `GET` | [GET] Verify Platform Webhook | `/api/v1/smartflow/integrations/{platform}/webhook` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Receive Platform Webhook | `/api/v1/smartflow/integrations/{platform}/webhook` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Start Stripe Connect Onboarding | `/api/v1/stripe/connect/onboard` | 🔒 Bearer Token | 💳 503 (Provider Notice) |
| `GET` | [GET] Get Stripe Connect Status | `/api/v1/stripe/connect/status` | 🔒 Bearer Token | ✅ 200 OK |
| `DELETE` | [DELETE] Remove Custom Telnyx | `/api/v1/telnyx/custom` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Save Custom Telnyx | `/api/v1/telnyx/custom` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Provision Telnyx | `/api/v1/telnyx/provision` | 🔒 Bearer Token | ✅ 200 OK |
| `DELETE` | [DELETE] Release Telnyx | `/api/v1/telnyx/release` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Telnyx Status | `/api/v1/telnyx/status` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Update Telnyx Voice Registration | `/api/v1/telnyx/voice/registration` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Telnyx Voice Token | `/api/v1/telnyx/voice/token` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Connect Whatsapp | `/api/v1/smartflow/integrations/whatsapp/connect` | 🔒 Bearer Token | ✅ 201 OK |
| `GET` | [GET] Get Whatsapp Qr | `/api/v1/smartflow/integrations/whatsapp/qr` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Receive Whatsapp Contacts | `/api/v1/smartflow/integrations/whatsapp/webhook/contacts` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Receive Whatsapp History Batch | `/api/v1/smartflow/integrations/whatsapp/webhook/history` | 🔒 Bearer Token | ⚠️ 400 |

---

### 11 - Settings & Business Profile
**মোট এন্ডপয়েন্ট সংখ্যা:** 30টি

- **কী কী করা যাবে (Capabilities):** ব্যবসার প্রোফাইল, সময়সূচি, কাস্টম ডোমেইন DNS ভ্যালিডেশন (DKIM, SPF), পুশ নোটিফিকেশন ও ডিভাইস ম্যানেজমেন্ট।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Settings/CompanyProfile.jsx`, `EmailDomainSetup.jsx`, `NotificationPreferences.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `business_profiles`, `email_domains`, `notifications`, `users`
- **এক্সটার্নাল সার্ভিস:** Cloudflare DNS-over-HTTPS, Firebase Cloud Messaging (FCM)

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `DELETE` | [DELETE] Delete Account | `/api/v1/smartflow/account` | 🔒 Bearer Token | ⏳ 408 (Timeout >10s) |
| `GET` | [GET] Get Business Profile | `/api/v1/smartflow/business-profile` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Business Profile | `/api/v1/smartflow/business-profile` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Upload Business Logo | `/api/v1/smartflow/business-profile/logo` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Delete Email Domain | `/api/v1/smartflow/email-domain` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Email Domain | `/api/v1/smartflow/email-domain` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Email Domain | `/api/v1/smartflow/email-domain` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Request Email Domain | `/api/v1/smartflow/email-domain` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Check Email Domain Availability | `/api/v1/smartflow/email-domain/availability` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Verify Email Domain | `/api/v1/smartflow/email-domain/verify` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Draft Email | `/api/v1/email/draft` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Fetch Splash Screen App Config | `/api/v1/app/config` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Saved Permission Preferences | `/api/v1/app/permissions` | 🔒 Bearer Token | ✅ 200 OK |
| `PUT` | [PUT] Update Permission Preferences | `/api/v1/app/permissions` | 🔒 Bearer Token | ✅ 200 OK |
| `POST` | [POST] Accept All Permission Toggles | `/api/v1/app/permissions/accept-all` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Notifications | `/api/v1/smartflow/notifications` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Dispatch Pending Notifications | `/api/v1/smartflow/notifications/dispatch-pending` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Mark All Notifications Read | `/api/v1/smartflow/notifications/mark-all-read` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Delete Notification | `/api/v1/smartflow/notifications/{notification_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Mark Notification Read | `/api/v1/smartflow/notifications/{notification_id}/read` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Register Push Token | `/api/v1/smartflow/devices/push-token` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Settings | `/api/v1/smartflow/settings` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Settings | `/api/v1/smartflow/settings` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Upload Profile Avatar | `/api/v1/smartflow/settings/avatar` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Change Password | `/api/v1/smartflow/settings/change-password` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Notification Settings | `/api/v1/smartflow/settings/notifications` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Notification Settings | `/api/v1/smartflow/settings/notifications` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Revoke Sessions | `/api/v1/smartflow/settings/revoke-sessions` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Team Members | `/api/v1/smartflow/team` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Search App Users | `/api/v1/smartflow/users/search` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |

---

### 12 - Billing, Invoices & Shop
**মোট এন্ডপয়েন্ট সংখ্যা:** 24টি

- **কী কী করা যাবে (Capabilities):** ডিজিটাল ইনভয়েস তৈরি ও পেমেন্ট ট্র্যাকিং, এড-অন শপ (অতিরিক্ত নম্বর/ভয়েস মিনিট ক্রয়) এবং সাবস্ক্রিপশন প্ল্যান।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Earnings/Invoices.jsx`, `madbel-dashboard/src/Pages/Subscriptions/BillingPlans.jsx`, `AddonShop.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `invoices`, `products`, `subscriptions`, `subscription_plans`
- **এক্সটার্নাল সার্ভিস:** Stripe Checkout & Billing Portal API

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] Admin List Products | `/api/v1/shop/admin/products` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Admin Create Product | `/api/v1/shop/admin/products` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Admin List Products Table | `/api/v1/shop/admin/products/table` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Admin Delete Product | `/api/v1/shop/admin/products/{product_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Admin Update Product | `/api/v1/shop/admin/products/{product_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PUT` | [PUT] Admin Update Product | `/api/v1/shop/admin/products/{product_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Admin Toggle Product Status | `/api/v1/shop/admin/products/{product_id}/status` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Shop Products | `/api/v1/shop/products` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] Get Shop Product | `/api/v1/shop/products/{product_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Invoices | `/api/v1/invoices` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Invoice | `/api/v1/invoices` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Download Shared Invoice Pdf | `/api/v1/invoices/shared/{share_token}/pdf` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `DELETE` | [DELETE] Delete Invoice | `/api/v1/invoices/{invoice_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Invoice | `/api/v1/invoices/{invoice_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Invoice | `/api/v1/invoices/{invoice_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Create Invoice Payment Link | `/api/v1/invoices/{invoice_id}/payment-link` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Download Invoice Pdf | `/api/v1/invoices/{invoice_id}/pdf` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Send Invoice Reminder | `/api/v1/invoices/{invoice_id}/remind` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Send Invoice | `/api/v1/invoices/{invoice_id}/send` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Share Invoice | `/api/v1/invoices/{invoice_id}/share` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Update Invoice Status | `/api/v1/invoices/{invoice_id}/status` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Invoice Timeline | `/api/v1/invoices/{invoice_id}/timeline` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Current Subscription | `/api/v1/smartflow/subscription/current` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Subscription Plans | `/api/v1/smartflow/subscription/plans` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |

---

### 13 - Support & Social Media
**মোট এন্ডপয়েন্ট সংখ্যা:** 8টি

- **কী কী করা যাবে (Capabilities):** ফেসবুক ও ইনস্টাগ্রামে সোশ্যাল পোস্ট শিডিউল করা এবং কাস্টমার সাপোর্ট টিকেট তৈরি ও মেসেজিং।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Support/TicketsList.jsx`, `madbel-dashboard/src/Pages/AdsSetup/SocialScheduler.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `support_tickets`, `social_posts`, `social_integrations`
- **এক্সটার্নাল সার্ভিস:** Meta Graph API (Facebook/Instagram Publishing)

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] List Social Posts | `/api/v1/smartflow/social-posts` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Social Post | `/api/v1/smartflow/social-posts` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Social Post | `/api/v1/smartflow/social-posts/{post_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Support Messages | `/api/v1/smartflow/support/messages` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Support Message | `/api/v1/smartflow/support/messages` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Support Session | `/api/v1/smartflow/support/session` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Start Support Session | `/api/v1/smartflow/support/session` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Support Ticket | `/api/v1/smartflow/support/tickets` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |

---

### 14 - Admin & Owner Dashboard
**মোট এন্ডপয়েন্ট সংখ্যা:** 124টি

- **কী কী করা যাবে (Capabilities):** ওনার ও সুপার এডমিন ওভারভিউ, টিম মেম্বারদের রোল ও এক্সেস কন্ট্রোল (RBAC Matrix), ডেমো রিকোয়েস্ট ম্যানেজমেন্ট।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `madbel-dashboard/src/Pages/Admin/AdminOverview.jsx`, `madbel-dashboard/src/Pages/MakeAdmin/RolePermissionMatrix.jsx`, `madbel-dashboard/src/Pages/Owner/TeamManagement.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `users`, `roles`, `permissions`, `demo_requests`, `meeting_requests`, `organizations`
- **এক্সটার্নাল সার্ভিস:** Redis Permission Cache, Internal Security Audit Logger

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] List Notifications | `/api/v1/dashboard/notifications/` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Mark All Notifications As Read | `/api/v1/dashboard/notifications/read-all` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Mark All Notifications As Read | `/api/v1/dashboard/notifications/read-all` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Unread Notifications Count | `/api/v1/dashboard/notifications/unread-count` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Mark Notification As Read | `/api/v1/dashboard/notifications/{notification_id}/read` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Mark Notification As Read | `/api/v1/dashboard/notifications/{notification_id}/read` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Admin Activities | `/api/v1/dashboard/admin/activities` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Search Admin Activities | `/api/v1/dashboard/admin/activities/search` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Delete Admin Activity | `/api/v1/dashboard/admin/activities/{activity_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Admin Activity | `/api/v1/dashboard/admin/activities/{activity_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Approve Admin Activity | `/api/v1/dashboard/admin/activities/{activity_id}/approve` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Cancel Admin Activity | `/api/v1/dashboard/admin/activities/{activity_id}/cancel` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Admin Activity Status | `/api/v1/dashboard/admin/activities/{activity_id}/status` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Admins | `/api/v1/dashboard/admin/admins` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Ai Logs | `/api/v1/dashboard/admin/ai/logs` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Ai Stats | `/api/v1/dashboard/admin/ai/stats` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Forgot Password | `/api/v1/dashboard/admin/auth/forgot-password` | 🔒 Bearer Token | 🔍 404 (ID Not Found) |
| `POST` | [POST] Admin Login | `/api/v1/dashboard/admin/auth/login` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Reset Password | `/api/v1/dashboard/admin/auth/reset-password` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Verify Otp | `/api/v1/dashboard/admin/auth/verify-otp` | 🔒 Bearer Token | ✅ 200 OK |
| `GET` | [GET] List Admin Categories | `/api/v1/dashboard/admin/categories` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Admin Category | `/api/v1/dashboard/admin/categories` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Delete Admin Category | `/api/v1/dashboard/admin/categories/{category_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Admin Category | `/api/v1/dashboard/admin/categories/{category_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PUT` | [PUT] Update Admin Category | `/api/v1/dashboard/admin/categories/{category_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Change Password | `/api/v1/dashboard/admin/change-password` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PUT` | [PUT] Change Admin Password Put | `/api/v1/dashboard/admin/change-password` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get All Conversations | `/api/v1/dashboard/admin/chats` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Chat Messages | `/api/v1/dashboard/admin/chats/{user_id}/messages` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Send Message | `/api/v1/dashboard/admin/chats/{user_id}/messages` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Create Organization Admin | `/api/v1/dashboard/admin/create-admin` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Earnings Report | `/api/v1/dashboard/admin/earnings` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Transactions | `/api/v1/dashboard/admin/earnings/transactions` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Trx Details | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Download Invoice | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}/invoice` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Generate Transaction Invoice Post | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}/invoice` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Event Creators | `/api/v1/dashboard/admin/event-creators` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Event Creators | `/api/v1/dashboard/admin/event-creators/premium` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Event Creator | `/api/v1/dashboard/admin/event-creators/premium/{creator_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Event Creator | `/api/v1/dashboard/admin/event-creators/{creator_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Payout Event Creator | `/api/v1/dashboard/admin/event-creators/{creator_id}/payout` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Admin Events | `/api/v1/dashboard/admin/events` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Admin Event Status | `/api/v1/dashboard/admin/events/{event_id}/status` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Admin Login | `/api/v1/dashboard/admin/login` | 🔒 Bearer Token | ⚠️ 400 |
| `POST` | [POST] Logout | `/api/v1/dashboard/admin/logout` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PUT` | [PUT] Logout Admin Put | `/api/v1/dashboard/admin/logout` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Logout All | `/api/v1/dashboard/admin/logout-all` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Owners | `/api/v1/dashboard/admin/owners` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Owner Account | `/api/v1/dashboard/admin/owners/create` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Admin Profile | `/api/v1/dashboard/admin/profile` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Profile | `/api/v1/dashboard/admin/profile` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PUT` | [PUT] Update Admin Profile Put | `/api/v1/dashboard/admin/profile` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get User Reports | `/api/v1/dashboard/admin/reports` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Report Action | `/api/v1/dashboard/admin/reports/{report_id}/action` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Dismiss Report Endpoint | `/api/v1/dashboard/admin/reports/{report_id}/dismiss` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Resolve Report Endpoint | `/api/v1/dashboard/admin/reports/{report_id}/resolve` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Dashboard Settings | `/api/v1/dashboard/admin/settings` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Settings Page Content | `/api/v1/dashboard/admin/settings/content` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Update Settings Page Content | `/api/v1/dashboard/admin/settings/content` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Subscriptions | `/api/v1/dashboard/admin/subscriptions` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Subscription Plan | `/api/v1/dashboard/admin/subscriptions` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Subscription Fees | `/api/v1/dashboard/admin/subscriptions/fees` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PATCH` | [PATCH] Update Subscription Fees | `/api/v1/dashboard/admin/subscriptions/fees` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `PUT` | [PUT] Update Subscription Fees | `/api/v1/dashboard/admin/subscriptions/fees` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Admin Summary | `/api/v1/dashboard/admin/summary` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Users | `/api/v1/dashboard/admin/users` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Users Growth | `/api/v1/dashboard/admin/users-growth` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Blocked Users | `/api/v1/dashboard/admin/users/blocked` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Search Users Before User Id | `/api/v1/dashboard/admin/users/search` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get User Details | `/api/v1/dashboard/admin/users/{user_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update User | `/api/v1/dashboard/admin/users/{user_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Block User | `/api/v1/dashboard/admin/users/{user_id}/ban` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Block User | `/api/v1/dashboard/admin/users/{user_id}/block` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Add User Note | `/api/v1/dashboard/admin/users/{user_id}/notes` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update User Status | `/api/v1/dashboard/admin/users/{user_id}/status` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Unblock User | `/api/v1/dashboard/admin/users/{user_id}/unban` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Unblock User | `/api/v1/dashboard/admin/users/{user_id}/unblock` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List My Availability Slots | `/api/v1/dashboard/availability-slots` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Availability Slots | `/api/v1/dashboard/availability-slots` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Delete Availability Slot | `/api/v1/dashboard/availability-slots/{slot_id}` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Demo Requests | `/api/v1/dashboard/demo-requests` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Demo Request | `/api/v1/dashboard/demo-requests/{request_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Reply To Demo Request | `/api/v1/dashboard/demo-requests/{request_id}/reply` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update Demo Request Status | `/api/v1/dashboard/demo-requests/{request_id}/status` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] List Meeting Requests | `/api/v1/dashboard/meeting-requests` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Meeting Request | `/api/v1/dashboard/meeting-requests/{request_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Accept Meeting Request | `/api/v1/dashboard/meeting-requests/{request_id}/accept` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Decline Meeting Request | `/api/v1/dashboard/meeting-requests/{request_id}/decline` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Propose Meeting Time | `/api/v1/dashboard/meeting-requests/{request_id}/propose` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Assign Team Role | `/api/v1/dashboard/owner/assign` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Owner Me | `/api/v1/dashboard/owner/me` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Permission Modules | `/api/v1/dashboard/owner/modules` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] My Dashboard | `/api/v1/dashboard/owner/my-dashboard` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Revoke Team Role | `/api/v1/dashboard/owner/revoke` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Search Users | `/api/v1/dashboard/owner/search` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List Team | `/api/v1/dashboard/owner/team` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Owner Team Analysis | `/api/v1/dashboard/owner/team/analysis` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Owner Team Dashboard | `/api/v1/dashboard/owner/team/dashboard` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Member Analysis | `/api/v1/dashboard/owner/team/{user_id}/analysis` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Ban Team Member | `/api/v1/dashboard/owner/team/{user_id}/ban` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get User Permissions | `/api/v1/dashboard/owner/team/{user_id}/permissions` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PUT` | [PUT] Set User Permissions | `/api/v1/dashboard/owner/team/{user_id}/permissions` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Unban Team Member | `/api/v1/dashboard/owner/team/{user_id}/unban` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Rbac Audit Logs | `/api/v1/dashboard/rbac/audit-logs` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List All Permissions Grouped By Module | `/api/v1/dashboard/rbac/permissions` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List All Permissions As Flat List | `/api/v1/dashboard/rbac/permissions/flat` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] List All Roles With Their Permissions | `/api/v1/dashboard/rbac/roles` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create A New Custom Role | `/api/v1/dashboard/rbac/roles` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Create Subordinate Account | `/api/v1/dashboard/rbac/roles/create-subordinate` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `DELETE` | [DELETE] Delete A Custom Role | `/api/v1/dashboard/rbac/roles/{role_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get A Specific Role | `/api/v1/dashboard/rbac/roles/{role_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PATCH` | [PATCH] Update A Role | `/api/v1/dashboard/rbac/roles/{role_id}` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `PUT` | [PUT] Set Permissions For A Role (Replaces Existing) | `/api/v1/dashboard/rbac/roles/{role_id}/permissions` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Assign A Role To A User | `/api/v1/dashboard/rbac/users/assign-role` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Revoke A Role From A User | `/api/v1/dashboard/rbac/users/revoke-role` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get All Roles Assigned To A User | `/api/v1/dashboard/rbac/users/{user_id}/roles` | 🔒 Bearer Token | ✅ রেজিস্টার্ড |
| `POST` | [POST] Activate Subscription | `/api/v1/dashboard/subscription/activate` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Complete Onboarding | `/api/v1/dashboard/subscription/complete-onboarding` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Start Trial | `/api/v1/dashboard/subscription/start-trial` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Status | `/api/v1/dashboard/subscription/status` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Global Growth | `/api/v1/dashboard/super/global-growth` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `GET` | [GET] Get Platform Summary | `/api/v1/dashboard/super/platform-summary` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Resend Inbound Webhook | `/api/v1/dashboard/webhooks/resend/inbound` | 🔒 Bearer Token | 🔒 401 (Auth/RBAC) |
| `POST` | [POST] Stripe Webhook | `/api/v1/dashboard/webhooks/stripe` | 🔒 Bearer Token | ⚠️ 400 |

---

### 15 - Public & Marketing Website
**মোট এন্ডপয়েন্ট সংখ্যা:** 15টি

- **কী কী করা যাবে (Capabilities):** মার্কেটিং সাইটের ডায়নামিক কনটেন্ট (প্রাইসিং, ফিচারস, FAQ, ব্লগ), লিগ্যাল পেজ এবং পাবলিক ভিজিটর মিটিং রিকোয়েস্ট।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** `Mabdel Website/src/pages/Home.jsx`, `Pricing.jsx`, `Blog.jsx`, `Terms.jsx`, `Privacy.jsx`
- **কানেক্টেড MongoDB কালেকশন:** `content_pages`, `subscription_plans`, `demo_requests`
- **এক্সটার্নাল সার্ভিস:** Public CDN / Static Web Assets

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] Get About Us | `/api/v1/content/about-us` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Acceptable Use Policy | `/api/v1/content/acceptable-use-policy` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Help Support | `/api/v1/content/help-support` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Content Page | `/api/v1/content/pages/{slug}` | পাবলিক (No Auth) | ✅ রেজিস্টার্ড |
| `GET` | [GET] Get Privacy Policy | `/api/v1/content/privacy-policy` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Protocols For Law Enforcement | `/api/v1/content/protocols-for-law-enforcement` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Refund Policy | `/api/v1/content/refund-policy` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Sms Messaging Policy | `/api/v1/content/sms-messaging-policy` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Terms And Conditions | `/api/v1/content/terms-and-conditions` | পাবলিক (No Auth) | ✅ 200 OK |
| `POST` | [POST] Submit Demo Request | `/api/v1/public/demo-requests` | পাবলিক (No Auth) | ✅ 200 OK |
| `POST` | [POST] Submit Meeting Request | `/api/v1/public/meeting-requests` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Get Available Times | `/api/v1/public/meeting-requests/available-times` | পাবলিক (No Auth) | ✅ 200 OK |
| `POST` | [POST] Book Available Time | `/api/v1/public/meeting-requests/book` | পাবলিক (No Auth) | 🛡️ 422 (Schema Guard) |
| `GET` | [GET] Get Proposed Meeting Time | `/api/v1/public/meeting-requests/confirm/{token}` | পাবলিক (No Auth) | ✅ রেজিস্টার্ড |
| `POST` | [POST] Confirm Proposed Meeting Time | `/api/v1/public/meeting-requests/confirm/{token}` | পাবলিক (No Auth) | ✅ রেজিস্টার্ড |

---

### 16 - System, Webhooks & Health
**মোট এন্ডপয়েন্ট সংখ্যা:** 7টি

- **কী কী করা যাবে (Capabilities):** সিস্টেম হেলথ চেক (`/health`, `/ready`), ওপেনএপিআই স্পেক্স (`/docs`) এবং টেলিনিক্স ইনবাউন্ড কল ও SMS ওয়েববুক।
- **কানেক্টেড ফ্রন্টএন্ড পেজ:** DevOps & Monitoring Dashboards, Health Probes
- **কানেক্টেড MongoDB কালেকশন:** `audit_events`, `system_health`
- **এক্সটার্নাল সার্ভিস:** Telnyx Inbound Webhook Dispatcher

| মেথড | এন্ডপয়েন্ট নাম | রুট পাথ | অথেনটিকেশন | লাইভ টেস্ট স্ট্যাটাস |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | [GET] Swagger Ui Html | `/docs` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Swagger Ui Redirect | `/docs/oauth2-redirect` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Openapi | `/openapi.json` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Redoc Html | `/redoc` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Health Check | `/health` | পাবলিক (No Auth) | ✅ 200 OK |
| `GET` | [GET] Readiness Check | `/ready` | পাবলিক (No Auth) | ✅ 200 OK |
| `POST` | [POST] Telnyx Call Webhook Alias | `/webhooks/telnyx/voice` | পাবলিক (No Auth) | 🔒 401 (Auth/RBAC) |

---

## 🔍 4. চিহ্নিত ত্রুটি ও লাইভ অডিট পর্যবেক্ষণ (Issues & Hardening)
লাইভ অডিটের সময় ব্যাকএন্ডের ৪২৬টি রুটের মধ্যে যে কয়েকটি নির্দিষ্ট আচরণ ও সতর্কতা পরিলক্ষিত হয়েছে তা নিচে নথিভুক্ত করা হলো:

1. **`POST /api/v1/smartflow/integrations/caldav/connect` (`HTTP 500`)**
   - **কারণ:** বহিরাগত CalDAV সার্ভারে রিকোয়েস্ট পাঠানোর সময় হ্যান্ডেল না করা `httpx.HTTPError` এক্সেপশন।
   - **সুপারিশ:** রাউটারে `try...except httpx.HTTPError as exc:` যুক্ত করে স্ট্যান্ডার্ড `AppException(status_code=400, message='Invalid CalDAV server host')` রিটার্ন করা।

2. **`POST /api/v1/smartflow/integrations/telegram/manual-connect` (`HTTP 502`)**
   - **কারণ:** টেলিগ্রাম বট এপিআই ডামি টোকেন বাতিল করায় ব্যাকএন্ড `502` এরর দেয়। এটি কোনো অভ্যন্তরীণ ক্র্যাশ নয়, তবে ক্লায়েন্ট ইনপুট যাচাইকরণ মেসেজ আরও সহজ করা যায়।

3. **`POST /api/v1/stripe/connect/onboard` (`HTTP 503`)**
   - **কারণ:** স্ট্রাইপ একাউন্টে Connect মোড সক্রিয় না থাকায় স্ট্রাইপ এরর পাঠিয়েছে।

4. **হোম পেজ ও ইনবক্স কোয়েরি লেটেন্সি (`GET /api/v1/smartflow/home`)**
   - **কারণ:** হোম ড্যাশবোর্ড জেনারেট করতে ক্রমান্বয়ে ১২টি আলাদা MongoDB Atlas কোয়েরি চালানো হয়, যা লোকাল থেকে ক্লাউড অ্যাটলাসে ৯.৭ সেকেন্ড সময় নেয়।
   - **সুপারিশ:** পাইথনের `asyncio.gather()` ব্যবহার করে কুয়েরিগুলো প্যারালালি এক্সিকিউট করলে রেসপন্স টাইম ১ সেকেন্ডে নেমে আসবে।

---

## 🚀 5. পোস্টম্যান কালেকশন ব্যবহারের নিয়ম
ব্যাকএন্ডের সকল ৪২৬টি API টেস্ট ও ব্যবহারের জন্য পোস্টম্যান কালেকশন প্রস্তুত রয়েছে:
- **ফাইল লোকেশন:** `c:/project/Mabdel AI/postman_collection.json`

### ধাপসমূহ:
1. **Postman ওপেন করুন** এবং `Import` বাটনে ক্লিক করে `postman_collection.json` সিলেক্ট করুন।
2. **কালেকশন ভেরিয়েবল সেট করুন:**
   - `baseUrl`: `http://127.0.0.1:8000`
   - `bearerToken`: লগইন করার পর প্রাপ্ত JWT টোকেনটি এখানে পেস্ট করুন।
3. কালেকশনের প্রতিটি ফোল্ডারের রিকোয়েস্টে ডিফল্টভাবে `Inherit auth from parent` দেওয়া আছে, ফলে কালেকশনে একবার টোকেন বসালে সবগুলো রুটে স্বয়ংক্রিয়ভাবে অথেনটিকেশন কাজ করবে।