# Mabdel Backend API

Mabdel Backend API is a FastAPI service that powers authentication, onboarding, app bootstrap, permissions, invoicing, and SmartFlow communication workflows for the future Mabdel client applications.

This repository contains backend-only code. It is prepared so a frontend or mobile developer can integrate against a stable API contract without needing to reverse-engineer the service internals.

## Project Overview

- Framework: FastAPI
- Primary datastore: MongoDB via Motor
- Auth model: JWT access and refresh tokens with OTP verification
- API documentation:
  - Swagger UI: `/docs`
  - ReDoc: `/redoc`
  - OpenAPI JSON: `/openapi.json`
  - Static reference: [docs/backend.md](docs/backend.md)
  - OpenAPI snapshot: [docs/openapi.json](docs/openapi.json)

## Backend Tech Stack

- Python 3.12+
- FastAPI
- Uvicorn
- Motor / MongoDB
- Pydantic v2
- `python-jose` for JWT handling
- `passlib` + `bcrypt` for password hashing
- `resend` and SMTP-compatible email delivery
- LangGraph for AI command workflow routing
- Pytest + `mongomock-motor` for API tests

## Installation

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

## Run Locally

1. Copy `.env.example` to `.env`.
2. Set the required environment variables.
3. Start MongoDB locally, or point `MONGODB_URI` at a remote instance.
4. Run the API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Base URL while running locally:

```text
http://127.0.0.1:8000
```

Health checks:

```text
GET /health
GET /ready
```

Optional Streamlit API console:

```bash
streamlit run streamlit_app.py
```

The console defaults to `http://127.0.0.1:8000` and lets you log in, inspect SmartFlow data, test Unified Conversations, integrations, invoices, leases, agreements, calls, notifications, and AI workflow prefill.

## Environment Variables

Important variables are documented in [.env.example](.env.example). The most important ones are:

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_NAME` | No | Displayed in API docs |
| `ENVIRONMENT` | No | `development`, `staging`, or `production` |
| `DEBUG` | No | Enables FastAPI debug behavior |
| `PUBLIC_BACKEND_URL` | No | Public base URL used in docs and callback flows |
| `MEDIA_ROOT` / `MEDIA_PUBLIC_PATH` | No | Local media storage and public path for uploaded business logos |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `DATABASE_NAME` | Yes | MongoDB database name |
| `SECRET_KEY` | Yes | JWT signing key |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | Recommended | Encrypts third-party integration tokens |
| `GOOGLE_CLIENT_ID` | Required for Google login | Verifies mobile/web Google ID tokens |
| `OPENAI_API_KEY` | Required for live AI | Enables production AI generation, review, and voice-assisted flows |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Optional | Twilio Voice webhook and media stream integration |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio number used by the backend integration |
| `MAIL_FROM` | Recommended | Sender email address |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | Required in production unless using Resend/Mailtrap | SMTP delivery configuration |
| `RESEND_API_KEY` / `MAILTRAP_API_TOKEN` | Required in production unless using SMTP | Email delivery fallback |
| `FCM_SERVER_KEY` | Required for Android/web push | Firebase Cloud Messaging delivery |
| `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` / `APNS_PRIVATE_KEY` | Required for iOS push | Apple Push Notification service delivery |
| `CORS_ORIGINS` | Yes for frontend integration | Allowed browser origins |
| `TRUSTED_HOSTS` | Recommended | Allowed host headers |

## API Base URL

- Local: `http://127.0.0.1:8000`
- Versioned API prefix: `/api/v1`
- Full local API base URL: `http://127.0.0.1:8000/api/v1`

## Available Endpoints

High-level endpoint groups:

- Health: `/health`, `/ready`
- Auth: `/api/v1/auth/*`
- App bootstrap: `/api/v1/app/config`
- Onboarding: `/api/v1/onboarding/*`
- Public content: `/api/v1/content/*`
- Permissions: `/api/v1/app/permissions*`
- AI helpers: `/api/v1/ai/command`, `/api/v1/email/draft`, `/api/v1/calendar/schedule`, `/api/v1/groups`
- Twilio voice: `/api/v1/calls/incoming`, `/api/v1/calls/status`, `/api/v1/calls/stream/{call_id}`, `/api/v1/smartflow/calls/outbound`
- Invoices: `/api/v1/invoices*`
- SmartFlow: `/api/v1/smartflow/*`
- Compatibility routes: `/api/*`

For the full endpoint inventory, request payloads, and integration notes, see [docs/backend.md](docs/backend.md) or open [docs/openapi.json](docs/openapi.json).

Frontend integration note:

- Contacts screens are backed by dedicated SmartFlow contacts APIs for list/search, add, detail, edit/delete, avatar upload, online status, and mobile-form fields like DOB, address, and notes.
- Call history screens are backed by 13 SmartFlow call APIs for search/filter, detail, callback/outbound calls, recording metadata, transcript, AI summary, repeat counts, and mobile-ready display labels.
- Group screens are backed by dedicated SmartFlow group APIs for list, detail, member management, pending invites, leave/delete actions, and realtime chat payloads with structured attachments and mentions.
- Settings/profile screens are backed by content pages, profile settings, profile avatar upload, notification toggles, business profile, subscription, live support chat, report/support tickets, password flows, logout, and account deletion APIs.
- Agreements screens are backed by dedicated SmartFlow agreement APIs for list/search/filter, AI draft generation, AI improve/review, create/edit/delete, preview, send/signature flows, public signing links, renewal, and PDF export.
- Lease document screens are backed by 17 dedicated SmartFlow lease APIs for metadata, list/search/filter cards, AI generation, AI review/fix, draft save, preview/edit/delete, signature flows, renewal, and PDF export.

## Request / Response Examples

Register a user:

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "full_name": "Arik Hasan",
  "email": "arik@example.com",
  "password": "SecurePass2024!"
}
```

Example response:

```json
{
  "success": true,
  "message": "Registration completed. OTP sent successfully.",
  "data": {
    "message": "Registration completed. OTP sent successfully.",
    "reset_token": null
  }
}
```

Login:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "arik@example.com",
  "password": "SecurePass2024!"
}
```

Example response:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "access_token": "<jwt-access-token>",
    "refresh_token": "<jwt-refresh-token>",
    "token_type": "bearer",
    "user": {
      "id": "user_id",
      "full_name": "Arik Hasan",
      "email": "arik@example.com",
      "is_verified": true,
      "auth_provider": "email",
      "avatar_url": null,
      "language_preference": "EN",
      "created_at": "2026-05-04T10:00:00Z"
    }
  }
}
```

Authenticated request example:

```http
GET /api/v1/auth/me
Authorization: Bearer <jwt-access-token>
```

Outbound call example:

```http
POST /api/v1/smartflow/calls/outbound
Authorization: Bearer <jwt-access-token>
Content-Type: application/json

{
  "phone_number": "+8801700000000"
}
```

## Authentication Flow

1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/verify-otp`
3. `POST /api/v1/auth/login`
4. Use the returned bearer access token for protected routes
5. Refresh with `POST /api/v1/auth/refresh-token` when the access token expires
6. Revoke the current session with `POST /api/v1/auth/logout`

## Testing

Run the backend test suite:

```bash
python -m pytest -q
```

## Deployment Notes

- The service is stateless; application sessions are token-based.
- MongoDB is required in every environment.
- Set a strong `SECRET_KEY` outside development.
- Set `OAUTH_TOKEN_ENCRYPTION_KEY` outside development if social integrations are enabled.
- Set `GOOGLE_CLIENT_ID` before enabling `/api/v1/auth/google`.
- Configure SMTP, Resend, or Mailtrap before production OTP/email delivery; non-development environments fail fast if no provider is configured.
- Set `OPENAI_API_KEY` before relying on AI-generated production output.
- Set `PUBLIC_BACKEND_URL` to a public HTTPS domain before connecting Twilio Media Streams.
- Use persistent storage or an external volume for `MEDIA_ROOT` if business logo uploads are enabled.
- Set `TWILIO_AUTH_TOKEN` and keep `TWILIO_VALIDATE_SIGNATURE=true` in non-development environments.
- Configure `FCM_SERVER_KEY` and APNs credentials before enabling push notifications for real devices.
- Lock down `CORS_ORIGINS` and `TRUSTED_HOSTS` in staging and production.
- Mount the app behind a reverse proxy or load balancer and expose only the API port.
- Use the `/ready` endpoint for container readiness checks.

### Vercel

This repo includes `api/index.py` and `vercel.json` so Vercel can run the FastAPI app as a Python Serverless Function.

Set these Vercel environment variables before deploying a production project:

- `MONGODB_URI`
- `DATABASE_NAME`
- `SECRET_KEY`
- `OAUTH_TOKEN_ENCRYPTION_KEY` when `ENVIRONMENT` is not `development`
- `CORS_ORIGINS`, for example `["https://your-frontend.vercel.app"]`
- `TRUSTED_HOSTS`, for example `["your-api.vercel.app",".vercel.app"]`
- Any optional provider keys you actively use, such as `OPENAI_API_KEY`, `RESEND_API_KEY`, Twilio, FCM, or APNs credentials

On Vercel, `MEDIA_ROOT` defaults to `/tmp/mabdel-uploads` because the function filesystem is read-only except for temporary storage. Files in `/tmp` are ephemeral, so use external object storage before relying on uploads in production.

## Docker

```bash
docker compose up --build
```

This starts:

- `api`
- `mongo`
