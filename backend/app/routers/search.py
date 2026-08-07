"""
GET /search: natural-language semantic search over the current user's
saved links, powered by pgvector cosine similarity against the embeddings
Module 6 already generates. Reuses embedding_service to embed the query —
this router never talks to an embedding provider directly.

POST /search/ask: the Memory Assistant. Reuses the exact same
embedding_service + search_service machinery as GET /search to find
candidate links, then makes one Claude call (via ai_service.answer_query)
to produce a short conversational answer citing them. No new
search/ranking logic — this endpoint is a thin layer on top of what
already exists.
"""
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.link import LinkOut
from app.schemas.search import AskRequest, AskResponse, SearchResponse, SearchResultItem
from app.services import ai_service, embedding_service, search_service

router = APIRouter(prefix="/search", tags=["search"])

# How many top-matching links to hand to Claude as candidates for /ask.
# Kept small and fixed (no page/page_size on this endpoint) since the
# Memory Assistant is meant to answer from what's clearly relevant, not
# page through results.
ASK_CANDIDATE_COUNT = 5


def _link_out(link) -> LinkOut:
    return LinkOut(
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
    )


def _serialize(link, similarity: float) -> SearchResultItem:
    return SearchResultItem(**_link_out(link).model_dump(), similarity=round(similarity, 4))


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


@router.post("/ask", response_model=AskResponse)
def ask(
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AskResponse:
    try:
        query_embedding = embedding_service.generate_embedding(payload.question)
    except embedding_service.EmbeddingServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Memory Assistant is temporarily unavailable: {exc}",
        ) from exc

    results, _ = search_service.search_links(
        db, current_user.id, query_embedding, page=1, page_size=ASK_CANDIDATE_COUNT
    )
    candidates = [result.link for result in results]

    if not candidates:
        return AskResponse(
            answer="I couldn't find anything in your saved links about that — try different wording, "
            "or save something new.",
            cited_links=[],
        )

    try:
        answer = ai_service.answer_query(question=payload.question, candidates=candidates)
    except ai_service.AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Memory Assistant is temporarily unavailable: {exc}",
        ) from exc

    return AskResponse(answer=answer, cited_links=[_link_out(link) for link in candidates])
