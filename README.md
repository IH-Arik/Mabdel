<div align="center">

<img src="https://img.shields.io/badge/Mabdel%20AI-Production%20Ready-11C7E5?style=for-the-badge&labelColor=0A1019" alt="Mabdel AI" />

# Mabdel AI — Intelligent Business Communication Platform

**The all-in-one AI-powered platform for modern businesses to manage conversations, automate workflows, generate smart documents, and close deals faster — across every channel.**

[![License: MIT](https://img.shields.io/badge/License-MIT-11C7E5.svg?style=flat-square)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110-009688?style=flat-square&logo=fastapi)](Mabdel%20Backend)
[![React](https://img.shields.io/badge/Web-React%2018%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](Mabdel%20Website)
[![React Native](https://img.shields.io/badge/Mobile-React%20Native%200.74-61DAFB?style=flat-square&logo=react)](madbel-mobile)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://mongodb.com)
[![OpenAI](https://img.shields.io/badge/AI-GPT--4o%20%2B%20Whisper-412991?style=flat-square&logo=openai)](https://openai.com)

[Live Demo](#) · [API Docs](#api-documentation) · [Report Bug](https://github.com/IH-Arik/Mabdel/issues) · [Request Feature](https://github.com/IH-Arik/Mabdel/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Overview

**Mabdel AI** is a production-grade, full-stack SaaS platform that brings together AI-powered communication, document automation, and business intelligence into a single unified workspace. Designed for real estate agents, sales teams, and service businesses, Mabdel AI eliminates the friction of managing multiple disconnected tools.

### Why Mabdel AI?

| Problem | Mabdel AI Solution |
|---|---|
| Scattered conversations across WhatsApp, Instagram, Telegram | **Unified Inbox** — all channels in one view |
| Manual lease & agreement drafting takes hours | **AI Document Generator** — draft in seconds |
| Cold calling without insight | **AI Call Analysis** — transcripts, sentiment, coaching |
| Bulk campaigns feel spammy | **Smart Bulk Messaging** — personalized at scale |
| Invoice chasing is exhausting | **Automated Invoice Reminders** — set and forget |

---

## ✨ Key Features

### 💬 Unified Conversations
- Real-time messaging across **WhatsApp, Instagram, Facebook, Telegram, SMS, Email**
- **Voice-to-Text** message composition using Whisper AI
- **AI Reply Suggestions** generated contextually per conversation
- Message archiving, platform filtering, and unread badge tracking

### 🤖 AI Workflow Engine
- **Voice-activated workflow prefill** — describe what you need, AI fills the form
- Natural language to structured data conversion
- GPT-4o powered chat assistant with business context
- Conversation history and replay

### 📞 AI-Powered Calls
- Outbound **AI call initiation** with configurable voice agents
- **Auto-transcription** of every call (Whisper)
- **AI summary & sentiment analysis** per call
- Call recording playback and analytics dashboard

### 📤 Bulk Messaging
- **3-step campaign builder**: Recipients → Channel → Compose
- Recipient management: manual entry, CSV upload, or contact list import
- Variable substitution (`{{name}}`, `{{company}}`)
- **Campaign scheduling** with timezone support

### 📄 Smart Document Studio
- AI-generated **Lease Agreements** with legal clause suggestions
- **Service & Business Agreements** from templates
- One-click **PDF export**, **digital signature**, and **renewal**
- AI clause improvement & document review

### 🔗 Integrations Hub
- OAuth2 connections for **Google, Meta (Facebook/Instagram), LinkedIn**
- Manual connect for **WhatsApp Business** and **Telegram Bot**
- Real-time sync status and disconnect management

### 🧾 Invoices & Payments
- Professional invoice creation with line items and taxes
- PDF generation and **email delivery**
- **Payment status tracking** and automated reminders
- Invoice timeline and audit trail

### 📅 Calendar & Scheduling
- Full calendar with **month/week/day** views
- Event creation, editing, and sharing
- Meeting scheduling integration

### 👥 Groups & Community
- Group chat workspace creation and management
- Member roles (Admin, Member)
- Invite link generation

### 📊 Admin Dashboard
- User growth charts and retention metrics
- AI usage statistics and cost monitoring
- Transaction ledger and earnings tracking
- Support ticket management

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mabdel AI Platform                       │
├─────────────────┬───────────────────┬───────────────────────────┤
│   Web App       │   Mobile App      │   Admin Dashboard         │
│ React 18 + Vite │ React Native 0.74 │ React + Tailwind          │
│   Port :5173    │   iOS / Android   │   Port :5174              │
└────────┬────────┴────────┬──────────┴──────────┬────────────────┘
         │                 │                      │
         └────────────────┬┘                      │
                          ▼                       ▼
              ┌───────────────────────────────────────────┐
              │          FastAPI Backend (Python 3.11)    │
              │             REST API  /api/v1/*           │
              │          WebSocket  /ws/*                 │
              │             Port :8000                    │
              └────────┬──────────────┬──────────────────┘
                       │              │
           ┌───────────┘      ┌───────┘
           ▼                  ▼
    ┌─────────────┐   ┌──────────────────┐
    │  MongoDB    │   │  OpenAI GPT-4o   │
    │  (Primary   │   │  Whisper STT     │
    │   Database) │   │  TTS / Vision    │
    └─────────────┘   └──────────────────┘
           │
    ┌──────┴───────┐
    │  Redis Cache │  (optional, for rate limiting & sessions)
    └──────────────┘
```

---

## 🛠 Tech Stack

### Backend (`Mabdel Backend`)
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.110 + Uvicorn |
| Language | Python 3.11+ |
| Database | MongoDB (Motor async driver) |
| Authentication | JWT (HS256) + OAuth2 (Google, Meta, LinkedIn) |
| AI/ML | OpenAI GPT-4o, Whisper, Realtime API |
| Messaging | WhatsApp Business API, Telegram Bot API |
| File Storage | Local filesystem / S3-compatible |
| Task Queue | Background tasks (FastAPI) |
| Validation | Pydantic v2 |
| Testing | Pytest + httpx |

### Web App (`Mabdel Website`)
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| State | Zustand |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion |
| HTTP Client | Axios |
| Icons | Lucide React |
| Date | date-fns |

### Mobile App (`madbel-mobile`)
| Layer | Technology |
|---|---|
| Framework | React Native 0.74 |
| Navigation | React Navigation v6 |
| State | Redux Toolkit + RTK Query |
| Styling | NativeWind (Tailwind) |
| Voice | expo-av + WebSocket |

---

## 📁 Project Structure

```
Mabdel AI/                          # Monorepo root
│
├── Mabdel Backend/                 # FastAPI REST API server
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/          # Route handlers (smartflow, auth, invoices…)
│   │   │   └── router.py           # API router registry
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings (env-driven)
│   │   │   └── security.py         # JWT + password hashing
│   │   ├── models/                 # MongoDB document models
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # Business logic layer
│   │   ├── workflows/              # AI workflow orchestration
│   │   └── main.py                 # App entry point
│   ├── tests/                      # Pytest test suite
│   ├── requirements.txt
│   └── docker-compose.yml
│
├── Mabdel Website/                 # React web application
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js           # Axios instance with interceptors
│   │   │   └── services.js         # All API endpoint definitions
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx      # Sidebar + navbar shell
│   │   ├── pages/                  # Feature page components
│   │   │   ├── AIWorkflow.jsx      # AI voice workflow
│   │   │   ├── BulkMessaging.jsx   # Campaign builder
│   │   │   ├── Calls.jsx           # Call analytics
│   │   │   ├── Contacts.jsx        # CRM contacts
│   │   │   ├── Conversations.jsx   # Unified inbox
│   │   │   ├── Documents.jsx       # Lease & agreement studio
│   │   │   ├── Integrations.jsx    # Platform connections
│   │   │   ├── Invoices.jsx        # Invoice management
│   │   │   └── ...                 # Calendar, Groups, Settings…
│   │   ├── store/
│   │   │   └── useAuthStore.js     # Zustand auth state
│   │   └── App.jsx                 # Route definitions
│   ├── package.json
│   └── vite.config.js
│
├── madbel-mobile/                  # React Native mobile app
│   ├── src/
│   │   ├── screens/                # Feature screens (auth, chat, call…)
│   │   ├── redux/                  # RTK slices and API endpoints
│   │   ├── stack/                  # Navigation stacks
│   │   └── utils/                  # Socket, voice, image picker
│   └── package.json
│
├── madbel-dashboard/               # Admin control panel (React)
│   └── src/
│       ├── Pages/                  # Dashboard, Users, Reports…
│       └── services/               # Admin API service layer
│
├── .gitignore
└── README.md                       # You are here
```

---

## 🏁 Getting Started

### Prerequisites

```bash
# Required
node >= 20.x
python >= 3.11
mongodb >= 7.0

# Optional
docker >= 24.x
redis >= 7.x
```

### 1. Clone the Repository

```bash
git clone https://github.com/IH-Arik/Mabdel.git
cd Mabdel
```

### 2. Backend Setup

```bash
cd "Mabdel Backend"

# Create virtual environment
python -m venv .venv
source .venv/bin/activate          # Linux/macOS
.venv\Scripts\activate             # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# → Edit .env with your MongoDB URI, OpenAI key, etc.

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

### 3. Web App Setup

```bash
cd "Mabdel Website"

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# → Set VITE_API_BASE_URL=http://localhost:8000

# Start development server
npm run dev
```

Web app available at: `http://localhost:5173`

### 4. Mobile App Setup

```bash
cd madbel-mobile

# Install dependencies
npm install

# iOS (macOS only)
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

### 5. Admin Dashboard Setup

```bash
cd madbel-dashboard

npm install
npm run dev
```

Dashboard available at: `http://localhost:5174`

### Using Docker (Recommended for local dev)

```bash
cd "Mabdel Backend"
docker-compose up -d
```

This starts MongoDB + the FastAPI server together.

---

## 🔑 Environment Variables

### Backend (`.env`)

```env
# Application
APP_NAME=Mabdel Backend API
ENVIRONMENT=production
SECRET_KEY=your-super-secret-key-change-in-production
DEBUG=false

# Database
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=mabdel_db

# Authentication
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# OAuth — Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/integrations/google/oauth/callback

# OAuth — Meta (Facebook / Instagram)
META_CLIENT_ID=...
META_CLIENT_SECRET=...
META_REDIRECT_URI=http://localhost:8000/api/v1/integrations/facebook/oauth/callback

# OAuth — LinkedIn
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/v1/integrations/linkedin/oauth/callback

# Telegram
TELEGRAM_BOT_TOKEN=...

# WhatsApp Business
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=...

# Storage
PUBLIC_BACKEND_URL=http://localhost:8000
MEDIA_ROOT=uploads
```

### Web App (`.env.local`)

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 📖 API Documentation

Once the backend is running, interactive API documentation is available at:

| Interface | URL |
|---|---|
| **Swagger UI** | `http://localhost:8000/docs` |
| **ReDoc** | `http://localhost:8000/redoc` |
| **OpenAPI JSON** | `http://localhost:8000/openapi.json` |

### Core API Namespaces

```
/api/v1/auth/*              → Registration, login, token refresh, OAuth
/api/v1/smartflow/*         → Conversations, contacts, AI, calls, documents
/api/v1/smartflow/ai/*      → GPT chat, voice workflow, image generation
/api/v1/smartflow/calls/*   → Call management, transcripts, AI summaries
/api/v1/smartflow/leases/*  → Lease generation, signing, renewal
/api/v1/smartflow/agreements/* → Agreement studio
/api/v1/smartflow/bulk-messages/* → Campaign management
/api/v1/smartflow/integrations/* → OAuth & manual platform connections
/api/v1/invoices/*          → Invoice CRUD, PDF, reminders
/api/v1/events/*            → Calendar event management
/api/v1/activities/*        → Activity feed
/api/v1/shop/*              → Product catalog
/api/v1/dashboard/admin/*   → Admin-only analytics & management
```

---

## 🚢 Deployment

### Backend — Production (Ubuntu / VPS)

```bash
# Install dependencies
pip install -r requirements.txt gunicorn

# Run with Gunicorn + Uvicorn workers
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120

# Recommended: use systemd or PM2 to manage the process
```

### Web App — Production Build

```bash
cd "Mabdel Website"
npm run build
# Serve the `dist/` folder via Nginx, Vercel, or Netlify
```

### Nginx Reverse Proxy (example)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/mabdel/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSockets
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Docker Compose (full stack)

```bash
docker-compose up --build -d
```

---

## 🧪 Testing

### Backend Tests

```bash
cd "Mabdel Backend"
source .venv/bin/activate
pytest tests/ -v --tb=short
```

### Test Coverage

```bash
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

### Development Workflow

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git commit -m "feat: add your feature description"

# 4. Push and open a Pull Request
git push origin feature/your-feature-name
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: bug fix
docs: documentation update
refactor: code refactoring
test: add or update tests
chore: maintenance tasks
```

---

## 🛡 Security

- JWT tokens with configurable expiry
- Rate limiting on authentication endpoints (20 req/min default)
- OAuth2 PKCE flow for third-party integrations
- All secrets managed via environment variables (never committed)
- Input validation via Pydantic v2
- CORS configured per environment

To report a security vulnerability, please email **security@mabdel.ai** instead of opening a public issue.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author & Maintainer

**IH-Arik** — [GitHub](https://github.com/IH-Arik/Mabdel)

---

<div align="center">

**Built with ❤️ using FastAPI, React, and OpenAI**

⭐ Star this repo if Mabdel AI helps your business!

</div>
