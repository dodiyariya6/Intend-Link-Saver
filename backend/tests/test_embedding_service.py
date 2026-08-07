"""
Tests for embedding_service — the Gemini client is mocked so these run
without network access or a real API key, while still exercising the real
request construction, dimension validation, and input-building logic.
"""
import pytest

from app.config import settings
from app.models.link import EMBEDDING_DIM
from app.services import embedding_service


class _FakeEmbedding:
    def __init__(self, values: list[float] | None):
        self.values = values


class _FakeEmbedContentResponse:
    def __init__(self, values: list[float] | None):
        self.embeddings = [_FakeEmbedding(values)]


class _FakeModels:
    def __init__(self, vector: list[float] | None, *, raise_error: Exception | None = None):
        self._vector = vector
        self._raise_error = raise_error
        self.last_call_kwargs = None

    def embed_content(self, **kwargs):
        self.last_call_kwargs = kwargs
        if self._raise_error:
            raise self._raise_error
        return _FakeEmbedContentResponse(self._vector)


class _FakeClient:
    def __init__(self, vector: list[float] | None, *, raise_error: Exception | None = None):
        self.models = _FakeModels(vector, raise_error=raise_error)


@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")


# --- build_embedding_input -------------------------------------------------

def test_build_embedding_input_prefers_user_note():
    text = embedding_service.build_embedding_input(
        user_note="Saving for the Q3 pricing deck",
        ai_reason="Some AI guess",
        ai_summary="A summary of the page.",
        tags=["pricing", "research"],
    )
    assert text.startswith("Saving for the Q3 pricing deck")
    assert "Some AI guess" not in text
    assert "A summary of the page." in text
    assert "Tags: pricing, research" in text


def test_build_embedding_input_falls_back_to_ai_reason():
    text = embedding_service.build_embedding_input(
        user_note=None, ai_reason="Looks useful for research", ai_summary="Summary.", tags=[]
    )
    assert text.startswith("Looks useful for research")


def test_build_embedding_input_falls_back_to_ai_reason_when_note_blank():
    text = embedding_service.build_embedding_input(
        user_note="   ", ai_reason="Looks useful for research", ai_summary="Summary.", tags=[]
    )
    assert text.startswith("Looks useful for research")


def test_build_embedding_input_handles_all_empty():
    text = embedding_service.build_embedding_input(
        user_note=None, ai_reason=None, ai_summary=None, tags=[]
    )
    assert text == ""


def test_build_embedding_input_omits_tags_section_when_no_tags():
    text = embedding_service.build_embedding_input(
        user_note="note", ai_reason=None, ai_summary="summary", tags=[]
    )
    assert "Tags:" not in text


# --- generate_embedding ------------------------------------------------

def test_generate_embedding_success(monkeypatch):
    fake_vector = [0.1] * EMBEDDING_DIM
    fake_client = _FakeClient(fake_vector)
    provider = embedding_service.GeminiEmbeddingProvider.__new__(embedding_service.GeminiEmbeddingProvider)
    provider._client = fake_client
    provider._model = "gemini-embedding-001"
    monkeypatch.setattr(embedding_service, "_get_provider", lambda: provider)

    result = embedding_service.generate_embedding("some text about pricing")
    assert result == fake_vector
    assert len(result) == EMBEDDING_DIM
    call_kwargs = fake_client.models.last_call_kwargs
    assert call_kwargs["contents"] == "some text about pricing"
    assert call_kwargs["model"] == "gemini-embedding-001"
    assert call_kwargs["config"].output_dimensionality == EMBEDDING_DIM


def test_generate_embedding_raises_on_empty_text():
    with pytest.raises(embedding_service.EmbeddingServiceError):
        embedding_service.generate_embedding("")


def test_generate_embedding_raises_on_whitespace_only_text():
    with pytest.raises(embedding_service.EmbeddingServiceError):
        embedding_service.generate_embedding("    ")


def test_generate_embedding_raises_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(embedding_service.EmbeddingServiceError):
        embedding_service.generate_embedding("some text")


def test_provider_raises_on_wrong_dimension_response():
    provider = embedding_service.GeminiEmbeddingProvider.__new__(embedding_service.GeminiEmbeddingProvider)
    provider._client = _FakeClient([0.1, 0.2, 0.3])  # wrong size
    provider._model = "gemini-embedding-001"

    with pytest.raises(embedding_service.EmbeddingServiceError):
        provider.embed("some text")


def test_provider_raises_on_provider_api_error():
    from google.genai import errors as genai_errors

    provider = embedding_service.GeminiEmbeddingProvider.__new__(embedding_service.GeminiEmbeddingProvider)
    provider._client = _FakeClient(
        None, raise_error=genai_errors.ClientError(429, {"error": {"message": "rate limited"}})
    )
    provider._model = "gemini-embedding-001"

    with pytest.raises(embedding_service.EmbeddingServiceError):
        provider.embed("some text")
