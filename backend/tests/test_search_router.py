"""
Router-level tests for GET /search, including auth, ownership, and the
embedding-failure path. embedding_service.generate_embedding is
monkeypatched so we control exactly what vector a given query text
produces, without needing a real GEMINI_API_KEY.
"""
import uuid

import pytest

from app.models.link import EMBEDDING_DIM, Link
from app.services import embedding_service, link_service


def _vector(x: float, y: float) -> list[float]:
    return [x, y] + [0.0] * (EMBEDDING_DIM - 2)


def _register_and_login(client, email: str, password: str = "supersecret123") -> str:
    client.post("/auth/register", json={"email": email, "password": password})
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _stub_query_embedding(monkeypatch):
    """
    By default, map query text deterministically to a vector so tests can
    control similarity: "pricing" -> (1, 0), "recipe" -> (0, 1), anything
    else -> (0.5, 0.5). Individual tests can override this.
    """

    def _fake(text: str):
        if "pricing" in text.lower():
            return _vector(1.0, 0.0)
        if "recipe" in text.lower():
            return _vector(0.0, 1.0)
        return _vector(0.5, 0.5)

    monkeypatch.setattr(embedding_service, "generate_embedding", _fake)


def _make_link(db_session, user_id, url, *, vector=None, intent_category=None, tags=None, status="enriched"):
    link = Link(user_id=user_id, url=url, embedding=vector, intent_category=intent_category, status=status)
    if tags:
        link.tags = link_service.get_or_create_tags(db_session, user_id, tags)
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)
    return link


# --- auth ---------------------------------------------------------------

def test_search_requires_auth(client):
    response = client.get("/search?q=pricing")
    assert response.status_code == 401


def test_search_requires_query_param(client):
    token = _register_and_login(client, "search-router-a@example.com")
    response = client.get("/search", headers=_auth_headers(token))
    assert response.status_code == 422


# --- query embedding + ranking -------------------------------------------

def test_search_generates_query_embedding_and_ranks_results(client, db_session):
    token = _register_and_login(client, "search-router-b@example.com")
    resp = client.get("/auth/me", headers=_auth_headers(token))
    user_id = uuid.UUID(resp.json()["id"])

    exact = _make_link(db_session, user_id, "https://example.com/pricing-exact", vector=_vector(1.0, 0.0))
    close = _make_link(db_session, user_id, "https://example.com/pricing-close", vector=_vector(0.9, 0.1))
    unrelated = _make_link(db_session, user_id, "https://example.com/recipe", vector=_vector(0.0, 1.0))

    response = client.get("/search?q=pricing strategy", headers=_auth_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "pricing strategy"
    assert body["total"] == 3
    ids_in_order = [item["id"] for item in body["items"]]
    assert ids_in_order == [str(exact.id), str(close.id), str(unrelated.id)]
    # similarity scores present and correctly ordered
    scores = [item["similarity"] for item in body["items"]]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] > scores[-1]


def test_search_empty_when_user_has_no_links(client):
    token = _register_and_login(client, "search-router-c@example.com")
    response = client.get("/search?q=anything", headers=_auth_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


# --- ownership --------------------------------------------------------

def test_search_only_returns_own_links(client, db_session):
    token_a = _register_and_login(client, "search-router-d@example.com")
    token_b = _register_and_login(client, "search-router-e@example.com")

    user_a_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token_a)).json()["id"])
    user_b_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token_b)).json()["id"])

    _make_link(db_session, user_a_id, "https://example.com/a", vector=_vector(1.0, 0.0))
    _make_link(db_session, user_b_id, "https://example.com/b", vector=_vector(1.0, 0.0))

    response = client.get("/search?q=pricing", headers=_auth_headers(token_a))
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/a"


# --- pagination -----------------------------------------------------------

def test_search_pagination(client, db_session):
    token = _register_and_login(client, "search-router-f@example.com")
    user_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token)).json()["id"])

    vectors = [_vector(1.0, 0.0), _vector(0.8, 0.2), _vector(0.6, 0.4), _vector(0.4, 0.6), _vector(0.2, 0.8)]
    for i, v in enumerate(vectors):
        _make_link(db_session, user_id, f"https://example.com/{i}", vector=v)

    page1 = client.get("/search?q=pricing&page=1&page_size=2", headers=_auth_headers(token)).json()
    assert page1["total"] == 5
    assert page1["page"] == 1
    assert page1["pages"] == 3
    assert len(page1["items"]) == 2

    page2 = client.get("/search?q=pricing&page=2&page_size=2", headers=_auth_headers(token)).json()
    page3 = client.get("/search?q=pricing&page=3&page_size=2", headers=_auth_headers(token)).json()
    assert len(page2["items"]) == 2
    assert len(page3["items"]) == 1

    all_ids = {i["id"] for i in page1["items"] + page2["items"] + page3["items"]}
    assert len(all_ids) == 5


# --- filters --------------------------------------------------------

def test_search_filter_by_intent_category_and_tags(client, db_session):
    token = _register_and_login(client, "search-router-g@example.com")
    user_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token)).json()["id"])

    _make_link(
        db_session, user_id, "https://example.com/a", vector=_vector(1.0, 0.0),
        intent_category="research", tags=["pricing"],
    )
    _make_link(
        db_session, user_id, "https://example.com/b", vector=_vector(0.9, 0.1),
        intent_category="read-later", tags=["pricing"],
    )

    response = client.get(
        "/search?q=pricing&intent_category=research&tags=pricing", headers=_auth_headers(token)
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/a"


# --- embedding failure ----------------------------------------------------

def test_search_returns_503_when_query_embedding_fails(client, monkeypatch):
    def _raise(text):
        raise embedding_service.EmbeddingServiceError("provider unavailable")

    monkeypatch.setattr(embedding_service, "generate_embedding", _raise)

    token = _register_and_login(client, "search-router-h@example.com")
    response = client.get("/search?q=pricing", headers=_auth_headers(token))
    assert response.status_code == 503
