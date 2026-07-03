# WhatsApp Broadcaster

Schedule and broadcast WhatsApp messages to contact lists via the official **WhatsApp Cloud API** (Meta Business). Messages are sent as 1:1 DMs (broadcast), not into chat groups.

## Features

- Schedule campaigns to run at a future time, or send immediately
- Broadcast to contact lists (up to 10k recipients per campaign) using approved templates
- Rate limiting per WhatsApp phone number (configurable, default 250/min)
- Exponential backoff retries for transient errors (429, 5xx)
- Per-recipient status tracking via webhooks (sent / delivered / read / failed)
- Contact management with bulk CSV import, search, tags
- **React + Vite dashboard**: login by email/password, CSV upload, template editor with live preview, scheduling, live campaign status
- **User auth**: JWT login (bcrypt password hashing), admin auto-seeded from env
- Postgres + Redis in production, SQLite in development
- Docker / docker-compose ready (builds frontend inside image)
- Webhook signature verification (HMAC SHA-256)

## Architecture

```
Dashboard (public/) ─▶ Express API ─▶ Prisma (Postgres/SQLite)
                          │
                          ▼
                       Redis (BullMQ)
                          │
                ┌─────────┴──────────┐
                ▼                    ▼
        Campaign Worker      Message Worker (rate-limited)
                                    │
                                    ▼
                          WhatsApp Cloud API
                                    │
                                    ▼
                          Webhook → status updates
```

The API enqueues a campaign job scheduled for `scheduledAt`. The campaign worker splits it into per-recipient message jobs that flow through a rate-limiter queue (N messages/min per WA number) before calling the Meta API.

## Quick start (development)

### Prerequisites

- Node 20+
- Redis (`docker run -p 6379:6379 redis:7-alpine` or local install)

### Steps

```bash
npm install
cp .env.example .env
# fill in WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN (see below)
# set ADMIN_EMAIL / ADMIN_PASSWORD for dashboard login
npm run prisma:generate
npm run prisma:migrate      # creates SQLite dev.db
npm run seed                # optional: sample contacts

# Build the React frontend
npm run build:frontend

# terminal 1: API server (serves dist/ in production mode)
NODE_ENV=production npm start
# terminal 2: worker
npm run start:worker
```

For development with hot-reload on the frontend:
```bash
# terminal 1: API server (dev mode, serves public/)
npm run dev
# terminal 2: worker
npm run dev:worker
# terminal 3: Vite dev server (proxies /api to :3000)
npm run dev:frontend  # open http://localhost:5173
```

The admin user is auto-created on first boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Log in at the dashboard.

## Getting WhatsApp Cloud API credentials

1. Go to https://developers.facebook.com/ → **My Apps** → **Create App** → Business.
2. Add product **WhatsApp**.
3. In **WhatsApp → API Setup**, copy:
   - `Phone number ID` → `WHATSAPP_PHONE_NUMBER_ID`
   - Generate a **permanent access token** (System User) → `WHATSAPP_ACCESS_TOKEN`
4. In **WhatsApp → Configuration**, set the webhook:
   - Callback URL: `https://<your-domain>/api/webhook`
   - Verify token: any string → set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` to the same value
   - Subscribe to fields: `messages` (status callbacks)
5. Set `WHATSAPP_APP_SECRET` (App settings → Basic) to enable signature verification.
6. **Create and approve message templates** (WhatsApp → Message Templates). Templates must be approved before you can send. Use the approved template `name` and `language` in campaigns.

## Production deployment

```bash
cp .env.example .env   # fill all WHATSAPP_* and set POSTGRES_PASSWORD, API_KEY
docker compose up -d --build
```

This starts Postgres, Redis, the API server, and the worker. Prisma migrations run automatically on API boot.

For zero-downtime, run API and worker as separate services/replicas. The worker is horizontally scalable (BullMQ distributes jobs).

## API reference

Base: `/api`. Protected routes require either an `API_KEY` (Bearer or query) if set, or a JWT from `/auth/login` when no `API_KEY` is configured.

### Auth

`POST /api/auth/login` — `{ email, password }` → `{ token, user }`
`GET /api/auth/me` — returns current user (requires JWT)
`POST /api/auth/register` — bootstrap first admin (only works if no users exist)

### Campaigns

`POST /api/campaigns` — create + schedule
```json
{
  "name": "Promo viernes",
  "templateName": "hello_world",
  "templateLanguage": "es",
  "components": [],
  "scheduledAt": "2026-07-10T18:00:00Z",
  "phones": ["34600000000", "34611111111"]
}
```
`components` follows the Meta template components schema, e.g.:
```json
[
  {
    "type": "body",
    "parameters": [
      { "type": "text", "text": "María" }
    ]
  }
]
```
You can pass `contactIds` (array of contact IDs) instead of `phones`.

`GET /api/campaigns` — list (last 100, with counts)
`GET /api/campaigns/:id` — detail with recipients
`GET /api/campaigns/:id/stats` — status breakdown
`POST /api/campaigns/:id/cancel` — cancel a scheduled/running campaign

### Contacts

`GET /api/contacts?q=&tag=&limit=&offset=` — list/search
`POST /api/contacts` — `{ phone, name?, tags? }` (phone digits only, with country code, no `+`)
`POST /api/contacts/bulk` — `{ contacts: [...] }` (up to 50k, skips duplicates)
`DELETE /api/contacts/:id`

### Webhook (public)

`GET /api/webhook` — Meta verification (`hub.mode`, `hub.verify_token`, `hub.challenge`)
`POST /api/webhook` — status callbacks; verified via `x-hub-signature-256`

### Status (public)

`GET /api/status/health` — liveness (db, redis, whatsapp configured)
`GET /api/status/stats` — queue + entity counts

## Rate limits & quotas (Meta)

- **Messaging window**: outside a 24h window since the user's last inbound message, you can only send **approved templates**. Within the window, free-form messages are allowed.
- **Tiered limits**: new numbers start at 1k business-initiated conversations / 24h, scaling up as you send quality volume. Tune `WHATSAPP_RATE_LIMIT_PER_MIN` to your tier.
- **Template approval**: required; typically 24-48h review.

## Project structure

```
prisma/
  schema.prisma          data model (SQLite for dev)
  schema.prod.prisma     data model (Postgres for prod)
  seed.js                sample contacts
src/
  config/                env, db (Prisma), redis, logger, seedAdmin
  constants/             status enums
  services/
    whatsapp/            Meta API client, webhook verify, validation, errors
    auth/                bcrypt + JWT helpers
  queue/                 BullMQ queues, campaign + message workers
  api/
    routes/              auth, campaigns, contacts, webhook, status
    middleware/          auth (API key), auth-jwt, errors
    router.js
  server.js              Express app (serves dist/ in prod)
  worker.js              worker process
frontend/                React + Vite dashboard
  src/
    pages/               Login, Contacts, ContactsUpload, CampaignNew, Campaigns, CampaignDetail, Stats
    components/          Toast
    api.js, auth.jsx     API client + auth context
test/                    node:test unit tests
Dockerfile               multi-stage (builds frontend inside)
docker-compose.yml
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | API server with watch (dev) |
| `npm run dev:worker` | Worker with watch |
| `npm run dev:frontend` | Vite dev server (hot reload) on :5173 |
| `npm run build:frontend` | Build React app to `dist/` |
| `npm start` | API server (serves dist/ in prod) |
| `npm run start:worker` | Worker |
| `npm run prisma:migrate` | Create/apply dev migrations |
| `npm run prisma:deploy` | Apply migrations (prod) |
| `npm run seed` | Insert sample contacts |
| `npm test` | Run unit tests (node:test) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Notes & caveats

- WhatsApp Cloud API does **not** support sending into chat groups (where members talk to each other). This app sends broadcast DMs 1:1.
- Keep `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_APP_SECRET` secret. They are redacted in logs.
- The webhook must be reachable from the public internet (use ngrok/smee in dev).
- SQLite is fine for low-volume dev; use Postgres in production (compose sets it up).
