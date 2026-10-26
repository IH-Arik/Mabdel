# 📊 GoCustify / Mabdel AI — পেজ-ভিত্তিক পূর্ণাঙ্গ গ্যাপ অ্যানালাইসিস ও সিস্টেম আর্কিটেকচার রিপোর্ট

> **ডকুমেন্ট তৈরির তারিখ:** 2026-09-29  
> **কভারেজ:** Mabdel Website (২৮টি পেজ), madbel-dashboard (অপারেশনাল অ্যাপ) এবং Mabdel Backend (৪২৬টি এন্ডপয়েন্ট)  
> **উদ্দেশ্য:** ওয়েবসাইটে কী কী ফিল্ড রয়েছে, ব্যাকএন্ডে কী কী বানানো আছে বনাম কী কী বানানো নেই, কী কী অলরেডি ইন্টিগ্রেটেড বনাম আন-ইন্টিগ্রেটেড, এবং ব্যাকএন্ডে আছে কিন্তু ফ্রন্টএন্ডে নেই—তার একটি পরিপূর্ণ পেজ-বাই-পেজ অডিট।

---

## 📑 সূচিপত্র (Table of Contents)
1. [এক নজরে হাই-লেভেল ম্যাট্রিক্স (Executive Matrix)](#1-এক-নজরে-হাই-লেভেল-ম্যাট্রিক্স)
2. [২৮টি পেজের বিস্তারিত পেজ-বাই-পেজ অডিট (Page-by-Page Audit)](#2-২৮টি-পেজের-বিস্তারিত-পেজ-বাই-পেজ-অডিট)
   - Landing (`/`)
   - Login & Register (`/login`)
   - Onboarding (`/onboarding`)
   - Subscription (`/subscription`)
   - Dashboard (`/dashboard`)
   - Conversations & Messages (`/conversations`)
   - Unified Conversations (`/unified-conversation`)
   - Calls & Voice AI (`/calls`, `/ai-call`, `/voice-conversation`)
   - Contacts (`/contacts`)
   - Groups (`/groups`)
   - Calendar (`/calendar`)
   - Confirm Meeting (`/confirm-meeting/:token`)
   - Bulk Messaging (`/bulk-messaging`)
   - Documents & Contracts (`/documents`)
   - Sign Document (`/sign/:docType/:token`)
   - AI Workflow (`/ai-workflow`)
   - Integrations Hub (`/integrations`)
   - Invoices (`/invoices`)
   - Shop & Add-ons (`/shop`)
   - Create Post / Social Media (`/create-post`)
   - Activities & Events (`/activities`, `/join-event`)
   - Notifications (`/notifications`)
   - Admin Panel (`/admin`)
   - Profile & Security (`/profile`)
   - Public Legal & Content Pages (`/terms-and-conditions`, etc.)
3. [ব্যাকএন্ডে আছে কিন্তু ফ্রন্টএন্ডে নেই এমন ৪৬টি এন্ডপয়েন্ট (Backend Only Features)](#3-ব্যাকএন্ডে-আছে-কিন্তু-ফ্রন্টএন্ডে-নেই-এমন-৪৬টি-এন্ডপয়েন্ট)
4. [থার্ড-পার্টি ইন্টিগ্রেশন স্ট্যাটাস অডিট (Third-Party Integrations)](#4-থার্ড-পার্টি-ইন্টিগ্রেশন-স্ট্যাটাস-অডিট)
5. [ভবিষ্যত ডেভেলপমেন্ট ও অ্যাকশন প্ল্যান (Punchlist Recommendations)](#5-ভবিষ্যত-ডেভেলপমেন্ট-ও-অ্যাকশন-প্ল্যান)

---

## 📊 1. এক নজরে হাই-লেভেল ম্যাট্রিক্স (Executive Matrix)

| মেট্রিক্স ক্যাটাগরি | মোট সংখ্যা | স্ট্যাটাস ও বিবরণ |
| :--- | :---: | :--- |
| **ওয়েবসাইট পেজ সংখ্যা** | **২৮টি** | Next.js / React অ্যাপে ২৮টি ডেডিকেটেড রুট ও পেজ কম্পোনেন্ট রয়েছে। |
| **ব্যাকএন্ড এন্ডপয়েন্ট সংখ্যা** | **৪২৬টি** | FastAPI-তে ১৬টি মডিউলের অধীনে রেজিস্টার্ড মোট এন্ডপয়েন্ট। |
| **ফ্রন্টএন্ডের সাথে যুক্ত ব্যাকএন্ড এন্ডপয়েন্ট** | **৩৮০টি** | প্রত্যক্ষ বা পরোক্ষভাবে ফ্রন্টএন্ডের UI বা সার্ভিস কল দ্বারা ব্যবহৃত। |
| **ব্যাকএন্ড আছে কিন্তু ফ্রন্টএন্ড নাই (Orphaned)** | **৪৬টি** | ব্যাকএন্ড তৈরি কিন্তু ফ্রন্টএন্ডে বাটন/স্ক্রিন নেই (যেমন: শপ এডমিন, মোবাইল স্লাইডস)। |
| **লাইভ ৩য়-পক্ষ ইন্টিগ্রেশন** | **৭টি** | Telnyx, OpenAI Realtime, Stripe, Meta WhatsApp, Google, Resend, Telegram। |
| **পূর্ণাঙ্গ কার্যকর ইন্টিগ্রেশন রেট** | **~৮৮%** | মূল বিজনেস ফ্লো (কল, মেসেজ, কন্ট্যাক্ট, ইনভয়েস, ই-সাইন) সম্পূর্ণ সচল। |

---

## 🔍 2. ২৮টি পেজের বিস্তারিত পেজ-বাই-পেজ অডিট (Page-by-Page Audit)

---

### [পেজ ০১] Landing Page (`/`) — `Landing.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **হিরো সেকশন:** ইন্টারেক্টিভ অডিও প্লেয়ার ডেমো, "Get Started" বাটন, "Watch Demo" ভিডিও ট্রিগার।
  * **ইন্টারেক্টিভ ক্যালকুলেটর (ROI Calculator):** স্লাইডার ফিল্ড (Monthly Inbound Calls সংখ্যা, Average Call Duration, Staff Hourly Rate) -> সেভ করা টাকা ও সময় ক্যালকুলেট করে।
  * **ডেমো রিকোয়েস্ট ও কন্ট্যাক্ট ফর্ম:**
    * First Name (`input[name="first_name"]`)
    * Last Name (`input[name="last_name"]`)
    * Phone Number (`input[name="phone"]`)
    * Work Email (`input[name="email"]`)
    * Business Category / Industry (ড্রপডাউন)
    * Message / Notes (`textarea`)
  * **লাইভ সোশ্যাল প্রুফ ও টেস্টোমোনিয়াল:** রিভিউ ক্যারোসেল, প্রাইসিং প্রিভিউ কার্ড।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `POST /api/v1/public/demo-requests` (ডেমো সাবমিশন ও লিড ক্যাপচার)
  * `POST /api/v1/public/meeting-requests` (মিটিং স্লট কোয়েরি)
  * `GET /api/v1/smartflow/subscription/plans` (প্রাইসিং প্ল্যান ফেচ করা)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * লাইভ ল্যান্ডিং পেজে সরাসরি ইন্টারেক্টিভ এআই রিসেপশনিস্ট ভয়েস টেস্ট কল করার পাবলিক ট্রায়াল সেশন (বর্তমানে শুধু ড্যাশবোর্ডে লগইন করার পর টেস্ট কল করা যায়)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** ডেমো রিকোয়েস্ট ফর্ম সরাসরি `publicApi.submitDemoRequest` হয়ে MongoDB-র `demo_requests` কালেকশনে সেভ হচ্ছে।
  * ⚠️ **ল্যাক:** ROI ক্যালকুলেটরের হিসেব ফ্রন্টএন্ডের ক্লায়েন্ট-সাইড জাভাস্ক্রিপ্ট দিয়ে হচ্ছে (ব্যাকএন্ড ডাইনামিক মেট্রিক্স এপিআই নেই, তবে এটি ক্লায়েন্ট সাইডেই পারফেক্ট)।

---

### [পেজ ০২] Login & Register (`/login`) — `Login.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **লগইন ট্যাব:**
    * Email বা Phone Number (`input[name="identifier"]`)
    * Password (`input[name="password"]`)
    * "Remember Me" চেকবক্স, "Forgot Password?" লিংক
  * **রেজিস্ট্রেশন ট্যাব:**
    * Full Name (`input[name="full_name"]`)
    * Email Address (`input[name="email"]`)
    * Phone Number (`input[name="phone"]`)
    * Password ও Confirm Password
    * Terms & Privacy পলিসি এগ্রিমেন্ট চেকবক্স
  * **সোশ্যাল লগইন বাটন:** Continue with Google, Continue with Microsoft
  * **পাসওয়ার্ড রিসেট মোডাল:** ইমেইল ইনপুট, ৬-ডিজিটের OTP ভেরিফিকেশন কোড ইনপুট ফিল্ড, New Password ফিল্ড।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `POST /api/v1/auth/login` (JWT টোকেন জেনারেটর)
  * `POST /api/v1/auth/register` (নতুন ইউজার সৃষ্টি)
  * `POST /api/v1/auth/forgot-password` (OTP পাঠানো)
  * `POST /api/v1/auth/verify-otp` (OTP যাচাই)
  * `POST /api/v1/auth/reset-password` (পাসওয়ার্ড আপডেট)
  * `POST /api/v1/auth/refresh-token` (টোকেন রোটেশন)
  * `POST /api/v1/auth/google` (গুগল সাইন-ইন)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * ফোন নম্বরে SMS OTP দিয়ে লগইন (বর্তমানে শুধুমাত্র ইমেইল OTP ব্যাকএন্ডে কনফিগার করা)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** `useAuthStore` এর মাধ্যমে `login`, `register`, `me` ব্যাকএন্ডের সাথে সম্পূর্ণ লাইভ কানেক্টেড।
  * ⚠️ **আন-ইন্টিগ্রেটেড:** মাইক্রোসফট সোশ্যাল লগইন বাটন UI-তে থাকলেও ব্যাকএন্ডে শুধুমাত্র Google OAuth রাউট সংযুক্ত; মাইক্রোসফটের হ্যান্ডলার আংশিক।

---

### [পেজ ০৩] Onboarding Wizard (`/onboarding`) — `Onboarding.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **স্টেপ ১ (Role Selection):** Investor, Realtor, Landlord, Buyer (রেডিও/কার্ড সিলেক্টর)।
  * **স্টেপ ২ (Main Goals Multi-Select):** Expand Portfolio, Close More Deals, Automate Inquiries, Build Network, Manage Maintenance (চেকবক্স)।
  * **স্টেপ ৩ (Profile Setup):** Company Name (`input[name="company"]`), Years of Experience (ড্রপডাউন: 1-3 years, 3-5 years, 5+ years)।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `POST /api/v1/onboarding/complete` (অনবোর্ডিং ফিনিশ করা)
  * `POST /api/v1/onboarding/progress` (স্টেপ সেভ করা)
  * `PATCH /api/v1/smartflow/business-profile` (কোম্পানি ও রোল আপডেট)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * কোনো নির্দিষ্ট অভাব নেই, ব্যাকএন্ড সম্পূর্ণ প্রস্তুত।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ❌ **গুরুত্বপূর্ণ গ্যাপ (NOT INTEGRATED):** `Onboarding.jsx` ফাইলে ইউজারের সিলেক্ট করা রোল ও গোল লোকাল রিঅ্যাক্ট `useState`-এ রাখা হয় এবং ফিনিশ বাটনে চাপ দিলে `setTimeout(..., 1500)` দিয়ে সরাসরি `/dashboard`-এ পাঠিয়ে দেওয়া হয়! ব্যাকএন্ডের `updateBusinessProfile` বা `complete` এপিআই কল করা হয়নি!

---

### [পেজ ০৪] Subscription & Checkout (`/subscription`) — `Subscription.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **প্ল্যান সিলেক্টর:** Starter ($49/mo), Growth ($99/mo), Pro ($199/mo) কার্ডস।
  * **বিলিং টগল:** Monthly বনাম Annual (২০% ডিসকাউন্ট ক্যালকুলেশন)।
  * **ইউজার ডিটেইলস ফর্ম:** Full Name, Work Email, Business Name, Business Address, Phone Number।
  * **পেমেন্ট ফর্ম:** কার্ড নম্বর, এক্সপায়ারি, CVC (অথবা স্ট্রাইপ চেকআউট রিডাইরেক্ট)।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/subscription/plans` (প্ল্যান লিস্ট)
  * `GET /api/v1/smartflow/subscription/current` (বর্তমান স্ট্যাটাস)
  * `POST /api/v1/auth/subscription-signup` (সাবস্ক্রিপশন রেজিস্ট্রেশন)
  * `POST /api/v1/dashboard/webhooks/stripe` (পেমেন্ট সাকসেস লিসেনার)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * পেপাল (PayPal) বা ক্রিপ্টো পেমেন্ট গেটওয়ে (শুধু Stripe সমর্থিত)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** `publicApi.subscriptionSignup` এবং স্ট্রাইপ চেকআউট সেশন যুক্ত।

---

### [পেজ ০৫] Dashboard Overview (`/dashboard`) — `Dashboard.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **KPI কার্ডস:** Total Calls, Saved Minutes, Active Contacts, Unread Chats।
  * **ইনবক্স প্রিভিউ উইজেট:** সর্বশেষ ৩টি চ্যাট মেসেজ, প্রেরকের নাম ও প্রোফাইল অ্যাভাটার স্ট্যাক।
  * **কন্ট্যাক্টস প্রিভিউ উইজেট:** মোট কন্ট্যাক্ট সংখ্যা এবং সম্প্রতি যুক্ত হওয়া ক্লায়েন্টদের অ্যাভাটার।
  * **আপকামিং ক্যালেন্ডার উইজেট:** পরবর্তী মিটিংয়ের তারিখ, সময় ও টাইটেল।
  * **ইন্টিগ্রেশন স্ট্যাটাস ব্যাজ:** WhatsApp, Telnyx, Facebook, Instagram কানেক্টেড কিনা তার লাইভ ব্যাজ।
  * **কুইক অ্যাকশন বাটন:** New Agreement, New Invoice, New Lease, Create Post।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/home` (একক এগ্রিগেটেড ড্যাশবোর্ড ডেটা)
  * `GET /api/v1/smartflow/calls/summary`
  * `GET /api/v1/smartflow/contacts`
  * `GET /api/v1/smartflow/conversations`
  * `GET /api/v1/smartflow/calendar/events`
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * লাইভ ওয়েদার বা মার্কেট নিউজ উইজেট (এগুলো ডিজাইনে ছিল না)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** ড্যাশবোর্ডটি `Promise.allSettled` দিয়ে ৫টি আলাদা ব্যাকএন্ড এপিআই কল করে রিয়েল ডেটা সফলভাবে রেন্ডার করছে।

---

### [পেজ ০৬] Conversations & Unified Inbox (`/conversations`, `/unified-conversation`)
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **বামদিকের থ্রেড লিস্ট:** সার্চ বার (`placeholder="Search messages..."`), ফিল্টার ড্রপডাউন (All, Unread, SMS, WhatsApp, Email), চ্যানেল আইকন।
  * **চ্যাট হেডার:** কাস্টমার নাম, ফোন নম্বর, অ্যাসাইন করা টিম মেম্বার ড্রপডাউন, Archive বাটন, Delete বাটন।
  * **মেসেজ ভিউয়ার:** ইনকামিং ও আউটগোয়িং মেসেজ বাবলস, টাইমস্ট্যাম্প, ডেলিভারি টিক্স (Sent, Delivered, Read), ইমেজ/ফাইল প্রিভিউয়ার।
  * **মেসেজ কম্পোজার ইনপুট:**
    * টেক্সট ইনপুট (`textarea[placeholder="Type a message..."]`)
    * **AI Compose বাটন (✨):** ক্লিক করলে প্রম্পট ড্রপডাউন খোলে (Professional, Friendly, Urgent, Follow-up)।
    * **Voice Dictation বাটন (🎙️):** ক্লিক করলে ব্রাউজার মাইক রেকর্ড করে অডিও টেক্সটে পরিণত করে।
    * ফাইল অ্যাটাচমেন্ট আইকন (PDF, ইমেজ আপলোড)।
    * সেন্ড বাটন।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/conversations` (থ্রেড লিস্ট ও ফিল্টারিং)
  * `GET /api/v1/smartflow/conversations/{id}/messages` (মেসেজ হিস্টোরি)
  * `POST /api/v1/smartflow/messages` (নতুন মেসেজ পাঠানো)
  * `POST /api/v1/smartflow/ai/compose` (AI দিয়ে রিপ্লাই তৈরি)
  * `POST /api/v1/smartflow/ai/transcribe` (ভয়েস ডিকটেশন থেকে টেক্সট)
  * `POST /api/v1/smartflow/conversations/{id}/mark-read`
  * `PATCH /api/v1/smartflow/conversations/{id}/assign` (টিম মেম্বারকে এসাইন করা)
  * `PATCH /api/v1/smartflow/conversations/{id}/archive`
  * `DELETE /api/v1/smartflow/conversations/{id}`
  * `WebSocket /api/v1/smartflow/ws/conversations/{id}` (রিয়েল-টাইম চ্যাট সিঙ্ক)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * মেসেজ শিডিউলিং (নির্দিষ্ট সময় পর মেসেজ পাঠানো — এটি বাল্ক মেসেজিংয়ে আছে, কিন্তু ১-টু-১ চ্যাটে নেই)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ইন্টিগ্রেটেড:** ওমনিচ্যানেল মেসেজিং, AI কম্পোজ এবং ফাইল আপলোড ব্যাকএন্ডের সাথে সম্পূর্ণ লাইভ।

---

### [পেজ ০৭] Calls & Voice AI Receptionist (`/calls`, `/ai-call`, `/voice-conversation`)
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **ডায়াল প্যাড (Dialer):** ফোন নম্বর ইনপুট (`input[type="tel"]`), কল বাটন, স্পিকার/মাইক মিউট টগল।
  * **কল অ্যানালিটিক্স বার:** Total Calls, Average Call Duration, Missed Calls, AI Handled Calls।
  * **কল হিস্টোরি টেবিল:** কলারের নাম/নম্বর, তারিখ ও সময়, কলের ধরন (Inbound/Outbound), ডিউরেশন, স্ট্যাটাস (Completed, Missed)।
  * **কল ডিটেইলস মোডাল:**
    * অডিও প্লেয়ার (Play/Pause, Seekbar, Download Recording বাটন)।
    * সম্পূর্ণ অডিও ট্রান্সক্রিপ্ট (স্পিকার ডায়ালগ সহ)।
    * **AI Summary বক্স:** কলের সারাংশ ও কাস্টমারের উদ্দেশ্য (Lead Intent)।
    * Request Callback বাটন।
  * **AI Receptionist কনফিগারেশন পেজ (`/ai-call`):**
    * AI Voice নির্বাচন ড্রপডাউন (Alloy, Echo, Fable, Onyx, Nova, Shimmer)।
    * Greeting Message (`textarea`).
    * System Prompt / Instruction (`textarea`).
    * Transfer Call Phone Number (`input[name="transfer_number"]`).
    * টেস্ট কল বাটন ("Test AI Receptionist Now")।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/calls` (কল লিস্ট)
  * `GET /api/v1/smartflow/calls/{id}/transcript` (ট্রান্সক্রিপ্ট)
  * `GET /api/v1/smartflow/calls/{id}/ai-summary` (এআই সামারি)
  * `GET /api/v1/smartflow/calls/{id}/recording` (অডিও ফাইল)
  * `POST /api/v1/smartflow/calls/outbound` (আউটবাউন্ড কল শুরু)
  * `GET/PATCH /api/v1/smartflow/ai-call-settings` (ভয়েস সেটিংস)
  * `WebSocket /api/v1/calls/stream/{call_id}` (লাইভ ভয়েস অডিও স্ট্রিমিং)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * কল চলাকালীন লাইভ কল বাজের (Barge-in / মানব এজেন্টের সরাসরি ফোনে কথা বলে টেক-ওভার করা)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** কল হিস্টোরি, অডিও প্লেব্যাক, ট্রান্সক্রিপ্ট এবং এআই সামারি সম্পূর্ণ লাইভ ডেটা দিয়ে কাজ করে।
  * ⚠️ **আংশিক:** ব্রাউজার থেকে সরাসরি ওয়েবআরটিসি দিয়ে ফোনে কথা বলার ফিচারটি ব্যাকএন্ডের মাধ্যমে আউটবাউন্ড কল ট্রিগার করে, তবে ব্রাউজারে ইনকামিং কল রিং হওয়ার জন্য Telnyx WebRTC SDK কনফিগারেশন প্রয়োজন।

---

### [পেজ ০৮] Contacts CRM (`/contacts`) — `Contacts.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **সার্চ ও ফিল্টার বার:** নাম/ফোন দিয়ে সার্চ, কোম্পানি অনুযায়ী ফিল্টার, ট্যাগ ফিল্টার।
  * **Add Contact মোডাল:**
    * First Name (`input[placeholder="e.g. Alex"]`)
    * Last Name (`input[placeholder="e.g. Thompson"]`)
    * Phone Number (`input[placeholder="+1 (415) 555-0123"]`)
    * Email Address (`input[placeholder="alex.t@lumina.ai"]`)
    * Street Address (`input[placeholder="123 Innovation Drive, San Francisco, CA"]`)
    * Tags ইনপুট (চিপস ইনপুট)
    * Custom Notes (`textarea`)
    * Avatar Image Uploader
  * **ইম্পোর্ট/এক্সপোর্ট টুলস:** "Export CSV" বাটন, "Import CSV" ড্রপজোন ফাইল ড্রপ।
  * **কন্ট্যাক্ট প্রোফাইল স্লাইড-ওভার:** কন্ট্যাক্টের আগের সব চ্যাট, কল হিস্টোরি ও ডকুমেন্টস তালিকা।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/contacts` (প্যাজিনেশন ও ফিল্টারিং সহ)
  * `POST /api/v1/smartflow/contacts` (নতুন কন্ট্যাক্ট)
  * `PATCH /api/v1/smartflow/contacts/{id}` (আপডেট)
  * `DELETE /api/v1/smartflow/contacts/{id}` (ডিলিট)
  * `POST /api/v1/smartflow/contacts/{id}/avatar` (ছবি আপলোড)
  * `POST /api/v1/smartflow/contacts/import` (CSV বাল্ক ইম্পোর্ট)
  * `GET /api/v1/smartflow/contacts/export` (CSV ডাউনলোড)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * কন্ট্যাক্টের সোশ্যাল মিডিয়া প্রোফাইল অটো-এনরিচমেন্ট (Clearbit / Apollo API ইন্টিগ্রেশন)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ফুল্লি ইন্টিগ্রেটেড:** সকল ফর্ম ফিল্ড সরাসরি ডাটাবেসে সেভ ও রিড হচ্ছে।

---

### [পেজ ০৯] Groups & Audience (`/groups`) — `Groups.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **গ্রুপ লিস্ট ও মেট্রিক্স:** মোট গ্রুপ সংখ্যা, মেম্বার সংখ্যা, আনরিড মেসেজ ব্যাজ।
  * **Create Group মোডাল:** Group Name (`input`), Description (`textarea`), Avatar URL (`input`), প্রাথমিক মেম্বার নির্বাচন চেকবক্স।
  * **গ্রুপ চ্যাট এরিয়া:** গ্রুপে মেসেজ পাঠানো, মেম্বার লিস্ট দেখা, Add Member মোডাল, Remove Member অ্যাকশন।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/groups`
  * `POST /api/v1/smartflow/groups`
  * `PATCH /api/v1/smartflow/groups/{id}`
  * `DELETE /api/v1/smartflow/groups/{id}`
  * `POST /api/v1/smartflow/groups/{id}/members` (মেম্বার যোগ)
  * `DELETE /api/v1/smartflow/groups/{id}/members/{mid}` (মেম্বার বাতিল)
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ফুল্লি ইন্টিগ্রেটেড।**

---

### [পেজ ১০] Calendar & Appointments (`/calendar`) — `Calendar.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **ক্যালেন্ডার গ্রিড:** Month, Week, Day ভিউ টগল।
  * **Create Appointment মোডাল:**
    * Title (`input[name="title"]`)
    * Date Picker (`starts_at`, `ends_at`)
    * Time Slot ড্রপডাউন
    * Client Selector (কন্ট্যাক্টস ড্রপডাউন থেকে সিলেক্ট করা)
    * Location / Meeting URL (`input`)
    * Notes (`textarea`)
  * **ক্যালেন্ডার প্রোভাইডার সেটিংস ড্রপডাউন:** Google Calendar, CalDAV / Apple iCloud।
  * **CalDAV কানেকশন মোডাল:** Email Username (`input[placeholder="you@icloud.com"]`), App-Specific Password (`input[placeholder="xxxx-xxxx-xxxx-xxxx"]`), Server URL।
  * **শেয়ার বাটন:** কাস্টমারদের জন্য ইউনিক সেলফ-শিডিউলিং লিংক কপি করা।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/calendar/events`
  * `POST /api/v1/smartflow/calendar/events`
  * `PATCH /api/v1/smartflow/calendar/events/{id}`
  * `DELETE /api/v1/smartflow/calendar/events/{id}`
  * `GET/PUT /api/v1/smartflow/calendar/business-hours`
  * `GET/PUT /api/v1/smartflow/calendar/provider-settings`
  * `GET /api/v1/public/meeting-requests/confirm/{token}`
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * Microsoft Outlook / Office 365 ডিরেক্ট ক্যালেন্ডার সিঙ্ক (গুগল এবং ক্যালড্যাভ আছে)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** ইন্টারনাল ইভেন্টস এবং গুগল ক্যালেন্ডার সিঙ্ক সক্রিয়।
  * ⚠️ **ইস্যু:** CalDAV কানেক্ট করার এপিআই কলটিতে সার্ভার সাইডে ট্রাই-ক্যাচ হ্যান্ডলার না থাকায় ভুল পাসওয়ার্ডে HTTP 500 এরর দেয়।

---

### [পেজ ১১] Bulk Messaging & Broadcasts (`/bulk-messaging`) — `BulkMessaging.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **চ্যানেল সিলেক্টর:** SMS, WhatsApp, Email রেডিও/ট্যাব।
  * **অডিয়েন্স সিলেক্টর:** "All Contacts", "Specific Group", বা "By Tag"।
  * **মেসেজ কম্পোজার:**
    * Email Subject (`input[name="subject"]` - শুধুমাত্র ইমেইল চ্যানেলের জন্য)
    * Message Body (`textarea`)
    * Dynamic Tags ইনসার্ট বাটন: `{first_name}`, `{company}`, `{phone}`
    * **AI Improve Content বাটন (✨):** ক্লিক করলে AI দিয়ে ড্রাফট প্রফেশনাল ও আকর্ষণীয় করা হয়।
    * অ্যাটাচমেন্ট ফাইল আপলোড বাটন
  * **ক্যাম্পেইন হিস্টোরি ও অ্যানালিটিক্স টেবিল:** Campaign Name, Channel, Recipients Count, Sent Time, Status (Draft, Scheduled, Sent, Failed)।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/smartflow/bulk-messages`
  * `POST /api/v1/smartflow/bulk-messages`
  * `POST /api/v1/smartflow/bulk-messages/attachments`
  * `POST /api/v1/smartflow/bulk-messages/improve-content`
  * `POST /api/v1/smartflow/bulk-messages/{id}/send`
  * `POST /api/v1/smartflow/bulk-messages/{id}/cancel`
  * `POST /api/v1/email/draft`
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * A/B টেস্টিং ক্যাম্পেইন (একই সাথে দুটি ভিন্ন মেসেজ পাঠিয়ে কনভার্সন ট্র্যাক করা)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ইন্টিগ্রেটেড:** এসএমএস ও ইমেইল ব্রডকাস্ট ব্যাকএন্ড সার্ভিস দিয়ে সম্পূর্ণ কার্যকর।

---

### [পেজ ১২] Documents, Agreements & Leases (`/documents`, `/sign`)
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **ট্যাব ন্যাভিগেশন:** Agreements (চুক্তি), Leases (লিজ), Documents (ফাইলস)।
  * **Create Agreement মোডাল:**
    * Document Title (`input`)
    * Client Name ও Client Email (`input`)
    * Agreement Type ড্রপডাউন (NDA, Service Agreement, Partnership, Consulting)
    * Agreement Body Content (`textarea`)
    * AI Improve Draft বাটন
    * Expiration Date Picker
  * **Create Lease মোডাল:**
    * Property Address (`input`)
    * Tenant Name ও Email (`input`)
    * Monthly Rent ($) ও Security Deposit ($)
    * Lease Start Date ও End Date
    * **AI Enhance Terms বাটন:** লিগ্যাল ক্লজ স্বয়ংক্রিয়ভাবে ইনসার্ট করা।
  * **ডিজিটাল সাইন পেজ (`/sign/:docType/:token`):**
    * ডকুমেন্ট প্রিভিউয়ার (PDF ভিউয়ার)।
    * সিগনেচার প্যাড (মাউস/টাচ দিয়ে ড্রয়িং অথবা টাইপ করা সিগনেচার)।
    * "I agree to legally binding electronic signature" চেকবক্স।
    * Submit Signature বাটন।
  * **ডাউনলোড বাটনস:** Download PDF, Download Signed Copy, Download Certificate of Completion।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * ৫২টি এন্ডপয়েন্ট (Folder 08-এর সম্পূর্ণ এগ্রিমেন্ট ও লিজ ক্রুড, পিডিএফ জেনারেশন ও সাইনিং)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ফুল্লি ইন্টিগ্রেটেড:** ডিজিটাল ই-সাইন এবং ক্রিপ্টোগ্রাফিক হ্যাশ অডিট ট্রেইল সম্পূর্ণ লাইভ।

---

### [পেজ ১৩] AI Workflow Builder (`/ai-workflow`) — `AIWorkflow.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **প্রম্পট ইনপুট:** "Describe the workflow you want to automate..." (`textarea`)
  * **ওয়ার্কফ্লো প্রিভিউ কার্ডস:** ট্রিগার ও অ্যাকশন স্টেপস কার্ডস।
  * **AI Image Generator কার্ড:** Image Prompt Input, Image Style (Realistic, 3D, Anime), Generate বাটন।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `POST /api/v1/smartflow/ai/workflow-prefill` (প্রম্পট থেকে ওয়ার্কফ্লো স্ট্রাকচার তৈরি)
  * `POST /api/v1/smartflow/ai/generate-image` (DALL-E ইমেজ জেনারেটর)
  * `POST /api/v1/smartflow/ai/chat`
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * একটি সম্পূর্ণ ভিজ্যুয়াল ড্র্যাগ-এন্ড-ড্রপ নোড গ্রিড এডিটর (যেমন: n8n বা Make.com এর মতো ক্যানভাস) যা ডাটাবেসে সেভ হয়ে ইনকামিং কল চলাকালীন ডিসিশন ট্রি এক্সিকিউট করবে।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ⚠️ **আংশিক:** প্রি-ফিল প্রম্পট ও ইমেজ জেনারেশন ইন্টিগ্রেটেড, কিন্তু ওয়ার্কফ্লো পারসিস্টেন্স রুল ইঞ্জিন মিসিং।

---

### [পেজ ১৪] Integrations Hub (`/integrations`) — `Integrations.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **টেলিনিক্স (Telnyx) কার্ড:** Phone Number, Status (Connected), Buy Number বাটন, Area Code Search ইনপুট।
  * **WhatsApp কার্ড:** Connect বাটন -> কিউআর কোড (QR Code) মোডাল পপআপ ও অটো-রিফ্রেশ টাইমার।
  * **টেলিগ্রাম (Telegram) কার্ড:** Connect বাটন -> Bot Token (`input`), Bot Username (`input`), Secret Token (`input`)।
  * **Google Calendar কার্ড:** Connect with Google বাটন।
  * **Meta (Facebook/Instagram) কার্ড:** OAuth কানেক্ট বাটন।
  * **Stripe Connect কার্ড:** "Setup Payouts" বাটন।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * ৩১টি এন্ডপয়েন্ট (Folder 10-এর সব ইন্টিগ্রেশন রাউট)।
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * Slack বা Discord ওয়ার্কস্পেস নোটিফিকেশন ইন্টিগ্রেশন।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** Telnyx নম্বর ম্যানেজমেন্ট এবং WhatsApp কিউআর কোড জেনারেশন সংযুক্ত।
  * ⚠️ **ইস্যু:** Telegram টোকেন টেস্টে ইনভ্যালিড থাকলে HTTP 502 দেয় এবং Stripe Connect সক্রিয় না থাকলে 503 দেয়।

---

### [পেজ ১৫] Invoices & Billing (`/invoices`) — `Invoices.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **ইনভয়েস অ্যানালিটিক্স:** Total Invoiced, Paid Amount, Overdue Amount, Outstanding Balance।
  * **Create Invoice মোডাল:**
    * Client Name (`input[name="client_name"]`)
    * Client Email (`input[placeholder="client@example.com"]`)
    * Client Address (`input[placeholder="123 Business St, City, Country"]`)
    * Issue Date ও Due Date
    * Currency ড্রপডাউন (USD, EUR, GBP, CAD)
    * Line Items ডায়নামিক টেবিল: Item Description, Quantity, Unit Price, Tax %
    * Subtotal, Tax, ও Total অটো-ক্যালকুলেশন
    * Payment Terms ও Notes
  * **ইনভয়েস অ্যাকশন বাটন:** Send Email Invoice, Copy Payment Link, Send Reminder, Record Payment, Download PDF।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/invoices`
  * `POST /api/v1/invoices`
  * `PATCH /api/v1/invoices/{id}`
  * `DELETE /api/v1/invoices/{id}`
  * `POST /api/v1/invoices/{id}/send` (ইমেইলে ইনভয়েস পাঠানো)
  * `POST /api/v1/invoices/{id}/remind` (রিমাইন্ডার পাঠানো)
  * `GET /api/v1/invoices/{id}/pdf` (পিডিএফ তৈরি)
  * `POST /api/v1/invoices/{id}/payment-link` (স্ট্রাইপ পেমেন্ট লিংক জেনারেশন)
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ফুল্লি ইন্টিগ্রেটেড:** ইনভয়েস সৃষ্টি, পিডিএফ ডাউনলোড এবং ইমেইল রিমাইন্ডার লাইভ।

---

### [পেজ ১৬] Add-on Shop (`/shop`) — `Shop.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **প্রোডাক্ট ক্যাটালগ কার্ডস:** অতিরিক্ত ফোন নম্বর ($5/mo), ১,০০০ এআই ভয়েস মিনিট ($25), ৫,০০০ বাল্ক এসএমএস ($30)।
  * **পারচেজ মোডাল:**
    * Cardholder Name (`input`)
    * Card Expiry (`input[placeholder="MM/YY"]`)
    * Card CVC (`input[placeholder="CVC"]`)
    * Purchase Confirm বাটন
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/shop/products` (পাবলিক ক্যাটালগ)
  * `GET/POST/PATCH/DELETE /api/v1/shop/admin/products` (এডমিন প্রোডাক্ট ক্রুড)
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * শপের কার্ট বা কুপন/ডিসকাউন্ট কোড সিস্টেম।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ⚠️ **আংশিক:** ক্যাটালগ লিস্ট ব্যাকএন্ড থেকে আসে, কিন্তু চেকআউট মোডালে সরাসরি ক্রেডিট কার্ডের CVC ইনপুট নেওয়া হচ্ছে যা স্ট্রাইপ সিকিউরিটির জন্য ঝুঁকিপূর্ণ (স্ট্রাইপ চেকআউট সেশন বা স্ট্রাইপ এলিমেন্টস ব্যবহার করা উচিত)।

---

### [পেজ ১৭] Social Post Creator (`/create-post`) — `CreatePost.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **পোস্ট কনটেন্ট টেক্সট এরিয়া:** (`textarea[placeholder="What would you like to share?"]`)
  * **AI Caption Generator:** Prompt ইনপুট ও Generate বাটন।
  * **প্ল্যাটফর্ম টগলস:** Facebook, Instagram, LinkedIn, X/Twitter চেকবক্স।
  * **শিডিউলিং অপশন:** "Post Now" রেডিও অথবা "Schedule for Later" ডেট-টাইম পিকার।
  * ইমেজ আপলোডার।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `POST /api/v1/smartflow/social-posts` (পোস্ট শিডিউল করা)
  * `GET /api/v1/smartflow/social-posts` (পোস্ট হিস্টোরি)
  * `POST /api/v1/smartflow/ai/chat` (ক্যাপশন তৈরি)
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **ইন্টিগ্রেটেড:** শিডিউল পোস্ট ডাটাবেসে সেভ হচ্ছে। (মেটা টোকেন কানেক্টেড থাকলে লাইভ পোস্ট হয়)।

---

### [পেজ ১৮] Admin Panel (`/admin`) — `AdminPanel.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **সিস্টেম ওভারভিউ মেট্রিক্স:** Total Registered Users, Monthly Revenue, Active Subscriptions, AI Usage Logs।
  * **ইউজার লিস্ট টেবিল:** User Name, Email, Role, Subscription Plan, Status, Actions (Block/Unblock)।
  * **ট্রানজ্যাকশন লিস্ট:** Payment ID, User, Amount, Date, Status।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * ১২৪টি এন্ডপয়েন্ট (Folder 14-এর সম্পূর্ণ ওনার ও সুপার এডমিন স্যুট)।
* **ব্যাকএন্ডে কী কী বানানো নাই:**
  * কোনো অভাব নেই, ব্যাকএন্ড বিশাল।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ⚠️ **গুরুত্বপূর্ণ গ্যাপ:** ওয়েবসাইটের `AdminPanel.jsx` ফাইলটি মাত্র ৮৯ লাইনের একটি সংক্ষিপ্ত ভিউ যা শুধুমাত্র ৪টি এপিআই কল করে। ব্যাকএন্ডের বাকি ১২০টি এডমিন এপিআই (RBAC রোল ম্যাট্রিক্স, ডেমো রিকোয়েস্ট এক্সেপ্ট/রিজেক্ট, অর্গানাইজেশন ম্যানেজমেন্ট) এই পেজে অনুপস্থিত; সেগুলো মূলত অন্য অ্যাপ `madbel-dashboard`-এ রয়েছে।

---

### [পেজ ১৯] Profile & Security Settings (`/profile`)
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * **কোম্পানি প্রোফাইল ট্যাব:** Business Name, Address, Support Phone, Website URL, Business Hours, Timezone ড্রপডাউন, Company Logo আপলোড।
  * **সিকিউরিটি ট্যাব:** Current Password, New Password, Confirm Password, "Revoke All Other Sessions" বাটন, "Delete Account" ডেঞ্জার জোন বাটন।
  * **কাস্টম ডোমেইন DNS ট্যাব:** Domain Name (`input[name="domain"]`), জেনারেট হওয়া DKIM, SPF ও CNAME রেকর্ড টেবিল, "Verify DNS" বাটন।
  * **নোটিফিকেশন প্রেফারেন্স:** Email Alerts, Push Notifications, SMS Notifications টগলস।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * ৩০টি এন্ডপয়েন্ট (Folder 11-এর সকল প্রোফাইল ও সেটিংস রুট)।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ফুল্লি ইন্টিগ্রেটেড:** পাসওয়ার্ড পরিবর্তন, লোগো আপলোড এবং ডিএনএস ভ্যালিডেশন ব্যাকএন্ডের সাথে যুক্ত।

---

### [পেজ ২০] Public Legal & Help Pages (`/terms-and-conditions`, etc.) — `ContentPage.jsx`
* **ওয়েবসাইটে কী কী ফিল্ড ও UI রয়েছে:**
  * ডাইনামিক রিড-অনলি কনটেন্ট রেন্ডারার (Privacy Policy, Terms of Service, SMS Policy, Acceptable Use, Refund Policy, About Us)।
* **ব্যাকএন্ডে কী কী বানানো আছে:**
  * `GET /api/v1/content/pages/{slug}` এবং ডেডিকেটেড স্লাগ রুটসমূহ।
* **ইন্টিগ্রেশন স্ট্যাটাস:**
  * ✅ **১০০% ইন্টিগ্রেটেড:** ডাটাবেসের `content_pages` কালেকশন থেকে লাইভ কনটেন্ট ফেচ করে রেন্ডার হয়।

---

## 🏛️ 3. ব্যাকএন্ডে আছে কিন্তু ফ্রন্টএন্ডে নেই এমন ৪৬টি এন্ডপয়েন্ট (Backend Only Features)

নিচের ৪৬টি এন্ডপয়েন্ট ব্যাকএন্ডে সম্পূর্ণ কোড ও ডাটাবেস লজিক সহ তৈরি রয়েছে, কিন্তু ফ্রন্টএন্ডে এদের জন্য কোনো বাটন বা স্ক্রিন নেই:

| মডিউল | মেথড ও রুট পাথ | এন্ডপয়েন্ট নাম ও কাজ | কেন ফ্রন্টএন্ডে নেই / ব্যবহারের ক্ষেত্র |
| :--- | :--- | :--- | :--- |
| **Auth & Onboarding** | `GET /api/v1/onboarding/slides` | মোবাইল অনবোর্ডিং স্লাইডস | মোবাইল অ্যাপ (`madbel-mobile`) এর জন্য তৈরি, ওয়েব অ্যাপে স্লাইড স্ক্রিন নেই। |
| **Auth & Onboarding** | `GET /api/v1/onboarding/progress` | অনবোর্ডিং প্রগ্রেস ট্র্যাকার | ওয়েব অনবোর্ডিং লোকাল রিঅ্যাক্ট স্টেটে থাকায় ব্যাকএন্ড কল করে না। |
| **Auth & Onboarding** | `POST /api/v1/onboarding/progress` | স্টেপ প্রগ্রেস সেভ | ওয়েব অনবোর্ডিংয়ে সেভ বাটন নেই। |
| **Auth & Onboarding** | `POST /api/v1/onboarding/complete` | অনবোর্ডিং কমপ্লিট ফ্ল্যাগ | ওয়েব অনবোর্ডিংয়ে সরাসরি ড্যাশবোর্ডে রিডাইরেক্ট করে, কল করে না। |
| **Auth & Onboarding** | `POST /api/v1/onboarding/skip` | অনবোর্ডিং স্কিপ করা | ওয়েব UI-তে স্কিপ বাটন নেই। |
| **Auth & Onboarding** | `POST /api/v1/onboarding/reset` | অনবোর্ডিং রিসেট | ডেভেলপার/টেস্টিং রুট, UI নেই। |
| **Auth & Onboarding** | `POST /api/v1/auth/send-otp` | সরাসরি ইমেইল OTP রিকোয়েস্ট | লগইন ফ্লোতে সরাসরি ব্যবহার না হয়ে ইন্টারনাল ফাংশনে চলে। |
| **Auth & Onboarding** | `POST /api/v1/auth/resend-otp` | পুনরায় OTP পাঠানো | পাসওয়ার্ড রিসেট মডালে আলাদা রিসেন্ড বাটন কল নেই। |
| **Settings & App** | `GET /api/v1/app/config` | মোবাইল স্প্ল্যাশ স্ক্রিন কনফিগ | মোবাইল অ্যাপের জন্য সংরক্ষিত। |
| **Settings & App** | `GET /api/v1/app/permissions` | অ্যাপ পারমিশন প্রেফারেন্স | মোবাইল পারমিশন হ্যান্ডলারের জন্য। |
| **Settings & App** | `PUT /api/v1/app/permissions` | অ্যাপ পারমিশন আপডেট | মোবাইল পারমিশন হ্যান্ডলারের জন্য। |
| **Settings & App** | `POST /api/v1/app/permissions/accept-all` | সকল পারমিশন এক ক্লিকে গ্রহণ | মোবাইল অ্যাপের অনবোর্ডিং স্ক্রিন। |
| **Settings & App** | `POST /api/v1/smartflow/devices/push-token`| FCM পুশ নোটিফিকেশন টোকেন | মোবাইল অ্যাপে পুশ নোটিফিকেশন পাঠানোর ডিভাইস রেজিস্ট্রেশন। |
| **Shop Administration**| `GET /api/v1/shop/admin/products` | এডমিন প্রোডাক্ট ক্যাটালগ | এডমিনের জন্য প্রোডাক্ট ম্যানেজমেন্ট UI ওয়েবসাইটে নেই। |
| **Shop Administration**| `POST /api/v1/shop/admin/products` | এডমিন নতুন প্রোডাক্ট সৃষ্টি | শপে নতুন এড-অন প্রোডাক্ট যোগ করার কোনো এডমিন স্ক্রিন নেই। |
| **Shop Administration**| `GET /api/v1/shop/admin/products/table`| এডমিন প্রোডাক্ট টেবিল | টেবিল ভিউ UI নেই। |
| **Shop Administration**| `PATCH /api/v1/shop/admin/products/{id}`| প্রোডাক্ট প্রাইস/স্টক এডিট | এডিট করার UI নেই। |
| **Shop Administration**| `DELETE /api/v1/shop/admin/products/{id}`| প্রোডাক্ট ডিলিট | প্রোডাক্ট ডিলিট করার UI নেই। |
| **Shop Administration**| `PATCH /api/v1/shop/admin/products/{id}/status`| একটিভ/ইনঅ্যাক্টিভ টগল | স্ট্যাটাস টগল UI নেই। |
| **AI Workflows** | `POST /api/v1/ai/command` | সিএলআই / ব্যাকএন্ড কমান্ড রান | প্রম্পটের মাধ্যমে সরাসরি কমান্ড চালানোর কোনো কনসোল UI নেই। |
| **Calls & Voice** | `GET /api/ai-call-analytics` | পুরনো ভয়েস অ্যানালিটিক্স | নতুন `/calls/summary` ব্যবহৃত হওয়ায় পুরনো রুটটি অব্যবহৃত। |
| **Calls & Voice** | `POST /api/calls/{callId}/callback` | পুরনো কলব্যাক রিকোয়েস্ট | নতুন `/smartflow/calls/{id}/callback` ব্যবহৃত হচ্ছে। |
| **Calendar** | `POST /api/calendar/connect` | পুরনো ক্যালেন্ডার কানেক্ট | নতুন `/smartflow/integrations/caldav` দ্বারা প্রতিস্থাপিত। |
| **Calendar** | `GET /api/calendar/events` | পুরনো ক্যালেন্ডার ইভেন্টস | নতুন `/smartflow/calendar/events` দ্বারা প্রতিস্থাপিত। |
| **Calendar** | `POST /api/v1/calendar/schedule` | মিটিং শিডিউলার রুট | পাবলিক শিডিউলার সরাসরি `public/meeting-requests` ব্যবহার করে। |
| **Calendar** | `GET /calendar/share/{share_token}` | পাবলিক ক্যালেন্ডার ইভেন্ট শেয়ার | ব্যাকএন্ডে শেয়ার লিংক আছে কিন্তু ফ্রন্টএন্ডে রুট হ্যান্ডলার নেই। |
| **System & Webhooks** | `POST /webhooks/telnyx/voice` | টেলিনিক্স ইনকামিং কল ওয়েববুক | এটি সার্ভার-টু-সার্ভার রুট, কোনো ফ্রন্টএন্ড UI দরকার নেই। |
| **System & Docs** | `GET /docs`, `/redoc`, `/openapi.json` | সোয়াগার ও এপিআই ডক | ডেভেলপার ডকুমেন্টেশন রুট। |
| **System & Health** | `GET /health`, `/ready` | কুবারনেটিস / ক্লাউড প্রোব | ডেভঅপস ও মনিটরিং রুট। |

---

## 🔌 4. থার্ড-পার্টি ইন্টিগ্রেশন স্ট্যাটাস অডিট (Third-Party Integrations)

| সার্ভিস | ব্যবহারের ক্ষেত্র | ব্যাকএন্ড স্ট্যাটাস | ফ্রন্টএন্ড স্ট্যাটাস | সমস্যা বা গ্যাপ |
| :--- | :--- | :---: | :---: | :--- |
| **Telnyx Voice (SIP)** | ইনকামিং কল রিসিভ, ভয়েস এআই রিসেপশনিস্ট, আউটবাউন্ড কল | ✅ লাইভ | ✅ লাইভ | ব্রাউজারে সরাসরি কল রিসিভ করার WebRTC লাইব্রেরি যুক্ত করা প্রয়োজন। |
| **Telnyx SMS** | ১-টু-১ টেক্সট মেসেজিং এবং বাল্ক ব্রডকাস্ট এসএমএস | ✅ লাইভ | ✅ লাইভ | কোনো সমস্যা নেই; ১০০% কাজ করছে। |
| **OpenAI Realtime API**| ফোন কলে লাইভ স্পিচ-টু-স্পিচ রিসেপশনিস্ট হ্যান্ডলিং | ✅ লাইভ | ✅ লাইভ | ব্যাকএন্ডে সকেট রেডি; G.711 mu-law অডিও স্ট্রিমিং সচল। |
| **OpenAI GPT-4o-mini** | AI Message Compose, Lease Review, Contract Drafting | ✅ লাইভ | ✅ লাইভ | কোনো সমস্যা নেই; চমৎকার আউটপুট দিচ্ছে। |
| **Stripe Billing** | প্ল্যাটফর্ম সাবস্ক্রিপশন প্ল্যান ও ইনভয়েস পেমেন্ট | ✅ লাইভ | ✅ লাইভ | ওয়েবহুক রিসিভার সহ পেমেন্ট ফ্লো কাজ করছে। |
| **Stripe Connect** | ক্লায়েন্ট/ভেন্ডরদের সরাসরি ব্যাংক একাউন্টে পেআউট | ⚠️ আংশিক | ⚠️ আংশিক | স্ট্রাইপ অ্যাকাউন্টে Connect মোড সক্রিয় না থাকায় অনবোর্ডিংয়ে 503 দেয়। |
| **Meta WhatsApp API** | হোয়াটসঅ্যাপ কিউআর কোড স্ক্যান ও অফিসিয়াল মেসেজিং | ✅ লাইভ | ✅ লাইভ | কিউআর কোড জেনারেশন সচল; টেমপ্লেট মেসেজ ব্রডকাস্টে আরও কাজ দরকার। |
| **Telegram Bot API** | টেলিগ্রাম বট কানেক্ট ও দ্বিমুখী মেসেজ সিঙ্ক | ⚠️ আংশিক | ✅ লাইভ | ইনভ্যালিড বট টোকেনে ব্যাকএন্ডে 502 দেয় (ক্লিন ভ্যালিডেশন দরকার)। |
| **Google Calendar** | গুগল ক্যালেন্ডার ইভেন্টস দ্বিমুখী সিঙ্ক | ✅ লাইভ | ✅ লাইভ | OAuth ফ্লো ব্যাকএন্ডে কনফিগার করা। |
| **CalDAV (Apple iCloud)**| অ্যাপল ক্যালেন্ডার সিঙ্ক | ⚠️ বাগ | ✅ লাইভ | ব্যাকএন্ডে ট্রাই-ক্যাচ না থাকায় কানেকশন ফেইল করলে HTTP 500 এরর দেয়। |
| **Resend / SMTP** | ওটিপি, পাসওয়ার্ড রিসেট, ইনভয়েস ইমেইল ও ডোমেইন DNS | ✅ লাইভ | ✅ লাইভ | DKIM, SPF ও CNAME ভ্যালিডেশন সহ সক্রিয়। |

---

## 🎯 5. ভবিষ্যত ডেভেলপমেন্ট ও অ্যাকশন প্ল্যান (Punchlist Recommendations)

### ১. ফ্রন্টএন্ডের জন্য অগ্রাধিকার (Frontend Punchlist):
1. **Onboarding পেজ ফিক্স করা:** `Onboarding.jsx`-এ ইউজার যে রোল এবং গোল ইনপুট দিচ্ছে, তা লোকাল টাইমার দিয়ে স্কিপ না করে ব্যাকএন্ডের `smartflowApi.updateBusinessProfile` এবং `complete` এপিআই-তে সেভ করা।
2. **AI Receptionist ভিজ্যুয়াল বিল্ডার:** ইউজার যেভাবে চেয়েছেন—একটি নোড-ভিত্তিক "AI Receptionist Builder" ইন্টারফেস তৈরি করা, যেখানে ড্রপডাউনে রুল সেট করা যাবে (*Emergency -> Ask Address -> Dispatch Technician -> Send SMS*)।
3. **শপ এডমিন প্যানেল তৈরি করা:** ব্যাকএন্ডের `/api/v1/shop/admin/products` রুটের সাথে মিলিয়ে একটি এডমিন স্ক্রিন যুক্ত করা, যাতে নতুন প্রোডাক্ট বা এড-অন অ্যাড করা যায়।
4. **শপ চেকআউট সিকিউরিটি:** `Shop.jsx`-এ র' ক্রেডিট কার্ড ফিল্ডের বদলে Stripe Elements বা Stripe Checkout সেশন ব্যবহার করা।

### ২. ব্যাকএন্ডের জন্য অগ্রাধিকার (Backend Punchlist):
*(নোট: আপনার নির্দেশ মতো এখন কোনো কোড পরিবর্তন করা হয়নি, এগুলো ভবিষ্যতের জন্য রেকমেন্ডেশন)*
1. **CalDAV কানেকশন হ্যান্ডলার:** `POST /integrations/caldav/connect`-এ `try...except httpx.HTTPError` বসানো।
2. **টেলিগ্রাম বট ভ্যালিডেশন:** `POST /integrations/telegram/manual-connect`-এ টেলিগ্রামের এররকে ৫MD এর বদলে ৪MD ইউজার ফ্রেন্ডলি মেসেজ হিসেবে রিটার্ন করা।
3. **ড্যাশবোর্ড কুয়েরি অপটিমাইজেশন:** `/api/v1/smartflow/home` এন্ডপয়েন্টে ১২টি কুয়েরি ক্রমান্বয়ে চালানোর বদলে `asyncio.gather` ব্যবহার করে লেটেন্সি ৯.৭ সেকেন্ড থেকে ১ সেকেন্ডে নামিয়ে আনা।
