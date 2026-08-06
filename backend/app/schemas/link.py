"""Pydantic request/response schemas for link management."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class LinkCreate(BaseModel):
    url: HttpUrl
    title: str | None = None
    note: str | None = Field(default=None, description="The user's own \"why I'm saving this\" note")
    intent_category: str | None = None
    tags: list[str] = Field(default_factory=list)


class LinkUpdate(BaseModel):
    """All fields optional — only provided fields are changed.

    `tags: None` leaves tags untouched; `tags: []` clears them; a non-empty
    list replaces the link's tags entirely.
    """
    url: HttpUrl | None = None
    title: str | None = None
    note: str | None = None
    intent_category: str | None = None
    tags: list[str] | None = None


class LinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    title: str | None
    ai_summary: str | None
    user_note: str | None
    ai_reason: str | None
    intent_category: str | None
    status: str
    tags: list[str]
    created_at: datetime


class LinkListResponse(BaseModel):
    items: list[LinkOut]
    total: int
    page: int
    page_size: int
    pages: int


class LinkEnrichResponse(BaseModel):
    success: bool
    detail: str
    link: LinkOut
    embedding_generated: bool = False
