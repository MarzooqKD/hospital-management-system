# Deployment

This is a **portfolio/demo deployment** — a public URL for showing the
project to others (interviews, presentations, stakeholders), running on free
hosting tiers with synthetic data only. It is explicitly **not** the "real
hospital pilot" track: that would additionally require Phase 5 hardening, a
security review against Ghana's Data Protection Act (Act 843), backups,
uptime commitments, and is a separate, much larger effort. Decided with the
user 2026-10-28 — see `CLAUDE.md` §13 (synthetic data only) and §14/§16
(future-features boundary) for why this distinction matters.

## Shape

Three independent free-tier services, each owning one layer:

```
Vercel (frontend, static)  →  Render (backend, Django+DRF via gunicorn)  →  Neon (Postgres)
https://<project>.vercel.app   https://<service>.onrender.com/api/v1        (connection string only)
```

They're on three different providers, not one, because **Render's free
Postgres expires 30 days after creation** (14-day grace period, then
deletion) — unacceptable for anything meant to stay up. Neon's free Postgres
has no expiry; it autosuspends when idle and resumes on the next connection,
which is a cold-start cost, not a data-loss risk. Render's free *web
service* (as opposed to its database) doesn't have this expiry problem, so
the backend stays there.

## Known limitations of this setup (expected, not bugs)

- **Backend cold start**: Render's free web service spins down after ~15
  minutes with no traffic and takes up to a minute to wake on the next
  request. The first request after a quiet period will be slow or briefly
  time out — reload once.
- **Database cold start**: Neon's free compute autosuspends when idle;
  the first query after a quiet period adds a short delay.
- **Neon free storage cap**: 0.5 GB. Fine for synthetic demo data; not a
  concern unless the seed data grows substantially.
- **No backups** on either free tier. Acceptable because the only data
  living here is synthetic demo data (CLAUDE.md §13) — never put real
  patient data on this deployment.
- **Vercel Hobby plan** is for non-commercial personal use, which this
  qualifies as (a personal portfolio demo).

## 1. Database — Neon

1. Create a free account/project at Neon, region closest to wherever the
   backend will run.
2. Copy the connection string it gives you (starts `postgresql://...`,
   includes `?sslmode=require`). That whole string is `DATABASE_URL` below
   — Django reads it via `django-environ`'s `env.db()`, which already
   understands `sslmode` as a query param, so no code change was needed.

## 2. Backend — Render

Create a new **Web Service**, connected to this repo's GitHub remote, root
directory `backend/`.

| Setting | Value |
|---|---|
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate` |
| Start Command | `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` |
| Runtime | Python 3 |

Environment variables (Render dashboard → Environment, not committed to the
repo):

| Variable | Value |
|---|---|
| `DJANGO_SECRET_KEY` | a long random string — generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"`, never reuse the dev one |
| `DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | `<service>.onrender.com` |
| `DATABASE_URL` | the full Neon connection string from step 1 |
| `CORS_ALLOWED_ORIGINS` | `https://<project>.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://<service>.onrender.com` |

`CSRF_TRUSTED_ORIGINS` matters for the Django admin's session-cookie login
(the JWT-authenticated API itself doesn't use CSRF). `SECURE_PROXY_SSL_HEADER`
is already set in `backend/config/settings.py` so Django correctly detects
HTTPS behind Render's proxy — without it, `SECURE_SSL_REDIRECT` would loop.

After the first successful deploy, seed RBAC demo data once via Render's
shell (Dashboard → Shell tab on the service):

```
python manage.py seed_rbac
```

## 3. Frontend — Vercel

Create a new project from the same GitHub repo, root directory `frontend/`.

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<service>.onrender.com/api/v1` |

`frontend/vercel.json` rewrites every path to `index.html` — required
because the app uses `BrowserRouter`; without it, refreshing on e.g.
`/patients/5` 404s.

## Verifying it worked

- `https://<service>.onrender.com/api/v1/health/` → `{"status":"ok","database":"connected"}`
- `https://<project>.vercel.app` → login page loads, and a seeded demo
  account (see `docs/DEVELOPMENT.md` for the list) can log in.

## Local production smoke test (already run once, 2026-10-28)

Before wiring up the actual hosting accounts, the production path was
verified locally: `collectstatic` (154 files, whitenoise manifest storage),
then `gunicorn config.wsgi:application` against the real local Postgres
(not `runserver`) with `DEBUG` unset, confirmed `GET /api/v1/health/` →
`200 {"status":"ok","database":"connected"}`, then the full `pytest` suite
(84 tests) re-run and still green with the new middleware/settings in place.
