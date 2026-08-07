# Intend Link Saver

An AI-driven link repository that remembers *why* you saved a link.

Implemented so far: project scaffolding, database models/migrations,
authentication (register/login/JWT), Link CRUD (ownership-scoped,
pagination, filtering), an AI enrichment pipeline (fetch → summarize → tag
→ classify via Claude), embedding generation, semantic search (pgvector
cosine similarity), a reusable frontend UI component library + design
system, and the frontend authentication pages + application shell. The
real Dashboard/Save Link/Search UI and the conversational Memory Assistant
are not implemented yet. See `/root/.claude/plans/` (or your own copy of
the architecture plan) for the full design.

## Stack

- **Backend**: FastAPI (Python), SQLAlchemy, Alembic
- **Frontend**: React + TypeScript (Vite), Tailwind CSS, Lucide React icons
- **Database**: PostgreSQL with the `pgvector` extension
- **AI**: Anthropic Claude (summarization, tagging, intent classification) + OpenAI `text-embedding-3-small` (embeddings)

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
│   │   ├── schemas/      # auth.py, link.py, search.py implemented; tags.py (empty) future
│   │   ├── routers/      # auth.py, links.py, search.py implemented; tags.py (empty) future
│   │   ├── services/     # auth_service, link_service, fetch_service, ai_service,
│   │   │                 # embedding_service, enrichment_service, search_service
│   │   │                 # implemented
│   │   └── prompts/      # summarize_and_tag.py implemented
│   ├── alembic/          # migrations setup, no migrations yet
│   └── tests/
├── frontend/         # React + Vite app
│   └── src/
│       ├── design/       # design tokens (CSS custom properties)
│       ├── lib/          # cn() classname utility
│       ├── components/
│       │   ├── ui/       # Typography, Button, Input, TextArea, Card, Badge,
│       │   │             # Tag, NavBar, Toast — the reusable component library
│       │   └── feedback/ # EmptyState, ErrorState, Skeleton
│       ├── app/
│       │   ├── layout/   # Container, AppShell, AuthLayout (base layout components)
│       │   └── providers.tsx  # app-wide providers (ToastProvider)
│       ├── dev/          # internal-only component preview, not a product page
│       ├── api/          # (empty) future API client
│       ├── pages/        # (empty) future pages — no product UI built yet
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
npm run dev    # dev server at http://localhost:5173
npm test       # component library smoke tests (vitest)
npm run build  # production build (tsc -b && vite build)
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
| `POST /links/{id}/enrich` | Runs the pipeline (fetch → summarize/tag/classify → embed) for an already-saved link. Returns `{ success, detail, link, embedding_generated }`. |

Modules:
- `app/services/fetch_service.py` — HTTP fetch + `trafilatura` readable-text extraction. Raises `FetchError` on any failure.
- `app/prompts/summarize_and_tag.py` — the single source of truth for the Claude prompt text and the "is the user's note sparse?" rule.
- `app/services/ai_service.py` — the **only** module that talks to the Anthropic SDK. Builds the request, parses/validates the JSON response, raises `AIServiceError` on any failure. Swapping providers/models means changing this file only.
- `app/services/embedding_service.py` — the **only** module that talks to an embedding provider (`EmbeddingProvider` ABC + `OpenAIEmbeddingProvider`). `build_embedding_input()` composes `user_note` (or `ai_reason` as fallback) + `ai_summary` + tags — search should match on *why* something was saved, not just what it's about. Raises `EmbeddingServiceError` on any failure.
- `app/services/enrichment_service.py` — orchestrates fetch → AI → embed → persist. On a fetch/AI failure, the link is left exactly as it was except `status` becomes `"failed"`. An embedding failure is non-fatal to the rest — the AI summary/tags/category are still saved, `status` still becomes `"enriched"`, but `embedding_generated` comes back `false`. AI-generated tags are merged with (not replacing) any tags the user already added manually. Every call to `/enrich` regenerates the embedding from whatever content is current — there's no skip-if-exists caching, so re-triggering enrichment after editing a link's note/url/tags naturally produces an up-to-date vector.

`Link.status` values: `"ready"` (saved, not yet enriched) → `"enriched"` (AI succeeded — embedding may or may not have) or `"failed"` (fetch or AI step failed — link preserved, retry by calling `/enrich` again).

Requires `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `backend/.env` to actually call Claude and generate embeddings; without them, both steps fail gracefully (link preserved, `success`/`embedding_generated` reflect what actually happened).

## Semantic Search

Natural-language search over the current user's *enriched* links, ranked
by cosine similarity between the query's embedding and each link's stored
embedding (Module 6). Reuses `embedding_service.generate_embedding()` to
embed the query — this module never talks to an embedding provider itself.

| Endpoint | Description |
|---|---|
| `GET /search?q=...` | `page`, `page_size`, `intent_category`, repeated `tags=` (matches any) all optional. Returns `{ query, items, total, page, page_size, pages }`, each item a link plus its `similarity` score (1.0 = identical, 0.0 = unrelated). |

- `app/services/search_service.py` — `search_links()` runs `Link.embedding.cosine_distance(query_vector)` (pgvector's `<=>` operator) scoped to `user_id`, with `embedding IS NOT NULL` (links not yet enriched are excluded — they have nothing to rank against) and the optional `intent_category`/`tags` filters, ordered by similarity descending.
- If the query can't be embedded (provider not configured/unavailable), the router returns `503` rather than silently returning an empty list — a real failure shouldn't look identical to "nothing matched".
- If the user has no enriched links yet (or genuinely nothing similar), the response is just `items: []` — never an error.
- An HNSW index (`vector_cosine_ops`, matching the `<=>` operator used above) is created on `links.embedding` via migration `6853f329ffd3` for query performance at scale; correctness doesn't depend on it.

## Frontend Design System & Component Library

A reusable UI component library implementing the approved design system —
light theme, warm off-white canvas, white surfaces, dark neutral text, one
muted sage-green accent, Manrope typeface, Lucide React icons, 8px spacing
grid. No product pages are built yet; this is the foundation they'll be
built from.

- `src/design/tokens.css` — every color/shadow/motion value as CSS custom
  properties; `tailwind.config.ts` maps Tailwind's theme onto them. Tailwind's
  *native* numeric spacing scale (already `key × 4px`) is used directly for
  spacing/sizing rather than redefined, since it already is an 8px grid on
  its even keys — redefining it risked (and briefly did, before being
  fixed) silently breaking height utilities like `h-10`/`h-12` that Button/
  Input rely on for their spec'd pixel sizes.
- `src/components/ui/` — `Typography` (`Heading`/`Text`, the only way text
  should be styled anywhere in the app), `Button`/`IconButton`, `Input`,
  `TextArea`, `Card` (+`CardHeader`/`CardBody`/`CardFooter`), `Badge`, `Tag`,
  `NavBar`/`NavLinkItem`, `Toast` (+`ToastProvider`/`useToast`).
- `src/components/feedback/` — `EmptyState`, `ErrorState`, `Skeleton`/`CardSkeleton`.
- `src/app/layout/` — `Container`, `AppShell` (top nav only, no permanent
  sidebar), `AuthLayout`. `src/app/providers.tsx` composes app-wide
  providers (`ToastProvider` so far).
- `src/dev/ComponentPreview.tsx` — **internal only**, not routed/linked
  anywhere; exists solely so the library can be visually verified. Not a
  product page.

Every component is covered by a render/accessibility smoke test
(`npm test`, 38 tests) — labels are associated correctly, icon-only buttons
require `aria-label`, error states use `role="alert"`, toasts use
`role="status"`/`role="alert"` with appropriate `aria-live`, decorative
elements (skeletons, icons) are `aria-hidden`. Visual/responsive behavior
was additionally verified with real rendered screenshots (desktop 1440px
and narrow 768px) via the internal preview page.

## Frontend Authentication & Application Shell

Login/register pages, session persistence, route guards, and the
authenticated app shell — connected to the real backend auth API. No
Dashboard/Save Link/Search UI yet; the authenticated landing route
(`PlaceholderHomePage`) exists only to host and verify the shell + guards.

- `src/api/client.ts` — the only module that calls `fetch`; injects the
  `Authorization` header from `localStorage`, normalizes errors into
  `ApiError`, and notifies subscribers on any `401` (`onUnauthorized`).
- `src/api/auth.ts` — `registerUser`/`loginUser`/`logoutUser`/`getCurrentUser`.
- `src/features/auth/AuthContext.tsx` — the session state boundary
  (`user`, `status: "idle" | "authenticated" | "unauthenticated"`).
  Validates any stored token against `/auth/me` on boot rather than
  trusting its presence; subscribes to `onUnauthorized` so an
  expired/invalid token anywhere in the app clears the session and sets
  `sessionExpired` (shown as a banner on the login page).
- `src/features/auth/hooks/` — `useLogin`/`useRegister`/`useLogout` wrap
  `AuthContext`'s methods in TanStack Query `useMutation` for
  `isPending`/`onError` form-submission state.
- `src/features/auth/components/` — `LoginForm`, `RegisterForm` (client-side
  validation mirroring the backend's constraints, inline errors for
  401/409), `UserMenu` (avatar-initial + email + logout, composed from
  existing `Button`/`Text` — not a new base component).
- `src/app/guards.tsx` — `RequireAuth` (redirects unauthenticated visitors
  to `/login`, preserving the intended destination) and `PublicOnlyRoute`
  (redirects an already-authenticated visitor away from `/login`/`/register`).
  Both show a `FullPageLoader` while `status === "idle"` to avoid a
  flash-redirect for a user with a valid stored token.
- `src/app/router.tsx` — `/login`, `/register` (public-only), `/`
  (protected, placeholder home), `*` → `/`.

Run the frontend tests (`npm test`, 80 tests) and production build
(`npm run build`) from `frontend/`. Auth flows were additionally verified
end-to-end against a live backend + Playwright: registration, validation,
login (correct/incorrect credentials), logout, protected-route redirects
(both directions), and invalid/expired-JWT handling.
