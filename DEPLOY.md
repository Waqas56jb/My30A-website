# Deploy My30A Ops

Three Vercel projects from this one repo (current production):

| App | Root directory | URL |
|---|---|---|
| API | `server` | https://my30-a-website-server.vercel.app |
| Admin | `admin` | https://my30-a-website-admin.vercel.app |
| Client | `client` | https://my30-a-website-client.vercel.app |

Health: https://my30-a-website-server.vercel.app/api/health and `/health`.

Vite production builds read `admin/.env.production` and `client/.env.production`. After you push, **Redeploy** admin and client so those values are baked in. The API still needs secrets in the Vercel dashboard (they are not in git).

---

## 1. Vercel — API (`server`)

Root Directory = `server`. `server/vercel.json` sends every path to the Express app in `api/index.js`.

**Environment variables** (Production + Preview):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | `https://vfsjncvvizjmdqwstksx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service role** key (server only) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase → Settings → API |
| `SUPABASE_POOLER_URL` | Postgres pooler URI |
| `CLIENT_URL` | `https://my30-a-website-client.vercel.app,https://my30-a-website-admin.vercel.app` |
| `CLIENT_APP_URL` | `https://my30-a-website-client.vercel.app` |
| `ADMIN_APP_URL` | `https://my30-a-website-admin.vercel.app` |
| `STRIPE_SECRET_KEY` | Optional |
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | SMTP login |
| `SMTP_PASSWORD` | SMTP password |
| `SMTP_FROM` | `My30A Host <you@example.com>` |
| `OFFICIAL_EMAIL` | From address if `SMTP_FROM` is empty |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `300` |

Redeploy after saving variables. Confirm https://my30-a-website-server.vercel.app/api/health returns `{"ok":true}`.

Railway (`server/railway.json`) is optional if you later move the API off Vercel.

---

## 2. Migrate once (not on boot)

```powershell
cd server
npm run migrate
```

Uses `SUPABASE_POOLER_URL` from `server/.env`. Then create the first admin if needed:

```powershell
$env:ADMIN_EMAIL="you@example.com"
$env:ADMIN_PASSWORD="your-password"
node scripts/create-admin.js
```

---

## 3. Vercel — admin (`admin`)

Root Directory = `admin`. Framework Vite. `admin/vercel.json` rewrites routes to `index.html` (refresh never 404s).

`admin/.env.production` already has:

```
VITE_SUPABASE_URL=https://vfsjncvvizjmdqwstksx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_URL=https://my30-a-website-server.vercel.app
```

You can also paste the same three into Vercel → Settings → Environment Variables (Production + Preview), then Redeploy.

---

## 4. Vercel — client (`client`)

Root Directory = `client`. Same three `VITE_*` values as admin (in `client/.env.production`). Redeploy after this push.

---

## 5. Supabase Auth URLs

Authentication → URL configuration:

- Site URL: `https://my30-a-website-client.vercel.app`
- Redirect URLs:
  - `https://my30-a-website-admin.vercel.app/**`
  - `https://my30-a-website-client.vercel.app/**`
  - `http://localhost:5173/**`
  - `http://localhost:5174/**`

---

## Local `.env`

**`admin/.env` and `client/.env`** (dev — gitignored):

```
VITE_SUPABASE_URL=https://vfsjncvvizjmdqwstksx.supabase.co
VITE_SUPABASE_ANON_KEY=<same anon key>
VITE_API_URL=http://localhost:4000
```

**`server/.env`** keeps your secrets. CORS / email URLs should include the Vercel origins (see `server/.env.example`).
