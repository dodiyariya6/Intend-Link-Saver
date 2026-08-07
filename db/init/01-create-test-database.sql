-- Runs automatically on first container start (postgres image executes
-- everything under /docker-entrypoint-initdb.d, in filename order, only
-- when the data volume is freshly initialized).
--
-- Creates a database for the backend test suite (backend/tests/conftest.py)
-- that is separate from the dev database (POSTGRES_DB in docker-compose.yml).
-- Tests call Base.metadata.drop_all() at session teardown; without this
-- separate database, that would run against — and wipe — dev data.
CREATE DATABASE intend_link_saver_test;

-- pgvector must be enabled per-database; the conftest.py test fixture also
-- enables it defensively, but doing it here too means a plain `psql` or
-- `alembic upgrade head` against this database works without depending on
-- pytest having run first.
\connect intend_link_saver_test
CREATE EXTENSION IF NOT EXISTS vector;
