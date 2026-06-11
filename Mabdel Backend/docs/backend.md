# Backend API Reference

## Overview

The Mabdel backend exposes a versioned REST API at `/api/v1` along with a compatibility layer at `/api` for legacy clients. It is built using FastAPI and follows a modular architecture designed for high-performance AI workflows, real-time messaging, and multi-tenant dashboard management.

Key Features:
- **FastAPI Core**: Async-first, high-performance API.
- **Authentication**: JWT-based bearer authentication with refresh tokens and OTP verification.
- **AI Workflows**: LangGraph-powered intent routing for automated tasks (Invoices, Leases, etc.).
- **Real-time**: WebSocket support for live chat, inbox updates, and voice streaming.
- **Multi-Tenant Dashboard**: Separate admin and super-admin interfaces for platform management.
- **Integrations**: Support for Twilio, Meta, Google, LinkedIn, Twitter, and Snapchat.

OpenAPI sources:
- Runtime spec: `/openapi.json`
- Static snapshot: [openapi.json](openapi.json)
- Interactive Docs: `/docs` (Swagger) or `/redoc` (ReDoc)

## Base URLs

- Local Host: `http://127.0.0.1:8000`
- API V1 Base: `http://127.0.0.1:8000/api/v1`
- Dashboard Base: `http://127.0.0.1:8000/api/v1/dashboard`

## Standard Response Format

Successful responses use this envelope:
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

Error responses use this envelope:
```json
{
  "success": false,
  "message": "Detailed error message.",
  "error": {
    "code": "ERROR_CODE",
    "details": null
  }
}
```

---

## Environment Configuration

The backend is configured via environment variables (typically in a `.env` file).

| Variable | Description | Default |
| --- | --- | --- |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `PUBLIC_BACKEND_URL` | Public origin of the API | `http://127.0.0.1:8000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `SECRET_KEY` | JWT signing key | *Required* |
| `OPENAI_API_KEY` | API key for GPT models | *Optional (Fallback enabled)* |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for voice/SMS | *Optional* |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | *Optional* |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key | *Optional* |
| `RESEND_API_KEY` | API key for email delivery | *Optional* |

---

## Authentication

### Auth Endpoints
- `POST /api/v1/auth/register`: Register new user.
- `POST /api/v1/auth/send-otp`: Trigger email OTP.
- `POST /api/v1/auth/verify-otp`: Verify OTP to activate account.
- `POST /api/v1/auth/login`: Authenticate and receive tokens.
- `POST /api/v1/auth/google`: Social login via Google.
- `POST /api/v1/auth/refresh-token`: Exchange refresh token for new access token.
- `POST /api/v1/auth/forgot-password`: Request password reset.
- `POST /api/v1/auth/reset-password`: Set new password with OTP.
- `GET /api/v1/auth/me`: Get current user profile.
- `POST /api/v1/auth/logout`: Invalidate session.

### Auth Flow
1. **Register**: `POST /auth/register` -> `POST /auth/verify-otp`.
2. **Login**: `POST /auth/login` returns `access_token` and `refresh_token`.
3. **Authorize**: Include `Authorization: Bearer <access_token>` in headers.

---

#### SmartFlow Core

Managed via the `/api/v1/smartflow` prefix.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/ai/chat` | Main AI chat interface. Supports text-based workflow triggers. |
| `POST` | `/ai/voice-chat-upload` | Process audio commands and convert them to AI chat interactions. |
| `POST` | `/ai/workflow-prefill` | Extract form data from transcripts for automated form completion. |
| `GET` | `/ai/history` | Retrieve user interaction history with the AI. |
| `POST` | `/ai/history/{id}/replay` | Replay a previous AI interaction. |

#### Contacts & Groups
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/contacts` | List contacts (supports `search`, `page`). |
| `POST` | `/contacts` | Create a new contact. |
| `GET` | `/contacts/{id}` | Get detailed contact info. |
| `PATCH` | `/contacts/{id}` | Update contact details. |
| `DELETE` | `/contacts/{id}` | Remove a contact. |
| `POST` | `/contacts/{id}/avatar` | Upload contact profile picture (Multipart). |
| `GET` | `/groups` | List all contact groups. |
| `POST` | `/groups` | Create a new group. |
| `PATCH` | `/groups/{id}` | Update group name/settings. |
| `POST` | `/groups/{id}/members` | Add contacts to a group. |
| `DELETE` | `/groups/{id}/members/{m_id}` | Remove a member from a group. |

---

### Invoices & Documents

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/invoices` | List invoices with status/search filters. |
| `POST` | `/api/v1/invoices` | Create a new invoice. |
| `GET` | `/api/v1/invoices/{id}` | Get invoice details. |
| `PATCH` | `/api/v1/invoices/{id}` | Update draft invoice. |
| `DELETE` | `/api/v1/invoices/{id}` | Delete an invoice. |
| `POST` | `/api/v1/invoices/{id}/send` | Send invoice via email/messaging. |
| `POST` | `/api/v1/invoices/{id}/status` | Update invoice status (Paid, Cancelled). |
| `GET` | `/api/v1/invoices/{id}/pdf` | Download invoice as PDF. |
| `GET` | `/api/v1/smartflow/documents` | List all uploaded documents. |
| `POST` | `/api/v1/smartflow/documents` | Upload and AI-index a new document. |

---

### Leases & Agreements

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/smartflow/agreements` | List all legal agreements. |
| `POST` | `/api/v1/smartflow/agreements/generate` | Generate a legal agreement draft using AI. |
| `POST` | `/api/v1/smartflow/agreements/review` | AI-driven legal review of a contract. |
| `POST` | `/api/v1/smartflow/agreements/{id}/sign` | Digitally sign a generated agreement. |
| `GET` | `/api/v1/smartflow/agreements/{id}/pdf` | Download signed agreement PDF. |
| `POST` | `/api/v1/smartflow/leases/renew` | Extend or renew an existing lease. |

---

### Calendar & Scheduling

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/calendar/schedule` | Schedule a new meeting and trigger notifications (Push, Email, SMS). |

---

### Communication & Integrations

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/smartflow/calls` | List call logs and AI summaries. |
| `POST` | `/api/v1/smartflow/calls/outbound` | Initiate an AI-driven outbound call. |
| `GET` | `/api/v1/smartflow/calls/{id}/transcript` | Get full AI call transcript. |
| `GET` | `/api/v1/smartflow/integrations/catalog` | View available platform integrations. |
| `POST` | `/api/v1/smartflow/integrations` | Connect a new integration (Telegram, WhatsApp). |

---

### Dashboard API

Hosted on Port `8001` with prefix `/api/v1/dashboard`.

#### Admin Endpoints (`/admin`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/summary` | Aggregate metrics for the organization. |
| `GET` | `/users` | Paginated list of organization users. |
| `PATCH` | `/users/{id}/status` | Block or unblock a user. |
| `GET` | `/earnings` | Financial summary and transaction history. |
| `GET` | `/ai/stats` | AI usage performance and cost monitoring. |
| `GET` | `/chats` | Support inbox management. |

#### Super Admin Endpoints (`/super-admin`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/platform-summary` | Global platform-wide metrics. |
| `GET` | `/global-growth` | Platform-wide growth analytics. |
| `POST` | `/create-admin` | Provision a new organization administrator. |

---

### WebSocket APIs

WebSockets provide real-time updates for chat, notifications, and media streaming.

- `WS /api/v1/smartflow/ws/inbox?token=<token>`: Global inbox updates.
- `WS /api/v1/smartflow/ws/conversations/{id}?token=<token>`: Thread-specific updates.
- `WS /api/v1/calls/stream/{call_id}`: Bi-directional Twilio media stream.

---

### AI Command Redirects (SmartFlow)

When using `POST /api/v1/smartflow/ai/chat`, the response may include a `navigation` object for auto-routing:

| Intent | Target Screen | Path |
| :--- | :--- | :--- |
| `invoice` | `CreateInvoice` | `/invoices/create` |
| `lease` | `CreateLease` | `/leases/create` |
| `agreement` | `CreateAgreement` | `/agreements/create` |
| `bulk_message` | `CreateBulkMessage` | `/bulk-messages/create` |
| `calendar` | `CreateCalendarEvent` | `/calendar/events/create` |

---

### Support & Feedback

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/smartflow/support/tickets` | Submit a support ticket. |
| `POST` | `/api/v1/smartflow/reports` | Submit a bug or feature report. |
| `GET` | `/api/v1/smartflow/notifications` | Fetch unread alerts and messages. |

---

## Integration Notes

- **CORS**: Ensure `CORS_ORIGINS` in `.env` includes the frontend domain.
- **File Uploads**: Use `multipart/form-data` for avatars, logos, and voice chat uploads.
- **Rate Limiting**: Auth routes have a default limit (20 req / 60 sec).
- **Twilio**: Publicly accessible URL is required for TwiML webhooks and media streams.
- **OpenAI**: `OPENAI_API_KEY` is required for production-grade AI features.
