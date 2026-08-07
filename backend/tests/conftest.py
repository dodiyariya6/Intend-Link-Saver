"""
Shared pytest fixtures.

Tests run against a real (local) Postgres database with pgvector enabled,
matching production rather than mocking out the DB — the `Link` model's
vector column isn't representable in SQLite. Point `TEST_DATABASE_URL` at
whatever Postgres instance you want tests to use; defaults to a
`_test`-suffixed sibling of DATABASE_URL, alongside the dev one.

Each test runs inside a transaction that's rolled back afterward, so tests
don't leak data into each other.

IMPORTANT: this must never resolve to the same database the app itself
uses. The `_setup_database` fixture below calls `Base.metadata.drop_all()`
at session teardown — pointed at a shared dev database, that silently
wipes it. docker-compose sets DATABASE_URL to the dev database for the
running app, and that same env is inherited by `docker compose exec
backend pytest`, so an `os.environ.setdefault("DATABASE_URL", ...)` here
(only filling in DATABASE_URL when unset) does nothing and tests run
straight against dev data. Compute the test URL unconditionally instead —
never trust an inherited DATABASE_URL.
"""
import os
from urllib.parse import urlsplit, urlunsplit


def _resolve_test_database_url() -> str:
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit

    # Derive a same-host, `_test`-suffixed sibling of whatever DATABASE_URL
    # is ambient (falling back to localhost outside any container), so the
    # right hostname is used whether this runs on the host or inside the
    # backend container (where "localhost" would mean the container itself,
    # not the `db` compose service — the same class of bug this project hit
    # with the Vite proxy).
    base = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/intend_link_saver",
    )
    parts = urlsplit(base)
    db_name = parts.path.lstrip("/") or "intend_link_saver"
    test_db_name = db_name if db_name.endswith("_test") else f"{db_name}_test"
    return urlunsplit((parts.scheme, parts.netloc, f"/{test_db_name}", parts.query, parts.fragment))


# Force (not setdefault!) — see module docstring for why setdefault is unsafe here.
os.environ["DATABASE_URL"] = _resolve_test_database_url()

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — registers models on Base.metadata
from app.db import Base, get_db
from app.main import app

engine = create_engine(os.environ["DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    # Base.metadata.create_all() doesn't know about Postgres extensions —
    # the `vector` type backing Link.embedding needs it enabled per-database
    # (mirrors the CREATE EXTENSION step in the initial alembic migration).
    # A freshly created test database won't have this yet.
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
