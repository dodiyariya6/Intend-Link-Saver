"""Tests for the Memory Assistant prompt-building logic (no network/AI calls)."""
from app.models.link import Link
from app.prompts.answer_query import build_user_message


def _make_link(**overrides) -> Link:
    defaults = dict(
        url="https://example.com/pricing",
        title="Competitor Pricing Breakdown",
        ai_summary="A guide to benchmarking pricing.",
        user_note="Saving for the Q3 deck",
        ai_reason=None,
        status="enriched",
    )
    defaults.update(overrides)
    link = Link(**defaults)
    link.tags = []
    return link


def test_build_user_message_includes_the_question():
    message = build_user_message(question="what did I save about pricing?", candidates=[_make_link()])
    assert "what did I save about pricing?" in message


def test_build_user_message_includes_candidate_details():
    message = build_user_message(question="x", candidates=[_make_link()])
    assert "Competitor Pricing Breakdown" in message
    assert "benchmarking pricing" in message
    assert "Saving for the Q3 deck" in message


def test_build_user_message_handles_no_candidates():
    message = build_user_message(question="anything?", candidates=[])
    assert "no saved links matching" in message.lower()


def test_build_user_message_falls_back_to_url_when_no_title():
    message = build_user_message(question="x", candidates=[_make_link(title=None)])
    assert "https://example.com/pricing" in message
