"""
Tests for fetch_service — run against a real local HTTP server (not
mocked) so the actual HTTP + trafilatura extraction path is exercised
end-to-end, without depending on external network access.
"""
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.services import fetch_service

ARTICLE_HTML = b"""
<!doctype html>
<html>
<head><title>A Guide to Competitor Pricing Analysis</title></head>
<body>
<article>
<h1>A Guide to Competitor Pricing Analysis</h1>
<p>Understanding how competitors price their products is essential for any
business planning a pricing strategy. This guide walks through the key
frameworks used by analysts to benchmark pricing across a market.</p>
<p>We cover value-based pricing, cost-plus pricing, and dynamic pricing
models, with real examples from several industries.</p>
</article>
</body>
</html>
"""

EMPTY_HTML = b"<!doctype html><html><head></head><body></body></html>"


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 — required method name for BaseHTTPRequestHandler
        if self.path == "/article":
            body = ARTICLE_HTML
            status = 200
        elif self.path == "/empty":
            body = EMPTY_HTML
            status = 200
        elif self.path == "/not-found":
            body = b"not found"
            status = 404
        else:
            body = b"not found"
            status = 404

        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):  # noqa: A002 — silence test server logging
        pass


@pytest.fixture(scope="module")
def local_server():
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    thread.join()


def test_fetch_page_text_extracts_readable_content(local_server):
    text, title = fetch_service.fetch_page_text(f"{local_server}/article")
    assert "competitor" in text.lower()
    assert "pricing strategy" in text.lower()
    assert title == "A Guide to Competitor Pricing Analysis"


def test_fetch_page_text_raises_on_404(local_server):
    with pytest.raises(fetch_service.FetchError):
        fetch_service.fetch_page_text(f"{local_server}/not-found")


def test_fetch_page_text_raises_when_no_extractable_content(local_server):
    with pytest.raises(fetch_service.FetchError):
        fetch_service.fetch_page_text(f"{local_server}/empty")


def test_fetch_page_text_raises_on_connection_error():
    # Nothing listening on this port.
    with pytest.raises(fetch_service.FetchError):
        fetch_service.fetch_page_text("http://127.0.0.1:1")
