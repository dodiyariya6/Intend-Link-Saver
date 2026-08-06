"""Pydantic schemas for semantic search."""
from pydantic import BaseModel

from app.schemas.link import LinkOut


class SearchResultItem(LinkOut):
    """A LinkOut plus how similar it was to the search query (1.0 = identical, 0.0 = unrelated)."""

    similarity: float


class SearchResponse(BaseModel):
    query: str
    items: list[SearchResultItem]
    total: int
    page: int
    page_size: int
    pages: int
