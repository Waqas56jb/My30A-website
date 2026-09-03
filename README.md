# My30A Ops

Back-office/operations system for My30A Host.

## Structure

- `server/` — Node + Express API (port 4000)
- `admin/` — Admin panel (Vite + React, port 5174)
- `client/` — Driver, Partner, and Shopper panels (Vite + React, port 5173)
- `supabase/` — Database migrations

## Run

Copy `.env.example` to `.env` in `server/`, `admin/`, and `client/` before the first run.

Production deploy (three Vercel projects): see [DEPLOY.md](./DEPLOY.md).

From the repo root (after `npm install` here and in `server/`, `admin/`, `client/`):

```powershell
npm run dev
```

That starts the API (`http://localhost:4000`), admin (`http://localhost:5174`), and client (`http://localhost:5173`). Or use three terminals:

```powershell
cd server
npm run dev
```

API: http://localhost:4000

```powershell
cd admin
npm run dev
```

Admin: http://localhost:5174

```powershell
cd client
npm run dev
```

Driver / Partner / Shopper: http://localhost:5173

## Handover

### First admin

```powershell
cd server
$env:ADMIN_EMAIL="you@example.com"
$env:ADMIN_PASSWORD="your-password"
node scripts/create-admin.js
```

Then sign in at http://localhost:5174. This is the only login that is not created from People.

### Add people

In the admin panel go to **People → Add person**. Pick Driver / Shopper / Partner (or more than one). A temporary password is shown once on screen. Leave **Email login details to this person** checked to send subject `Your My30A Host login` (name, login URL, email, temporary password, and “Please change your password after signing in.”). Drivers and shoppers also need a compensation rate. Vehicle owner fee is set per vehicle, not here.

Staff sign in at http://localhost:5173. Admins sign in at http://localhost:5174. Anyone can change their password after login (admin sidebar, or the avatar menu on the client app).

### Reset test data

Deletes every `@my30a.test` auth user (profiles cascade) and rows that reference them: transfers, trip/grocery status logs, grocery orders, payouts, payout items, notifications, GPS points, compensation agreements, and vehicles they own. Grocery upload files for those orders are removed. Communities, transfer pricing, settings, and real admin accounts (any email not ending in `@my30a.test`) are kept.

```powershell
cd server
npm run reset:test
```

That passes `--confirm`. The script prints a summary, then deletes. Do not run it until you are ready to wipe test users.

### Environment variables

**`server/.env`**

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `SUPABASE_JWT_SECRET` | JWT secret for verifying access tokens |
| `SUPABASE_POOLER_URL` | Postgres connection string for `npm run migrate` |
| `CLIENT_URL` | CORS allowlist (comma-separated origins) |
| `CLIENT_APP_URL` | Login link in welcome emails for driver / partner / shopper |
| `ADMIN_APP_URL` | Login link in welcome emails for admin |
| `STRIPE_SECRET_KEY` | Stripe (optional; card capture skipped if empty) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` | Outbound mail |
| `SMTP_USER` `SMTP_PASSWORD` | SMTP auth |
| `SMTP_FROM` `OFFICIAL_EMAIL` | From address |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window in ms (default `900000`) |
| `RATE_LIMIT_MAX` | Max requests per window (default `300`) |

**`admin/.env` and `client/.env`**

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Same project URL as the server |
| `VITE_SUPABASE_ANON_KEY` | Anon key for browser auth |
| `VITE_API_URL` | API origin, e.g. `http://localhost:4000` |

`ADMIN_EMAIL` / `ADMIN_PASSWORD` are one-off env vars for `create-admin.js` only — not stored in `.env`.

## API

- `GET /health` — API liveness
- `POST /api/auth/change-password` — signed-in user; `{ current_password, new_password }` (min 8)
- `POST|GET|PATCH /api/users` — admin user create/list/update; `POST /:id/reset-password` (`send_email: true` emails login details)
- `GET|PATCH /api/settings` — platform and owner fee percents
- `GET|POST|PATCH /api/vehicles` — vehicles + owner
- `GET /api/compensation/user/:userId` — agreements + current; `POST /api/compensation` insert history
- `GET /api/communities` — active communities; `GET /pricing` and `/pricing/all`
- `POST|GET|PATCH /api/transfers` — admin trip CRUD; driver `/mine`, start/complete; partner `/vehicle-owner`
- `POST|GET|PATCH /api/grocery` — admin grocery CRUD; shopper `/mine`, shopping / on-the-way / deliver
- `GET /api/payouts/owed` — unpaid summaries (pending+paid items excluded) + `pending_total`; `POST /api/payouts` generate; `POST /:id/mark-paid`
- `GET /api/earnings/mine` — driver/shopper totals; `/vehicle-owner` partner; `/admin/summary`
- `GET /api/notifications/mine` — own notifications; `PATCH /:id/read`, `POST /read-all`
