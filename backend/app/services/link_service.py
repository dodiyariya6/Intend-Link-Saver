"""
Link management service.

Pure DB logic, no FastAPI-specific concerns — the router calls into this
module. No AI/fetch/embedding work happens here; links are stored as-is
with their AI-related fields left empty for a later module to fill in.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.link import Link
from app.models.tag import Tag
from app.schemas.link import LinkCreate, LinkUpdate


def _normalize_tag_names(names: list[str]) -> list[str]:
    """Trim, lowercase, and de-duplicate tag names while preserving order."""
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in names:
        name = raw.strip().lower()
        if not name or name in seen:
            continue
        seen.add(name)
        normalized.append(name)
    return normalized


def get_or_create_tags(db: Session, user_id: uuid.UUID, names: list[str]) -> list[Tag]:
    """Resolve tag names to Tag rows scoped to this user, creating any that don't exist yet."""
    normalized = _normalize_tag_names(names)
    if not normalized:
        return []

    existing = db.query(Tag).filter(Tag.user_id == user_id, Tag.name.in_(normalized)).all()
    existing_names = {tag.name for tag in existing}

    new_tags = [Tag(user_id=user_id, name=name) for name in normalized if name not in existing_names]
    if new_tags:
        db.add_all(new_tags)
        db.flush()

    return existing + new_tags


def create_link(db: Session, user_id: uuid.UUID, data: LinkCreate) -> Link:
    link = Link(
        user_id=user_id,
        url=str(data.url),
        title=data.title,
        user_note=data.note,
        intent_category=data.intent_category,
        # No AI/enrichment step in this module — "ready" here just means
        # "saved successfully", not "AI-processed". ai_summary/ai_reason/
        # embedding stay empty until the enrichment module is added.
        status="ready",
    )
    link.tags = get_or_create_tags(db, user_id, data.tags)

    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def get_link(db: Session, user_id: uuid.UUID, link_id: uuid.UUID) -> Link | None:
    """Fetch a link only if it belongs to `user_id` — enforces ownership at the query level."""
    return db.query(Link).filter(Link.id == link_id, Link.user_id == user_id).first()


def list_links(
    db: Session,
    user_id: uuid.UUID,
    page: int,
    page_size: int,
    intent_category: str | None = None,
    tags: list[str] | None = None,
) -> tuple[list[Link], int]:
    query = db.query(Link).filter(Link.user_id == user_id)

    if intent_category:
        query = query.filter(Link.intent_category == intent_category)

    normalized_tags = _normalize_tag_names(tags) if tags else []
    if normalized_tags:
        # `.any(...)` filters on links having at least one matching tag via
        # a correlated EXISTS subquery, so it doesn't multiply rows the way
        # a plain join would — count() stays accurate without needing DISTINCT.
        query = query.filter(Link.tags.any(Tag.name.in_(normalized_tags)))

    total = query.count()
    items = (
        query.order_by(Link.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def update_link(db: Session, link: Link, data: LinkUpdate) -> Link:
    if data.url is not None:
        link.url = str(data.url)
    if data.title is not None:
        link.title = data.title
    if data.note is not None:
        link.user_note = data.note
    if data.intent_category is not None:
        link.intent_category = data.intent_category
    if data.tags is not None:
        link.tags = get_or_create_tags(db, link.user_id, data.tags)

    db.commit()
    db.refresh(link)
    return link


def delete_link(db: Session, link: Link) -> None:
    db.delete(link)
    db.commit()
