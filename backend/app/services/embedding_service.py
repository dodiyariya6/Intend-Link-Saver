"""
Centralized embedding service — the only module in the app that talks to
an embedding provider.

Mirrors the shape of ai_service.py: an abstract `EmbeddingProvider`
interface plus one concrete implementation, so swapping providers/models
later means changing this file only — callers just use
`build_embedding_input()` and `generate_embedding()` and get back a
`list[float]` of length `EMBEDDING_DIM`.
"""
import logging
from abc import ABC, abstractmethod

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.config import settings
from app.models.link import EMBEDDING_DIM

logger = logging.getLogger(__name__)


class EmbeddingServiceError(Exception):
    """
    Raised for any failure generating an embedding — missing credentials,
    a provider/network error, or a vector of the wrong size. Callers (the
    enrichment pipeline) are expected to catch this and continue without an
    embedding rather than let it propagate.
    """


class EmbeddingProvider(ABC):
    """Interface any embedding backend must implement."""

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        ...


class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Google's Gemini embeddings API. `gemini-embedding-001` natively outputs
    3072-dimensional vectors, so `output_dimensionality` is pinned to
    EMBEDDING_DIM (1536) on every call — that's what makes the vectors match
    the existing `Link.embedding` column exactly, no schema change needed.
    """

    def __init__(self, api_key: str, model: str | None = None):
        self._client = genai.Client(api_key=api_key)
        self._model = model or settings.embedding_model

    def embed(self, text: str) -> list[float]:
        try:
            response = self._client.models.embed_content(
                model=self._model,
                contents=text,
                config=genai_types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
            )
        except genai_errors.APIError as exc:
            raise EmbeddingServiceError(f"Embedding provider call failed: {exc}") from exc

        vector = list(response.embeddings[0].values)
        if len(vector) != EMBEDDING_DIM:
            raise EmbeddingServiceError(
                f"Embedding provider returned {len(vector)} dims, expected {EMBEDDING_DIM}"
            )
        return vector


def _get_provider() -> EmbeddingProvider:
    if not settings.gemini_api_key:
        raise EmbeddingServiceError("GEMINI_API_KEY is not configured")
    return GeminiEmbeddingProvider(api_key=settings.gemini_api_key)


def build_embedding_input(
    *, user_note: str | None, ai_reason: str | None, ai_summary: str | None, tags: list[str]
) -> str:
    """
    Compose the text to embed: the user's own note if present, otherwise
    the AI-inferred reason, plus the AI summary and tags.

    This is deliberately "why it was saved" first and "what it's about"
    second — future semantic search should match on saved *intent*, not
    just topic.
    """
    reason = (user_note or "").strip() or (ai_reason or "").strip()

    parts = [part for part in (reason, (ai_summary or "").strip()) if part]
    if tags:
        parts.append("Tags: " + ", ".join(tags))

    return "\n\n".join(parts)


def generate_embedding(text: str) -> list[float]:
    """Raises EmbeddingServiceError if `text` is empty or the provider call fails."""
    if not text or not text.strip():
        raise EmbeddingServiceError("Cannot generate an embedding for empty text")

    provider = _get_provider()
    return provider.embed(text)
