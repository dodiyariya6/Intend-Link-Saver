"""
Tests for enrichment_service — the orchestration layer. fetch_service,
ai_service, and embedding_service are monkeypatched here (they have their
own dedicated tests) so these focus purely on: does a saved link get
correctly updated, and is it correctly preserved on failure.
"""
import uuid

import pytest

from app.models.link import Link
from app.services import ai_service, embedding_service, enrichment_service, fetch_service, link_service


@pytest.fixture()
def owner_id(client):
    """A real user id, since Link.user_id has a FK to users."""
    resp = client.post(
        "/auth/register", json={"email": "enrich-owner@example.com", "password": "supersecret123"}
    )
    return uuid.UUID(resp.json()["id"])


@pytest.fixture()
def saved_link(db_session, owner_id):
    link = Link(
        user_id=owner_id,
        url="https://example.com/pricing-guide",
        user_note=None,
        status="ready",
    )
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)
    return link


def test_enrich_link_success_updates_all_fields(monkeypatch, db_session, saved_link):
    monkeypatch.setattr(
        fetch_service, "fetch_page_text", lambda url: ("page body text", "Pricing Guide")
    )
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="A guide to pricing strategy.",
            tags=["pricing", "strategy", "research"],
            intent_category="research",
            ai_reason="Looks useful for competitive analysis.",
        ),
    )

    outcome = enrichment_service.enrich_link(db_session, saved_link)

    assert outcome.success is True
    assert outcome.link.ai_summary == "A guide to pricing strategy."
    assert outcome.link.intent_category == "research"
    assert outcome.link.title == "Pricing Guide"
    assert outcome.link.status == "enriched"
    assert sorted(t.name for t in outcome.link.tags) == ["pricing", "research", "strategy"]
    # note was empty, so ai_reason should have been filled in
    assert outcome.link.ai_reason == "Looks useful for competitive analysis."


def test_enrich_link_never_overwrites_user_note(monkeypatch, db_session, owner_id):
    link = Link(
        user_id=owner_id,
        url="https://example.com/a",
        user_note="Saving this for the Q3 pricing deck.",
        status="ready",
    )
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)

    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body", None))
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="Summary.",
            tags=["a", "b", "c"],
            intent_category="research",
            ai_reason="Should never be used since a real note was given.",
        ),
    )

    outcome = enrichment_service.enrich_link(db_session, link)

    assert outcome.link.user_note == "Saving this for the Q3 pricing deck."
    # ai_reason must stay empty — the user's own note takes priority
    assert outcome.link.ai_reason is None


def test_enrich_link_merges_tags_with_existing_manual_tags(monkeypatch, db_session, owner_id):
    link = Link(user_id=owner_id, url="https://example.com/a", status="ready")
    link.tags = link_service.get_or_create_tags(db_session, owner_id, ["manual-tag"])
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)

    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body", None))
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="Summary.", tags=["ai-tag"], intent_category="research", ai_reason=None
        ),
    )

    outcome = enrichment_service.enrich_link(db_session, link)
    assert sorted(t.name for t in outcome.link.tags) == ["ai-tag", "manual-tag"]


def test_enrich_link_preserves_link_on_fetch_failure(monkeypatch, db_session, saved_link):
    def _raise_fetch_error(url):
        raise fetch_service.FetchError("dead link")

    monkeypatch.setattr(fetch_service, "fetch_page_text", _raise_fetch_error)

    outcome = enrichment_service.enrich_link(db_session, saved_link)

    assert outcome.success is False
    assert "Could not fetch" in outcome.detail
    assert outcome.link.status == "failed"
    # the link itself is preserved, not deleted or blanked out
    assert outcome.link.url == "https://example.com/pricing-guide"
    assert outcome.link.ai_summary is None


def test_enrich_link_preserves_link_on_ai_failure(monkeypatch, db_session, saved_link):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body text", None))

    def _raise_ai_error(**kwargs):
        raise ai_service.AIServiceError("provider timeout")

    monkeypatch.setattr(ai_service, "summarize_and_tag", _raise_ai_error)

    outcome = enrichment_service.enrich_link(db_session, saved_link)

    assert outcome.success is False
    assert "AI enrichment failed" in outcome.detail
    assert outcome.link.status == "failed"
    assert outcome.link.url == "https://example.com/pricing-guide"
    assert outcome.link.ai_summary is None


# --- embedding integration ------------------------------------------------

def _mock_ai_success(monkeypatch, *, ai_reason=None):
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="A guide to pricing strategy.",
            tags=["pricing", "strategy"],
            intent_category="research",
            ai_reason=ai_reason,
        ),
    )


def test_enrich_link_generates_and_stores_embedding(monkeypatch, db_session, saved_link):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body text", None))
    _mock_ai_success(monkeypatch, ai_reason="Useful for research")

    fake_vector = [0.5] * embedding_service.EMBEDDING_DIM
    captured_input = {}

    def _fake_generate_embedding(text):
        captured_input["text"] = text
        return fake_vector

    monkeypatch.setattr(embedding_service, "generate_embedding", _fake_generate_embedding)

    outcome = enrichment_service.enrich_link(db_session, saved_link)

    assert outcome.success is True
    assert outcome.embedding_generated is True
    # pgvector returns a numpy array after a DB refresh — compare as a list
    assert list(outcome.link.embedding) == pytest.approx(fake_vector, abs=1e-4)
    assert len(outcome.link.embedding) == embedding_service.EMBEDDING_DIM

    # confirm the embedding input was built from the enriched content, not
    # raw page text — should include the AI-inferred reason and summary
    assert "Useful for research" in captured_input["text"]
    assert "A guide to pricing strategy." in captured_input["text"]

    # confirm it round-trips correctly from a *fresh* query against the DB,
    # not just the in-memory object
    reloaded = link_service.get_link(db_session, saved_link.user_id, saved_link.id)
    assert reloaded.embedding is not None
    assert len(reloaded.embedding) == embedding_service.EMBEDDING_DIM
    assert list(reloaded.embedding) == pytest.approx(fake_vector, abs=1e-4)


def test_enrich_link_embedding_input_prefers_real_user_note(monkeypatch, db_session, owner_id):
    link = Link(
        user_id=owner_id, url="https://example.com/a", user_note="For the client pitch", status="ready"
    )
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)

    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body text", None))
    _mock_ai_success(monkeypatch, ai_reason="Should be ignored — a real note was given")

    captured_input = {}

    def _fake_generate_embedding(text):
        captured_input["text"] = text
        return [0.1] * embedding_service.EMBEDDING_DIM

    monkeypatch.setattr(embedding_service, "generate_embedding", _fake_generate_embedding)

    enrichment_service.enrich_link(db_session, link)

    assert captured_input["text"].startswith("For the client pitch")
    assert "Should be ignored" not in captured_input["text"]


def test_enrich_link_regenerates_embedding_on_second_run(monkeypatch, db_session, saved_link):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body text", None))
    _mock_ai_success(monkeypatch)

    first_vector = [0.1] * embedding_service.EMBEDDING_DIM
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda text: first_vector)
    first_outcome = enrichment_service.enrich_link(db_session, saved_link)
    assert list(first_outcome.link.embedding) == pytest.approx(first_vector, abs=1e-4)

    # simulate the link's content changing (e.g. user updated their note),
    # then re-running enrichment — nothing should skip/cache the old vector
    second_vector = [0.9] * embedding_service.EMBEDDING_DIM
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda text: second_vector)
    second_outcome = enrichment_service.enrich_link(db_session, saved_link)

    second_list = list(second_outcome.link.embedding)
    assert second_list == pytest.approx(second_vector, abs=1e-4)
    assert second_list != pytest.approx(first_vector, abs=1e-4)


def test_enrich_link_embedding_failure_does_not_fail_overall_enrichment(
    monkeypatch, db_session, saved_link
):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body text", None))
    _mock_ai_success(monkeypatch)

    def _raise_embedding_error(text):
        raise embedding_service.EmbeddingServiceError("provider unavailable")

    monkeypatch.setattr(embedding_service, "generate_embedding", _raise_embedding_error)

    outcome = enrichment_service.enrich_link(db_session, saved_link)

    # AI summary/tags/category are still valuable and still saved
    assert outcome.success is True
    assert outcome.link.status == "enriched"
    assert outcome.link.ai_summary == "A guide to pricing strategy."
    # but the embedding step is reported as failed, and nothing was stored
    assert outcome.embedding_generated is False
    assert outcome.link.embedding is None
    assert "embedding generation failed" in outcome.detail.lower()


def test_enrich_link_does_not_attempt_embedding_when_fetch_fails(monkeypatch, db_session, saved_link):
    monkeypatch.setattr(
        fetch_service, "fetch_page_text", lambda url: (_ for _ in ()).throw(fetch_service.FetchError("dead"))
    )

    calls = []
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda text: calls.append(text))

    enrichment_service.enrich_link(db_session, saved_link)
    assert calls == []


def test_enrich_link_does_not_attempt_embedding_when_ai_fails(monkeypatch, db_session, saved_link):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body", None))

    def _raise_ai_error(**kwargs):
        raise ai_service.AIServiceError("provider timeout")

    monkeypatch.setattr(ai_service, "summarize_and_tag", _raise_ai_error)

    calls = []
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda text: calls.append(text))

    enrichment_service.enrich_link(db_session, saved_link)
    assert calls == []
