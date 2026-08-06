"""
Orchestrates the enrichment pipeline for a single link:

    fetch page text -> summarize/tag/classify via Claude
                     -> generate + store an embedding
                     -> persist onto Link

Fetch and AI failures are caught here so a saved link is never lost or left
half-written — on any failure the link's existing fields are left exactly
as they were, `status` is set to "failed", and a human-readable detail is
returned to the caller (not persisted — there's no dedicated error column,
and adding one isn't necessary for this to work).

Embedding failure is treated as non-fatal to the overall run: the
summary/tags/category Claude already produced are still valuable and are
still saved, `status` still becomes "enriched", but `embedding_generated`
comes back False and `detail` explains why. Re-running `/enrich` retries
the embedding step along with everything else — there's no separate
caching/skip logic, so every run regenerates the embedding from whatever
content is current at that time.
"""
import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.link import Link
from app.prompts.summarize_and_tag import note_is_sparse
from app.services import ai_service, embedding_service, fetch_service, link_service

logger = logging.getLogger(__name__)


@dataclass
class EnrichmentOutcome:
    link: Link
    success: bool
    detail: str
    embedding_generated: bool = False


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

    # Regenerate the embedding from whatever the enriched content is right
    # now (user_note-or-ai_reason + ai_summary + tags). Every call to
    # enrich_link runs this fresh — there's no "skip if already embedded"
    # check — so re-triggering enrichment after the note/url/tags changed
    # naturally produces an up-to-date vector.
    embedding_generated = False
    detail = "Link enriched successfully"
    try:
        embedding_input = embedding_service.build_embedding_input(
            user_note=link.user_note,
            ai_reason=link.ai_reason,
            ai_summary=link.ai_summary,
            tags=[tag.name for tag in link.tags],
        )
        link.embedding = embedding_service.generate_embedding(embedding_input)
        embedding_generated = True
    except embedding_service.EmbeddingServiceError as exc:
        logger.warning("Embedding generation failed for link %s: %s", link.id, exc)
        detail = f"Link enriched, but embedding generation failed: {exc}"

    link.status = "enriched"

    db.commit()
    db.refresh(link)
    return EnrichmentOutcome(
        link=link, success=True, detail=detail, embedding_generated=embedding_generated
    )
