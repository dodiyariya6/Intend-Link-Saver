"""
Fetches a URL and extracts clean, readable text from the page.

Kept separate from ai_service so "how we get page content" (HTTP client,
extraction library, eventually maybe a headless browser for JS-heavy
pages) can change without touching anything AI-related.
"""
import logging

import httpx
import trafilatura

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 10.0
# Read at most this many bytes of the response body — enough for any normal
# article page, and a safety cap against being handed something huge.
MAX_RESPONSE_BYTES = 2_000_000
USER_AGENT = "Mozilla/5.0 (compatible; IntendLinkSaverBot/1.0; +https://github.com/)"


class FetchError(Exception):
    """
    Raised when a page can't be fetched or no readable text could be
    extracted from it. Callers (the enrichment pipeline) are expected to
    catch this, leave the link's AI fields empty, and preserve the saved
    link rather than propagate the failure.
    """


def fetch_page_text(url: str) -> tuple[str, str | None]:
    """
    Fetch `url` and return (extracted_text, page_title).

    `page_title` is best-effort and may be None even on success — callers
    should not depend on it being present.
    """
    try:
        response = httpx.get(
            url,
            timeout=DEFAULT_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )
    except httpx.HTTPError as exc:
        raise FetchError(f"Could not fetch {url}: {exc}") from exc

    if response.status_code >= 400:
        raise FetchError(f"Could not fetch {url}: HTTP {response.status_code}")

    html = response.text[:MAX_RESPONSE_BYTES]

    extracted_text = trafilatura.extract(html, url=url)
    if not extracted_text or not extracted_text.strip():
        raise FetchError(f"No readable content could be extracted from {url}")

    title = None
    try:
        metadata = trafilatura.extract_metadata(html, default_url=url)
        title = metadata.title if metadata else None
    except Exception:  # pragma: no cover — metadata extraction is best-effort
        logger.debug("Metadata extraction failed for %s", url, exc_info=True)

    return extracted_text.strip(), title
