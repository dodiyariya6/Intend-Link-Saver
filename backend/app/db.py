"""
SQLAlchemy engine/session setup.

No models or migrations are wired up yet — this just establishes the
connection scaffolding so routers/services have something to import against
once real data models are added.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for future ORM models."""
    pass


def get_db():
    """FastAPI dependency for a scoped DB session (not yet used by any route)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
