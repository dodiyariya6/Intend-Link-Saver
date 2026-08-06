"""
Shared pytest fixtures.

Tests run against a real (local) Postgres database with pgvector enabled,
matching production rather than mocking out the DB — the `Link` model's
vector column isn't representable in SQLite. Point `TEST_DATABASE_URL` at
whatever Postgres instance you want tests to use; defaults to a local
`intend_link_saver_test` database alongside the dev one.

Each test runs inside a transaction that's rolled back afterward, so tests
don't leak data into each other.
"""
import os

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/intend_link_saver_test",
    ),
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — registers models on Base.metadata
from app.db import Base, get_db
from app.main import app

engine = create_engine(os.environ["DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
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
