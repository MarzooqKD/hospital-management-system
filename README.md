# Ghana Hospital Management System

A modular Hospital Management System for hospitals and clinics in Ghana —
patient registration through appointment, consultation, laboratory,
pharmacy, admissions, and reporting. See `CLAUDE.md` for the full project brief
and `docs/` for architecture, database, API, security, and roadmap detail.

## Stack

React + Vite + TypeScript · Django + DRF · PostgreSQL · JWT auth · Docker
Compose. See `docs/ARCHITECTURE.md` for the full rationale.

## Quick start

```
cp .env.example .env   # fill in real values
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:8000/api/v1/health/
- API docs (Swagger UI): http://localhost:8000/api/v1/docs/

See `docs/DEVELOPMENT.md` for local (non-Docker) setup, running tests, and
contribution conventions.

## Status

Phase 0a (scaffolding), Phase 0b (auth + RBAC), Phase 1 (patients +
appointments), Phase 2 (queue, vitals, consultation), Phase 3 (laboratory,
pharmacy, inventory), and Phase 4 (admissions, referrals) complete. The
frontend was also redesigned on Tailwind CSS + a shared component library
between Phase 3 and Phase 4 (see `docs/ARCHITECTURE.md` § Design system).
Billing and the Cashier role were built in Phase 4 and later removed
entirely per explicit user decision — see `docs/ROADMAP.md`. See
`docs/ROADMAP.md` for what's next.
