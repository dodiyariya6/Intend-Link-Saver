"""
Orchestrates the enrichment pipeline for a single link:

    fetch page text -> summarize/tag/classify via Claude -> persist onto Link

Fetch and AI failures are caught here so a saved link is never lost or left
half-written — on any failure the link's existing fields are left exactly
as they were, `status` is set to "failed", and a human-readable detail is
returned to the caller (not persisted — there's no dedicated error column,
and adding one isn't necessary for this to work).
"""
import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.link import Link
from app.prompts.summarize_and_tag import note_is_sparse
from app.services import ai_service, fetch_service, link_service

logger = logging.getLogger(__name__)


@dataclass
class EnrichmentOutcome:
    link: Link
    success: bool
    detail: str


def enrich_link(db: Session, link: Link) -> EnrichmentOutcome:
    """Run the full enrichment pipeline for `link` and persist the results."""
    try:
        page_text, extracted_title = fetch_service.fetch_page_text(link.url)
    except fetch_service.FetchError as exc:
        logger.warning("Fetch failed for link %s: %s", link.id, exc)
        link.status = "failed"
        db.commit()
        db.refresh(link)
        return EnrichmentOutcome(
            link=link, success=False, detail=f"Could not fetch or read the page: {exc}"
        )

    try:
        result = ai_service.summarize_and_tag(
            page_text=page_text, user_note=link.user_note, url=link.url
        )
    except ai_service.AIServiceError as exc:
        logger.warning("AI enrichment failed for link %s: %s", link.id, exc)
        link.status = "failed"
        db.commit()
        db.refresh(link)
        return EnrichmentOutcome(link=link, success=False, detail=f"AI enrichment failed: {exc}")

    link.ai_summary = result.ai_summary
    link.intent_category = result.intent_category

    # Never overwrite the user's own note. Only ever write ai_reason, and
    # only when the note was missing/too short in the first place — this is
    # re-checked here (not just trusted from the prompt) as a deliberate
    # second guard against overwriting the user's own words.
    if result.ai_reason and note_is_sparse(link.user_note):
        link.ai_reason = result.ai_reason

    # Fill in a title if the link doesn't already have one; never override
    # a title the user (or a future fetch) already set.
    if not link.title and extracted_title:
        link.title = extracted_title

    # Merge AI-generated tags with any tags the user already added manually,
    # rather than replacing them — enrichment should add information, not
    # discard what the user already did.
    existing_tag_names = [tag.name for tag in link.tags]
    link.tags = link_service.get_or_create_tags(db, link.user_id, existing_tag_names + result.tags)

    link.status = "enriched"

    db.commit()
    db.refresh(link)
    return EnrichmentOutcome(link=link, success=True, detail="Link enriched successfully")
