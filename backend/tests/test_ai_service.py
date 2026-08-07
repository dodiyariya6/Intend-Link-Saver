"""
Tests for ai_service — the Anthropic client is mocked so these run without
network access or a real API key, while still exercising the real request
construction and response-parsing logic.
"""
import json
from types import SimpleNamespace

import pytest

from app.config import settings
from app.models.link import Link
from app.services import ai_service


class _FakeTextBlock:
    def __init__(self, text: str):
        self.type = "text"
        self.text = text


class _FakeMessages:
    def __init__(self, response_text: str, *, raise_error: Exception | None = None):
        self._response_text = response_text
        self._raise_error = raise_error
        self.last_call_kwargs = None

    def create(self, **kwargs):
        self.last_call_kwargs = kwargs
        if self._raise_error:
            raise self._raise_error
        return SimpleNamespace(content=[_FakeTextBlock(self._response_text)])


class _FakeClient:
    def __init__(self, response_text: str, *, raise_error: Exception | None = None):
        self.messages = _FakeMessages(response_text, raise_error=raise_error)


VALID_RESPONSE = json.dumps(
    {
        "summary": "An article explaining competitor pricing analysis frameworks.",
        "tags": ["pricing", "competitor-analysis", "strategy"],
        "intent_category": "research",
        "ai_reason": None,
    }
)


@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")


def test_summarize_and_tag_success(monkeypatch):
    fake_client = _FakeClient(VALID_RESPONSE)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.summarize_and_tag(
        page_text="Some article body about pricing.", user_note=None, url="https://example.com/a"
    )

    assert result.ai_summary.startswith("An article")
    assert result.tags == ["pricing", "competitor-analysis", "strategy"]
    assert result.intent_category == "research"
    assert result.ai_reason is None

    # confirm the request was actually built with our model/system prompt
    assert fake_client.messages.last_call_kwargs["model"] == ai_service.CLAUDE_MODEL
    assert "JSON object" in fake_client.messages.last_call_kwargs["system"]


def test_summarize_and_tag_infers_reason_when_note_missing(monkeypatch):
    response = json.dumps(
        {
            "summary": "Recipe for sourdough bread.",
            "tags": ["baking", "recipe", "bread", "sourdough"],
            "intent_category": "reference",
            "ai_reason": "Looks like a recipe worth trying later.",
        }
    )
    fake_client = _FakeClient(response)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.summarize_and_tag(page_text="...", user_note=None, url="https://example.com/b")
    assert result.ai_reason == "Looks like a recipe worth trying later."


def test_summarize_and_tag_raises_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(ai_service.AIServiceError):
        ai_service.summarize_and_tag(page_text="x", user_note=None, url="https://example.com")


def test_summarize_and_tag_raises_on_non_json_response(monkeypatch):
    fake_client = _FakeClient("This is not JSON at all.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    with pytest.raises(ai_service.AIServiceError):
        ai_service.summarize_and_tag(page_text="x", user_note=None, url="https://example.com")


def test_summarize_and_tag_raises_on_missing_fields(monkeypatch):
    incomplete = json.dumps({"summary": "Just a summary, nothing else."})
    fake_client = _FakeClient(incomplete)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    with pytest.raises(ai_service.AIServiceError):
        ai_service.summarize_and_tag(page_text="x", user_note=None, url="https://example.com")


def test_summarize_and_tag_raises_on_too_few_tags(monkeypatch):
    response = json.dumps(
        {
            "summary": "A short summary.",
            "tags": ["only-one-tag"],
            "intent_category": "research",
            "ai_reason": None,
        }
    )
    fake_client = _FakeClient(response)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    with pytest.raises(ai_service.AIServiceError):
        ai_service.summarize_and_tag(page_text="x", user_note=None, url="https://example.com")


def test_summarize_and_tag_raises_when_provider_call_fails(monkeypatch):
    import anthropic

    fake_client = _FakeClient(
        "", raise_error=anthropic.APIConnectionError(request=SimpleNamespace())
    )
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    with pytest.raises(ai_service.AIServiceError):
        ai_service.summarize_and_tag(page_text="x", user_note=None, url="https://example.com")


# --- answer_query (Memory Assistant) ---------------------------------------

def _make_link(**overrides) -> Link:
    defaults = dict(
        url="https://example.com/pricing",
        title="Competitor Pricing Breakdown",
        ai_summary="A guide to benchmarking pricing across a market.",
        user_note="Saving for the Q3 pricing deck",
        ai_reason=None,
        status="enriched",
    )
    defaults.update(overrides)
    link = Link(**defaults)
    link.tags = []  # avoid touching the DB for the relationship
    return link


def test_answer_query_success(monkeypatch):
    fake_client = _FakeClient("You saved 'Competitor Pricing Breakdown' for the Q3 pricing deck.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    answer = ai_service.answer_query(question="what did I save about pricing?", candidates=[_make_link()])

    assert "Competitor Pricing Breakdown" in answer
    assert fake_client.messages.last_call_kwargs["model"] == ai_service.CLAUDE_MODEL
    assert "candidate links" in fake_client.messages.last_call_kwargs["system"].lower()


def test_answer_query_raises_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(ai_service.AIServiceError):
        ai_service.answer_query(question="x", candidates=[_make_link()])


def test_answer_query_raises_on_empty_response(monkeypatch):
    fake_client = _FakeClient("   ")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)
    with pytest.raises(ai_service.AIServiceError):
        ai_service.answer_query(question="x", candidates=[_make_link()])


def test_answer_query_raises_when_provider_call_fails(monkeypatch):
    import anthropic

    fake_client = _FakeClient("", raise_error=anthropic.APIConnectionError(request=SimpleNamespace()))
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)
    with pytest.raises(ai_service.AIServiceError):
        ai_service.answer_query(question="x", candidates=[_make_link()])
