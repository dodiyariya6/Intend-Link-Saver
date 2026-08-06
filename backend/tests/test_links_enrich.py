"""Router-level tests for POST /links/{id}/enrich, including ownership."""
from app.models.link import EMBEDDING_DIM
from app.services import ai_service, embedding_service, enrichment_service, fetch_service


def _register_and_login(client, email: str, password: str = "supersecret123") -> str:
    client.post("/auth/register", json={"email": email, "password": password})
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_enrich_requires_auth(client):
    response = client.post("/links/00000000-0000-0000-0000-000000000000/enrich")
    assert response.status_code == 401


def test_enrich_nonexistent_link_returns_404(client):
    token = _register_and_login(client, "enrich-router-a@example.com")
    response = client.post(
        "/links/00000000-0000-0000-0000-000000000000/enrich", headers=_auth_headers(token)
    )
    assert response.status_code == 404


def test_enrich_success(client, monkeypatch):
    monkeypatch.setattr(
        fetch_service, "fetch_page_text", lambda url: ("page body", "Extracted Title")
    )
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="A concise summary.",
            tags=["one", "two", "three"],
            intent_category="research",
            ai_reason="Inferred reason.",
        ),
    )
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda text: [0.2] * EMBEDDING_DIM)

    token = _register_and_login(client, "enrich-router-b@example.com")
    create_resp = client.post(
        "/links", json={"url": "https://example.com/x"}, headers=_auth_headers(token)
    )
    link_id = create_resp.json()["id"]

    response = client.post(f"/links/{link_id}/enrich", headers=_auth_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["embedding_generated"] is True
    assert body["link"]["ai_summary"] == "A concise summary."
    assert body["link"]["intent_category"] == "research"
    assert body["link"]["status"] == "enriched"
    assert sorted(body["link"]["tags"]) == ["one", "three", "two"]
    assert body["link"]["title"] == "Extracted Title"


def test_enrich_embedding_failure_still_reports_overall_success(client, monkeypatch):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("page body", None))
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="Summary.", tags=["a", "b", "c"], intent_category="research", ai_reason=None
        ),
    )

    def _raise_embedding_error(text):
        raise embedding_service.EmbeddingServiceError("provider unavailable")

    monkeypatch.setattr(embedding_service, "generate_embedding", _raise_embedding_error)

    token = _register_and_login(client, "enrich-router-embed-fail@example.com")
    create_resp = client.post(
        "/links", json={"url": "https://example.com/z"}, headers=_auth_headers(token)
    )
    link_id = create_resp.json()["id"]

    response = client.post(f"/links/{link_id}/enrich", headers=_auth_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True  # AI summary/tags/category still succeeded
    assert body["embedding_generated"] is False
    assert "embedding" in body["detail"].lower()
    assert body["link"]["status"] == "enriched"
    assert body["link"]["ai_summary"] == "Summary."


def test_enrich_failure_returns_meaningful_status_and_preserves_link(client, monkeypatch):
    def _raise_fetch_error(url):
        raise fetch_service.FetchError("simulated dead link")

    monkeypatch.setattr(fetch_service, "fetch_page_text", _raise_fetch_error)

    token = _register_and_login(client, "enrich-router-c@example.com")
    create_resp = client.post(
        "/links", json={"url": "https://example.com/y"}, headers=_auth_headers(token)
    )
    link_id = create_resp.json()["id"]

    response = client.post(f"/links/{link_id}/enrich", headers=_auth_headers(token))
    assert response.status_code == 200  # the request succeeded; enrichment itself failed
    body = response.json()
    assert body["success"] is False
    assert "simulated dead link" in body["detail"]
    assert body["link"]["status"] == "failed"
    assert body["link"]["url"] == "https://example.com/y"

    # the link is still retrievable afterward, unchanged aside from status
    get_resp = client.get(f"/links/{link_id}", headers=_auth_headers(token))
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "failed"


def test_user_cannot_enrich_another_users_link(client, monkeypatch):
    monkeypatch.setattr(fetch_service, "fetch_page_text", lambda url: ("body", None))
    monkeypatch.setattr(
        ai_service,
        "summarize_and_tag",
        lambda **kwargs: ai_service.EnrichmentResult(
            ai_summary="s", tags=["a", "b", "c"], intent_category="research", ai_reason=None
        ),
    )

    token_a = _register_and_login(client, "enrich-router-d@example.com")
    token_b = _register_and_login(client, "enrich-router-e@example.com")

    create_resp = client.post(
        "/links", json={"url": "https://example.com/private"}, headers=_auth_headers(token_a)
    )
    link_id = create_resp.json()["id"]

    response = client.post(f"/links/{link_id}/enrich", headers=_auth_headers(token_b))
    assert response.status_code == 404

    # confirm A's link was untouched by B's attempt
    check = client.get(f"/links/{link_id}", headers=_auth_headers(token_a))
    assert check.json()["status"] == "ready"
    assert check.json()["ai_summary"] is None
