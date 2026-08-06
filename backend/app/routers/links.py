"""
Link management endpoints: CRUD, scoped to the authenticated user.

Every route depends on `get_current_user` (from the auth module, unmodified
here) and every query/mutation filters on `Link.user_id == current_user.id`
so a user can never see or touch another user's links — a link that exists
but belongs to someone else looks identical to a nonexistent one (404).
"""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.link import LinkCreate, LinkEnrichResponse, LinkListResponse, LinkOut, LinkUpdate
from app.services import enrichment_service, link_service

router = APIRouter(prefix="/links", tags=["links"])


def _serialize(link) -> LinkOut:
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


def _get_owned_link_or_404(db: Session, current_user: User, link_id: uuid.UUID):
    link = link_service.get_link(db, current_user.id, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    return link


@router.post("", response_model=LinkOut, status_code=status.HTTP_201_CREATED)
def create_link(
    payload: LinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LinkOut:
    link = link_service.create_link(db, current_user.id, payload)
    return _serialize(link)


@router.get("", response_model=LinkListResponse)
def list_links(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intent_category: str | None = Query(None),
    tags: list[str] | None = Query(None, description="Repeat to filter by multiple tags (matches any)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LinkListResponse:
    items, total = link_service.list_links(
        db, current_user.id, page=page, page_size=page_size, intent_category=intent_category, tags=tags
    )
    pages = math.ceil(total / page_size) if page_size else 0
    return LinkListResponse(
        items=[_serialize(link) for link in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{link_id}", response_model=LinkOut)
def get_link(
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LinkOut:
    link = _get_owned_link_or_404(db, current_user, link_id)
    return _serialize(link)


@router.patch("/{link_id}", response_model=LinkOut)
def update_link(
    link_id: uuid.UUID,
    payload: LinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LinkOut:
    link = _get_owned_link_or_404(db, current_user, link_id)
    link = link_service.update_link(db, link, payload)
    return _serialize(link)


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_link(
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    link = _get_owned_link_or_404(db, current_user, link_id)
    link_service.delete_link(db, link)
    return None


@router.post("/{link_id}/enrich", response_model=LinkEnrichResponse)
def enrich_link(
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LinkEnrichResponse:
    """
    Run the AI enrichment pipeline (fetch page -> summarize/tag/classify)
    for a link the user already saved. On any failure the link is left
    exactly as it was (see enrichment_service) — this never loses data,
    it just reports success/failure with a human-readable detail.
    """
    link = _get_owned_link_or_404(db, current_user, link_id)
    outcome = enrichment_service.enrich_link(db, link)
    return LinkEnrichResponse(success=outcome.success, detail=outcome.detail, link=_serialize(outcome.link))
