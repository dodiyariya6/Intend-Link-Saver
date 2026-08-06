# Intend Link Saver

An AI-driven link repository that remembers *why* you saved a link.

Implemented so far: project scaffolding, database models/migrations, and
authentication (register/login/JWT). Link CRUD, AI features, and search are
not implemented yet. See `/root/.claude/plans/` (or your own copy of the
architecture plan) for the full design.

## Stack

- **Backend**: FastAPI (Python), SQLAlchemy, Alembic
- **Frontend**: React + TypeScript (Vite)
- **Database**: PostgreSQL with the `pgvector` extension
- **AI**: Anthropic Claude (not yet integrated)

## Project Structure

```
intend-link-saver/
├── backend/          # FastAPI app
│   ├── app/
│   │   ├── main.py       # app entrypoint, health check, router mounting
│   │   ├── config.py     # settings
│   │   ├── db.py         # SQLAlchemy engine/session
│   │   ├── dependencies.py  # get_current_user (JWT auth dependency)
│   │   ├── models/       # User, Link, Tag ORM models
│   │   ├── schemas/      # auth.py implemented; rest (empty) future
│   │   ├── routers/      # auth.py implemented; links/search/tags (empty) future
│   │   ├── services/     # auth_service.py implemented; rest (empty) future
│   │   └── prompts/      # (empty) future Claude prompt templates
│   ├── alembic/          # migrations setup, no migrations yet
│   └── tests/
├── frontend/         # React + Vite app
│   └── src/
│       ├── api/          # (empty) future API client
│       ├── components/   # (empty) future components
│       ├── pages/        # (empty) future pages
│       └── hooks/        # (empty) future hooks
└── docker-compose.yml
```

## Running Locally

### With Docker (recommended)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Backend: http://localhost:8000/health
- Frontend: http://localhost:5173
- Postgres (pgvector): localhost:5432

### Without Docker

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # point DATABASE_URL at a local Postgres if not using Docker
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Database

The `db` Docker service uses the [`pgvector/pgvector`](https://github.com/pgvector/pgvector)
image (Postgres 16 with the `pgvector` extension preinstalled).

### Models

- `User` — accounts (`users`)
- `Link` — saved links, including `user_note`/`ai_reason` (the "why"), `ai_summary`,
  `intent_category`, and the `embedding` vector column used for semantic search (`links`)
- `Tag` — user-defined/AI-generated tags (`tags`), joined to links via `link_tags`

See `backend/app/models/` and the architecture plan for the full schema rationale.

### Running migrations

```bash
cd backend
source .venv/bin/activate   # or however you manage your virtualenv
alembic upgrade head
```

To generate a new migration after changing models:

```bash
alembic revision --autogenerate -m "describe the change"
```

## Authentication

JWT-based auth, implemented in `app/services/auth_service.py` (password
hashing via bcrypt, token issuance/verification) and `app/dependencies.py`
(`get_current_user`, the dependency any future protected router depends on).

| Endpoint | Description |
|---|---|
| `POST /auth/register` | `{ email, password }` → creates a user, returns the user (no token) |
| `POST /auth/login` | `{ email, password }` → `{ access_token, token_type }` |
| `POST /auth/logout` | Requires `Authorization: Bearer <token>`. Stateless in V1 — just confirms the token is valid. |
| `GET /auth/me` | Requires `Authorization: Bearer <token>`. Returns the current user — reference example for protecting a route. |

Run the tests (spins up tables against a real Postgres+pgvector database,
since the `Link` model's vector column has no SQLite equivalent):

```bash
cd backend
source .venv/bin/activate
export TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/intend_link_saver_test
pytest
```
