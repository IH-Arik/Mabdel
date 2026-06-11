# Backend-Only APIs (Implemented in Backend but missing in Frontend)

This report lists all the backend endpoints that are implemented in the FastAPI backend but are **never declared or used** anywhere in the frontend codebases.

**Total Backend-only APIs:** 28

| Method | API Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/calls/recording` | Admin feature / webhook / system route |
| `POST` | `/api/v1/calls/{call_sid}/action` | Admin feature / webhook / system route |
| `POST` | `/api/v1/dashboard/admin/auth/forgot-password` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/auth/reset-password` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/auth/verify-otp` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/change-password` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/admin/chats/{user_id}/messages` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/chats/{user_id}/messages` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/create-admin` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}/invoice` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/logout` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/admin/profile` | Admin dashboard service |
| `PATCH` | `/api/v1/dashboard/admin/profile` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/admin/settings` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/admin/settings/content` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/settings/content` | Admin dashboard service |
| `POST` | `/api/v1/dashboard/admin/subscriptions` | Admin dashboard service |
| `GET` | `/api/v1/dashboard/notifications/` | Admin feature / webhook / system route |
| `GET` | `/api/v1/dashboard/notifications/unread-count` | Admin feature / webhook / system route |
| `POST` | `/api/v1/dashboard/notifications/{notification_id}/read` | Admin feature / webhook / system route |
| `GET` | `/api/v1/dashboard/super/global-growth` | Super Admin service |
| `GET` | `/api/v1/dashboard/super/platform-summary` | Super Admin service |
| `POST` | `/api/v1/dashboard/webhooks/stripe` | Webhook Callback |
| `HEAD` | `/docs/oauth2-redirect` | Admin feature / webhook / system route |
| `GET` | `/docs/oauth2-redirect` | Admin feature / webhook / system route |
| `GET` | `/health` | Admin feature / webhook / system route |
| `GET` | `/ready` | Admin feature / webhook / system route |
