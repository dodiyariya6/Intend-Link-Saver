"""
Semantic search over a user's saved links, using pgvector cosine similarity
against the embeddings the enrichment pipeline (Module 6) already writes to
`Link.embedding`.

This module does NOT talk to Gemini or the embedding provider itself — the
router calls `embedding_service.generate_embedding()` directly to embed the
query (reusing Module 6's logic rather than duplicating it), and passes the
resulting vector in here.
"""
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.link import Link
from app.models.tag import Tag
from app.services.link_service import _normalize_tag_names  # reuse Module 4's tag
# normalization instead of duplicating it; imported directly rather than
# renamed/exported publicly so link_service.py (CRUD) stays untouched.


@dataclass
class SearchResult:
    link: Link
    similarity: float


def search_links(
    db: Session,
    user_id: uuid.UUID,
    query_embedding: list[float],
    page: int = 1,
    page_size: int = 20,
    intent_category: str | None = None,
    tags: list[str] | None = None,
) -> tuple[list[SearchResult], int]:
    """
    Rank the user's links by cosine similarity to `query_embedding`,
    highest first. Only links that have an embedding (i.e. have been
    enriched) are considered — everything else can't be meaningfully
    ranked. Returns ([], 0) rather than raising when nothing matches or
    the user has no enriched links yet.
    """
    # pgvector's cosine_distance is 1 - cosine_similarity; convert back to
    # a similarity score (1.0 = identical, 0.0 = unrelated/orthogonal) so
    # the API returns something intuitive.
    distance = Link.embedding.cosine_distance(query_embedding)
    similarity = (1 - distance).label("similarity")

    query = (
        db.query(Link, similarity)
        .filter(Link.user_id == user_id)
        .filter(Link.embedding.isnot(None))
    )

    if intent_category:
        query = query.filter(Link.intent_category == intent_category)

    normalized_tags = _normalize_tag_names(tags) if tags else []
    if normalized_tags:
        query = query.filter(Link.tags.any(Tag.name.in_(normalized_tags)))

    total = query.count()

    rows = (
        query.order_by(similarity.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return [SearchResult(link=link, similarity=float(sim)) for link, sim in rows], total
