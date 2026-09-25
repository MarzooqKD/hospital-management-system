# Development

## Setup

```
cp .env.example .env        # fill in real values; never commit .env
docker compose up --build
```

- Backend: http://localhost:8000/api/v1/health/
- API docs: http://localhost:8000/api/v1/docs/
- Frontend: http://localhost:5173

Backend and frontend source are volume-mounted into their containers, so
edits hot-reload without a rebuild. Rebuild (`--build`) only after changing
`requirements.txt`, `package.json`, or a Dockerfile.

## Local backend without Docker (optional)

Requires a reachable Postgres — either the `db` service from
`docker compose up db`, or your own instance matching `DATABASE_URL` in `.env`.
If you're running Postgres natively (e.g. `brew install postgresql@16`), the
role needs `CREATEDB` so `pytest-django` can create its test database —
Docker's official `postgres` image grants this automatically via
`POSTGRES_USER`, but a manually-created local role won't have it by default:

```
psql -d postgres -c "CREATE ROLE hms WITH LOGIN PASSWORD '...' CREATEDB;"
psql -d postgres -c "CREATE DATABASE hms OWNER hms;"
```

Then, pointing `DATABASE_URL` at your local instance (`localhost` instead of
the Compose `db` hostname):

```
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="psql://hms:<password>@localhost:5432/hms"
python manage.py migrate
python manage.py seed_rbac    # 9 roles + one demo account each, see below
python manage.py runserver
```

`seed_rbac` prints the demo accounts it creates (`system_admin@demo.hms.gh`,
`receptionist@demo.hms.gh`, etc., all sharing one dev-only password it
prints to stdout) — clearly-fake accounts for exercising the login/RBAC
flow locally, never real staff data (CLAUDE.md §13). It also seeds two demo
departments ("General Outpatient", "Maternity") under the one demo
hospital, needed to book an appointment through the UI. It also seeds a
small lab test catalogue and medication catalogue with matching starting
`InventoryItem` stock (e.g. 500 Paracetamol tablets), plus one demo
ward/room/two beds so the admissions flow has somewhere to admit a
patient to — none of this is a real Ghanaian hospital's actual
test/formulary/ward list, just enough reference data to exercise the
Phase 3 flows locally without every developer hand-creating it. It's
re-run-safe — `get_or_create` throughout — so re-running it after a
permission-matrix change updates existing roles' grants without
duplicating accounts or catalogue rows.

The login screen asks for a Role alongside email/password — it's a UX
confirmation, not a credential: the real login is still email+password
against the backend, and the account's actual `Role` (from `seed_rbac`
above) is what governs access either way. If the role you pick doesn't
match the account you're signing into, the frontend signs you back out and
shows a mismatch message rather than letting you into the wrong role's
view — see `frontend/src/pages/Login.tsx`.

## Tests

```
cd backend && pytest
cd frontend && npm test
```

Playwright end-to-end tests run against the full Compose stack — added once
there's a real user flow to exercise (Phase 1+).

## Conventions

- Cycle per feature: Analyze → Plan → Implement → Test → Fix → Re-test →
  Document → Commit (CLAUDE.md §11).
- One module / vertical slice at a time — never the whole app in one pass.
- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`), one
  logical change per commit.
- Update `docs/` alongside the code that makes it true, not after the fact.
- Never claim a feature works without having actually run it.
