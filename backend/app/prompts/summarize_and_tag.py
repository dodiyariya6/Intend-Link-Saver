"""
Prompt for the single enrichment Gemini call: summarize the page, propose
tags, classify intent, and (only when needed) infer why it was saved.

Keeping the prompt text here rather than inline in ai_service.py means
prompt iteration is a change to this file only — ai_service.py just calls
these functions and doesn't know or care what the wording is.
"""

# A note shorter than this is treated as "not really a note" and the model is
# asked to infer a reason to fill the gap instead.
MIN_NOTE_LENGTH = 12

SYSTEM_PROMPT = """You are an assistant that reads a saved web page and returns structured \
metadata about it. Respond with ONLY a single JSON object — no prose, no \
markdown code fences, no commentary — matching exactly this shape:

{
  "summary": "<2-4 sentence summary of the page's content>",
  "tags": ["<3 to 7 short, lowercase, topical tags>"],
  "intent_category": "<one short label, e.g. research, read-later, reference, \
tutorial, shopping, news>",
  "ai_reason": "<a short guess at why someone would save this page, or null>"
}

Rules:
- "tags" must have between 3 and 7 items.
- "intent_category" must be a single short label, not a sentence.
- Only fill in "ai_reason" when told the user did not provide their own note. \
If the user's own note is given to you, set "ai_reason" to null — never \
invent a reason to replace or override the user's own words.
- Base everything on the page content actually provided. If the content is \
thin, still do your best with what's there."""


def note_is_sparse(user_note: str | None) -> bool:
    """A note counts as present only if it's more than a few throwaway words."""
    return not user_note or len(user_note.strip()) < MIN_NOTE_LENGTH


def build_user_message(*, page_text: str, user_note: str | None, url: str) -> str:
    if note_is_sparse(user_note):
        note_section = (
            "The user did not provide a note (or it was too short to be useful). "
            'Fill in "ai_reason" with your best short guess at why this page is '
            "worth saving, based on its content."
        )
    else:
        note_section = (
            f'The user\'s own note about why they saved it: "{user_note.strip()}"\n'
            'A real note was provided, so set "ai_reason" to null — do not '
            "invent or override the user's own words."
        )

    # Keep page text bounded: long pages cost tokens without adding much
    # summarization value beyond the first several thousand characters.
    truncated_text = page_text[:12000]

    return f"URL: {url}\n\n{note_section}\n\nPage content:\n{truncated_text}"
