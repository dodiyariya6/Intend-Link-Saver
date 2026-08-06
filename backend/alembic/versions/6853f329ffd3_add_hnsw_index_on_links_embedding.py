"""add hnsw index on links.embedding for cosine similarity search

Revision ID: 6853f329ffd3
Revises: 1ad47e9054d5
Create Date: 2026-08-06 00:00:00.000000

NOTE: this index is created via raw SQL (op.execute) rather than
op.create_index/an ORM Index() object, since it needs the `vector_cosine_ops`
operator class that SQLAlchemy's pgvector integration doesn't model. Because
of that, it isn't visible to Base.metadata, so `alembic revision
--autogenerate` / `alembic check` will (harmlessly) propose dropping it —
that's a known false positive for manually-managed indexes, not real drift.
Upgrade/downgrade were verified to apply and roll back cleanly.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '6853f329ffd3'
down_revision = '1ad47e9054d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # HNSW index using cosine distance ops, matching the `<=>` operator
    # search_service.py uses via Link.embedding.cosine_distance(). Rows
    # with a NULL embedding (not yet enriched) are simply excluded from
    # the index automatically. HNSW (not IVFFlat) is used because it
    # doesn't require pre-training on existing data and gives good
    # query performance immediately, even on an empty/small table.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_links_embedding_hnsw_cosine "
        "ON links USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_links_embedding_hnsw_cosine")
