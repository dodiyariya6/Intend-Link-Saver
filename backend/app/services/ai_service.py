"""
Centralized AI service — the only module in the app that talks to an LLM
provider.

Everything provider-specific (which SDK, which model, how the response is
shaped) lives here and in `app.prompts`. To swap providers or models later,
this is the only file that needs to change — routers and other services
call `summarize_and_tag()` and never touch the Gemini SDK directly.

Uses the same GEMINI_API_KEY as embedding_service.py — one provider, one
credential for the whole AI surface of the app.
"""
import json
import logging
from dataclasses import dataclass

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.config import settings
from app.models.link import Link
from app.prompts.summarize_and_tag import SYSTEM_PROMPT, build_user_message
from app.prompts import answer_query as answer_query_prompt

logger = logging.getLogger(__name__)

# "gemini-flash-latest" (Google's maintained alias for their current
# recommended flash-tier model, rather than a specific dated snapshot that
# can get deprecated) is intentionally chosen over a larger/"pro" model:
# this call is summarization/classification, not open-ended reasoning, so
# the cheaper/faster tier is plenty and keeps per-link cost and latency down.
GEMINI_CHAT_MODEL = "gemini-flash-latest"
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


def _get_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise AIServiceError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.gemini_api_key)


def _extract_text(response: genai_types.GenerateContentResponse) -> str:
    return response.text or ""


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
    One Gemini call that returns a summary, 3-7 tags, an intent category,
    and (only if `user_note` is missing/too short) an inferred reason for
    saving. Raises AIServiceError on any failure.
    """
    client = _get_client()
    user_message = build_user_message(page_text=page_text, user_note=user_note, url=url)

    try:
        response = client.models.generate_content(
            model=GEMINI_CHAT_MODEL,
            contents=user_message,
            config=genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                # SYSTEM_PROMPT already spells out the exact JSON shape; forcing
                # JSON mode here makes the provider itself guarantee valid JSON
                # rather than relying purely on the prompt (belt-and-suspenders
                # around _parse_response's json.loads below).
                response_mime_type="application/json",
            ),
        )
    except genai_errors.APIError as exc:
        raise AIServiceError(f"Gemini API call failed: {exc}") from exc

    raw_text = _extract_text(response)
    return _parse_response(raw_text)


def answer_query(*, question: str, candidates: list[Link]) -> str:
    """
    One Gemini call for the Memory Assistant: given a natural-language
    question and a handful of the user's own candidate links (already
    found via semantic search — this function does no searching itself),
    return a short conversational answer citing them. Raises
    AIServiceError on any failure.
    """
    client = _get_client()
    user_message = answer_query_prompt.build_user_message(question=question, candidates=candidates)

    try:
        response = client.models.generate_content(
            model=GEMINI_CHAT_MODEL,
            contents=user_message,
            config=genai_types.GenerateContentConfig(
                system_instruction=answer_query_prompt.SYSTEM_PROMPT,
                max_output_tokens=300,
            ),
        )
    except genai_errors.APIError as exc:
        raise AIServiceError(f"Gemini API call failed: {exc}") from exc

    answer = _extract_text(response).strip()
    if not answer:
        raise AIServiceError("AI response was empty")
    return answer
