"""
Link model — the core entity of the app.

Holds the saved URL plus the "why" (the user's own note and/or an
AI-inferred reason), the AI-generated summary, and the embedding vector
used for semantic search/recall. See the V1 architecture plan for the
rationale behind keeping this as a single table rather than splitting the
"reason" out into its own table.
"""
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.tag import link_tags

# Dimension for the embedding column. Gemini's embedding model natively
# outputs 3072 dims but supports requesting a smaller `output_dimensionality`
# (see embedding_service.py) — 1536 is requested explicitly to match this
# column, so changing this value requires updating that call site too.
EMBEDDING_DIM = 1536


class Link(Base):
    __tablename__ = "links"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)

    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    intent_category: Mapped[str | None] = mapped_column(String, nullable=True)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    status: Mapped[str] = mapped_column(String, nullable=False, default="ready")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    tags = relationship("Tag", secondary=link_tags, backref="links")
