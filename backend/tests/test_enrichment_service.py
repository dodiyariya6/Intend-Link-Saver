"""
Tests for enrichment_service — the orchestration layer. fetch_service and
ai_service are monkeypatched here (they have their own dedicated tests) so
these focus purely on: does a saved link get correctly updated, and is it
correctly preserved on failure.
"""
import uuid

import pytest

from app.models.link import Link
from app.services import ai_service, enrichment_service, fetch_service, link_service


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
