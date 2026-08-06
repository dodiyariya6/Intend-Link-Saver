"""
GET /search: natural-language semantic search over the current user's
saved links, powered by pgvector cosine similarity against the embeddings
Module 6 already generates. Reuses embedding_service to embed the query —
this router never talks to an embedding provider directly.
"""
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.search import SearchResponse, SearchResultItem
from app.services import embedding_service, search_service

router = APIRouter(prefix="/search", tags=["search"])


def _serialize(link, similarity: float) -> SearchResultItem:
    return SearchResultItem(
        id=link.id,
        url=link.url,
        title=link.title,
        ai_summary=link.ai_summary,
        user_note=link.user_note,
        ai_reason=link.ai_reason,
        intent_category=link.intent_category,
        status=link.status,
        tags=[tag.name for tag in link.tags],
        created_at=link.created_at,
        similarity=round(similarity, 4),
    )


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intent_category: str | None = Query(None),
    tags: list[str] | None = Query(None, description="Repeat to filter by multiple tags (matches any)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    try:
        query_embedding = embedding_service.generate_embedding(q)
    except embedding_service.EmbeddingServiceError as exc:
        # This means search itself couldn't run (no provider configured,
        # provider error) -- a real failure, distinct from "ran fine but
        # found nothing", so it's surfaced as an error rather than
        # silently returned as an empty result set.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Search is temporarily unavailable: {exc}",
        ) from exc

    results, total = search_service.search_links(
        db,
        current_user.id,
        query_embedding,
        page=page,
        page_size=page_size,
        intent_category=intent_category,
        tags=tags,
    )
    pages = math.ceil(total / page_size) if page_size else 0
    return SearchResponse(
        query=q,
        items=[_serialize(result.link, result.similarity) for result in results],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
