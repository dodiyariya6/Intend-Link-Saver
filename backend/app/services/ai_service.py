"""
Centralized AI service — the only module in the app that talks to an LLM
provider.

Everything provider-specific (which SDK, which model, how the response is
shaped) lives here and in `app.prompts`. To swap providers or models later,
this is the only file that needs to change — routers and other services
call `summarize_and_tag()` and never touch the Anthropic SDK directly.
"""
import json
import logging
from dataclasses import dataclass

import anthropic

from app.config import settings
from app.prompts.summarize_and_tag import SYSTEM_PROMPT, build_user_message

logger = logging.getLogger(__name__)

# claude-3-5-haiku is intentionally chosen over a larger model: this call is
# summarization/classification, not open-ended reasoning, so the cheaper/
# faster model is plenty and keeps per-link cost and latency down.
CLAUDE_MODEL = "claude-3-5-haiku-20241022"
MAX_OUTPUT_TOKENS = 1024
REQUIRED_TAG_MIN = 3
REQUIRED_TAG_MAX = 7


class AIServiceError(Exception):
    """
    Raised for any failure in the AI call — missing credentials, a
    provider/network error, or a response we can't parse into the expected
    shape. Callers (the enrichment pipeline) are expected to catch this and
    leave the link's AI fields empty rather than let it propagate.
    """


@dataclass
class EnrichmentResult:
    ai_summary: str
    tags: list[str]
    intent_category: str
    ai_reason: str | None  # populated only when the caller needed it inferred


def _get_client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        raise AIServiceError("ANTHROPIC_API_KEY is not configured")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _extract_text(response: anthropic.types.Message) -> str:
    return "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )


def _parse_response(raw_text: str) -> EnrichmentResult:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise AIServiceError(f"AI response was not valid JSON: {raw_text[:200]!r}") from exc

    if not isinstance(data, dict):
        raise AIServiceError(f"AI response JSON was not an object: {raw_text[:200]!r}")

    try:
        summary = str(data["summary"]).strip()
        intent_category = str(data["intent_category"]).strip()
    except KeyError as exc:
        raise AIServiceError(f"AI response missing required field: {exc}") from exc

    raw_tags = data.get("tags") or []
    if not isinstance(raw_tags, list):
        raise AIServiceError(f"AI response 'tags' was not a list: {raw_tags!r}")
    tags = [str(tag).strip().lower() for tag in raw_tags if str(tag).strip()][:REQUIRED_TAG_MAX]

    ai_reason_raw = data.get("ai_reason")
    ai_reason = str(ai_reason_raw).strip() if ai_reason_raw else None

    if not summary or not intent_category:
        raise AIServiceError(f"AI response had empty required fields: {data!r}")
    if len(tags) < REQUIRED_TAG_MIN:
        raise AIServiceError(f"AI response returned too few tags ({len(tags)}): {data!r}")

    return EnrichmentResult(
        ai_summary=summary,
        tags=tags,
        intent_category=intent_category,
        ai_reason=ai_reason,
    )


def summarize_and_tag(*, page_text: str, user_note: str | None, url: str) -> EnrichmentResult:
    """
    One Claude call that returns a summary, 3-7 tags, an intent category,
    and (only if `user_note` is missing/too short) an inferred reason for
    saving. Raises AIServiceError on any failure.
    """
    client = _get_client()
    user_message = build_user_message(page_text=page_text, user_note=user_note, url=url)

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as exc:
        raise AIServiceError(f"Claude API call failed: {exc}") from exc

    raw_text = _extract_text(response)
    return _parse_response(raw_text)
