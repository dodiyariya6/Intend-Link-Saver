# Intend Link Saver

An AI-driven link repository that remembers *why* you saved a link.

Implemented so far: project scaffolding, database models/migrations,
authentication (register/login/JWT), Link CRUD (ownership-scoped,
pagination, filtering), and an AI enrichment pipeline (fetch → summarize →
tag → classify via Claude). Embeddings and semantic search are not
implemented yet. See `/root/.claude/plans/` (or your own copy of the
architecture plan) for the full design.

## Stack

- **Backend**: FastAPI (Python), SQLAlchemy, Alembic
- **Frontend**: React + TypeScript (Vite)
- **Database**: PostgreSQL with the `pgvector` extension
- **AI**: Anthropic Claude — summarization, tagging, intent classification

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
│   │   ├── schemas/      # auth.py, link.py implemented; search.py (empty) future
│   │   ├── routers/      # auth.py, links.py implemented; search/tags (empty) future
│   │   ├── services/     # auth_service, link_service, fetch_service, ai_service,
│   │   │                 # enrichment_service implemented; search_service (empty) future
│   │   └── prompts/      # summarize_and_tag.py implemented
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

## Link Management

CRUD for saved links, implemented in `app/services/link_service.py` and
`app/routers/links.py`. All routes require `Authorization: Bearer <token>`
(via the same `get_current_user` dependency from the auth module) and are
scoped to the current user — every query filters on `Link.user_id`, so a
link belonging to another user is indistinguishable from one that doesn't
exist (both return 404).

Creating/updating a link never triggers AI processing by itself — `ai_summary`,
`ai_reason`, and the embedding column stay empty until enrichment (below) runs.

| Endpoint | Description |
|---|---|
| `POST /links` | `{ url, title?, note?, intent_category?, tags? }` → creates a link. `url` is validated (must be a well-formed http(s) URL). |
| `GET /links` | Paginated list (`page`, `page_size`), filterable by `intent_category` and `tags` (repeat `tags=` for multiple — matches any). |
| `GET /links/{id}` | Fetch a single link. |
| `PATCH /links/{id}` | Partial update — only provided fields change. `tags` (if provided) replaces the link's tag set entirely. |
| `DELETE /links/{id}` | Delete a link. |

Tags are user-scoped, trimmed/lowercased, and de-duplicated automatically;
referencing a tag name that doesn't exist yet creates it.

## AI Enrichment Pipeline

Fetches the saved page, extracts readable text, and asks Claude (one call)
to summarize it, propose 3-7 tags, classify an intent category, and — only
when the user didn't provide their own note (or it was too short to be
useful) — infer a short reason it might be worth saving. The user's own
note is never overwritten.

| Endpoint | Description |
|---|---|
| `POST /links/{id}/enrich` | Runs the pipeline for an already-saved link. Returns `{ success, detail, link }`. |

Modules:
- `app/services/fetch_service.py` — HTTP fetch + `trafilatura` readable-text extraction. Raises `FetchError` on any failure.
- `app/prompts/summarize_and_tag.py` — the single source of truth for the Claude prompt text and the "is the user's note sparse?" rule.
- `app/services/ai_service.py` — the **only** module that talks to the Anthropic SDK. Builds the request, parses/validates the JSON response, raises `AIServiceError` on any failure. Swapping providers/models means changing this file only.
- `app/services/enrichment_service.py` — orchestrates fetch → AI → persist. On any failure, the link is left exactly as it was except `status` becomes `"failed"`; nothing is deleted or partially overwritten. AI-generated tags are merged with (not replacing) any tags the user already added manually.

`Link.status` values: `"ready"` (saved, not yet enriched) → `"enriched"` (AI succeeded) or `"failed"` (fetch or AI step failed — link preserved, retry by calling `/enrich` again).

Requires `ANTHROPIC_API_KEY` in `backend/.env` to actually call Claude; without it, enrichment fails gracefully (`success: false`, link preserved).
