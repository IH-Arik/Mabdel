# Mabdel Backend — FastAPI REST API

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=flat-square&logo=mongodb)](https://mongodb.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com)

</div>

The production-grade FastAPI backend powering the Mabdel AI platform. Provides a comprehensive REST API with JWT authentication, AI integration, real-time WebSockets, and full business logic for conversations, documents, invoices, and integrations.

---

## 🚀 Quick Start

```bash
# 1. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
.venv\Scripts\activate         # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Start server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API: `http://localhost:8000`
Swagger Docs: `http://localhost:8000/docs`

---

## 📁 Project Structure

```
app/
├── api/v1/
│   ├── endpoints/              # FastAPI route handlers
│   │   ├── auth.py             # Registration, login, OAuth
│   │   ├── smartflow.py        # Core business API
│   │   ├── invoices.py         # Invoice management
│   │   ├── activities_events.py # Calendar & activities
│   │   └── dashboard.py        # Admin endpoints
│   └── router.py               # Route registration
│
├── core/
│   ├── config.py               # Pydantic settings (env-driven)
│   ├── security.py             # JWT, password hashing
│   └── database.py             # MongoDB connection
│
├── models/                     # MongoDB document models (Motor)
├── schemas/                    # Pydantic v2 request/response schemas
├── services/                   # Business logic (AI, messaging, docs)
├── workflows/                  # AI workflow orchestration
└── main.py                     # ASGI application factory
```

---

## 🔑 API Namespaces

| Prefix | Description |
|---|---|
| `/api/v1/auth` | Authentication & user management |
| `/api/v1/smartflow/conversations` | Unified inbox |
| `/api/v1/smartflow/contacts` | CRM contacts |
| `/api/v1/smartflow/calls` | AI call management |
| `/api/v1/smartflow/leases` | Lease document studio |
| `/api/v1/smartflow/agreements` | Agreement generator |
| `/api/v1/smartflow/bulk-messages` | Campaign management |
| `/api/v1/smartflow/integrations` | Platform OAuth connections |
| `/api/v1/smartflow/ai` | GPT-4o chat, voice, image |
| `/api/v1/invoices` | Invoice CRUD & delivery |
| `/api/v1/events` | Calendar events |
| `/api/v1/dashboard/admin` | Admin analytics |

---

## 🧪 Running Tests

```bash
# Run all tests
pytest tests/ -v

# With coverage report
pytest tests/ --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/test_ai.py -v
```

---

## 🐳 Docker

```bash
# Start MongoDB + API server
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop
docker-compose down
```

---

## 📋 Environment Variables

See the root [README.md](../README.md#-environment-variables) for the full list of required environment variables.

---

## 🤖 AI Features

- **GPT-4o Chat** — conversational AI with business context
- **Whisper STT** — voice message transcription
- **Workflow Prefill** — voice → structured form data
- **Lease/Agreement Generation** — AI-drafted legal documents
- **Call Summarization** — post-call AI analysis and sentiment
- **Reply Suggestions** — contextual message recommendations
