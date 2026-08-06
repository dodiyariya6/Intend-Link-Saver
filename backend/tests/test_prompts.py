"""Tests for the centralized prompt-building logic (no network/AI calls)."""
from app.prompts.summarize_and_tag import build_user_message, note_is_sparse


def test_note_is_sparse_for_none():
    assert note_is_sparse(None) is True


def test_note_is_sparse_for_short_note():
    assert note_is_sparse("todo") is True


def test_note_is_sparse_for_whitespace_only():
    assert note_is_sparse("    ") is True


def test_note_is_not_sparse_for_real_note():
    assert note_is_sparse("Saving this for the Q3 pricing deck comparison.") is False


def test_build_user_message_asks_for_inferred_reason_when_note_missing():
    message = build_user_message(page_text="some content", user_note=None, url="https://example.com")
    assert "did not provide a note" in message
    assert "https://example.com" in message
    assert "some content" in message


def test_build_user_message_tells_model_not_to_override_real_note():
    message = build_user_message(
        page_text="some content",
        user_note="Saving for the client pitch deck.",
        url="https://example.com",
    )
    assert "do not" in message.lower()
    assert "Saving for the client pitch deck." in message


def test_build_user_message_truncates_long_page_text():
    long_text = "x" * 50000
    message = build_user_message(page_text=long_text, user_note=None, url="https://example.com")
    assert len(message) < len(long_text) + 1000
