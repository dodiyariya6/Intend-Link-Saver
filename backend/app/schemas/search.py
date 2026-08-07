"""Pydantic schemas for semantic search and the Memory Assistant."""
from pydantic import BaseModel, Field

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


class AskRequest(BaseModel):
    question: str = Field(min_length=1)


class AskResponse(BaseModel):
    answer: str
    cited_links: list[LinkOut]
