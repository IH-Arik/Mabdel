# OAuth Integration Status

This project already has OAuth entrypoints for several providers, but the real rollout status differs by provider because of app review, allowlisting, and access-tier constraints.

## Ready in code

- LinkedIn OAuth connect flow
- Meta OAuth connect flow for Instagram, Messenger, and WhatsApp
- X OAuth connect flow with PKCE
- Snapchat OAuth connect shell

## Can be completed without paid API access

### LinkedIn

- Status: usable
- Backend flow: supported
- Credentials: self-serve in LinkedIn Developer Portal
- Env vars:
  - `LINKEDIN_CLIENT_ID`
  - `LINKEDIN_CLIENT_SECRET`
  - `LINKEDIN_REDIRECT_URI`

Current backend scopes: `openid profile email w_member_social`

### Meta / Instagram / Messenger

- Status: partially usable
- Backend flow: supported
- Credentials: self-serve app creation
- Production access for public users: commonly blocked until Meta App Review / advanced access / business verification
- Env vars:
  - `META_CLIENT_ID`
  - `META_CLIENT_SECRET`
  - `META_INSTAGRAM_REDIRECT_URI`
  - `META_MESSENGER_REDIRECT_URI`
  - `META_WHATSAPP_REDIRECT_URI`
  - `META_WEBHOOK_VERIFY_TOKEN`

This is suitable for local testing and internal QA before review.

### X

- Status: connect flow is now technically valid
- Backend flow: supported
- Credentials: self-serve developer app
- Public API capability: still depends on current X access tier
- Env vars:
  - `TWITTER_CLIENT_ID`
  - `TWITTER_CLIENT_SECRET`
  - `TWITTER_REDIRECT_URI`

The backend now generates a real PKCE verifier/challenge pair for X OAuth.

## Still blocked by provider approval or allowlisting

### Snapchat

- Status: full sync is not realistically finishable without provider approval
- Backend flow: present
- Message sync: blocked by provider allowlisting and profile/conversation metadata requirements
- Env vars:
  - `SNAPCHAT_CLIENT_ID`
  - `SNAPCHAT_CLIENT_SECRET`
  - `SNAPCHAT_REDIRECT_URI`

The current code path targets Snap marketing/public profile style access rather than a simple login-only integration.

## Recommended rollout order

1. LinkedIn
2. Meta Instagram
3. Meta Messenger / WhatsApp
4. X
5. Snapchat

## Suggested local `.env` block

```env
PUBLIC_BACKEND_URL=http://127.0.0.1:8000

META_CLIENT_ID=
META_CLIENT_SECRET=
META_INSTAGRAM_REDIRECT_URI=http://127.0.0.1:8000/api/v1/smartflow/integrations/instagram/oauth/callback
META_MESSENGER_REDIRECT_URI=http://127.0.0.1:8000/api/v1/smartflow/integrations/facebook_messenger/oauth/callback
META_WHATSAPP_REDIRECT_URI=http://127.0.0.1:8000/api/v1/smartflow/integrations/whatsapp/oauth/callback
META_WEBHOOK_VERIFY_TOKEN=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://127.0.0.1:8000/api/v1/smartflow/integrations/linkedin/oauth/callback

TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_REDIRECT_URI=http://127.0.0.1:8000/api/v1/smartflow/integrations/twitter_x/oauth/callback

SNAPCHAT_CLIENT_ID=
SNAPCHAT_CLIENT_SECRET=
SNAPCHAT_REDIRECT_URI=http://127.0.0.1:8000/api/v1/smartflow/integrations/snapchat/oauth/callback
```
