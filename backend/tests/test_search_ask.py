"""
Router-level tests for POST /search/ask (the Memory Assistant). Reuses the
same embedding-stub pattern as test_search_router.py; only ai_service's
Gemini call is additionally mocked, since search_service/embedding_service
are already covered there and this endpoint doesn't add any new
search/ranking logic of its own.
"""
import uuid

import pytest

from app.models.link import EMBEDDING_DIM, Link
from app.services import ai_service, embedding_service, link_service


def _vector(x: float, y: float) -> list[float]:
    return [x, y] + [0.0] * (EMBEDDING_DIM - 2)


def _register_and_login(client, email: str, password: str = "supersecret123") -> str:
    client.post("/auth/register", json={"email": email, "password": password})
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _make_link(db_session, user_id, url, *, vector=None, tags=None):
    link = Link(user_id=user_id, url=url, embedding=vector, status="enriched", ai_summary="A summary.")
    if tags:
        link.tags = link_service.get_or_create_tags(db_session, user_id, tags)
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)
    return link


@pytest.fixture(autouse=True)
def _stub_query_embedding(monkeypatch):
    monkeypatch.setattr(embedding_service, "generate_embedding", lambda text: _vector(1.0, 0.0))


@pytest.fixture(autouse=True)
def _stub_answer(monkeypatch):
    monkeypatch.setattr(
        ai_service, "answer_query", lambda **kwargs: "Here's what I found about that."
    )


def test_ask_requires_auth(client):
    response = client.post("/search/ask", json={"question": "what did I save?"})
    assert response.status_code == 401


def test_ask_requires_a_question(client):
    token = _register_and_login(client, "ask-a@example.com")
    response = client.post("/search/ask", json={"question": ""}, headers=_auth_headers(token))
    assert response.status_code == 422


def test_ask_returns_answer_and_cited_links(client, db_session):
    token = _register_and_login(client, "ask-b@example.com")
    user_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token)).json()["id"])
    link = _make_link(db_session, user_id, "https://example.com/pricing", vector=_vector(1.0, 0.0))

    response = client.post(
        "/search/ask", json={"question": "what did I save about pricing?"}, headers=_auth_headers(token)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Here's what I found about that."
    assert len(body["cited_links"]) == 1
    assert body["cited_links"][0]["id"] == str(link.id)
    # cited links are full LinkOut objects, not search-result items with a
    # similarity score bolted on
    assert "similarity" not in body["cited_links"][0]


def test_ask_with_no_matching_links_returns_graceful_answer_without_calling_ai(client, monkeypatch):
    calls = []
    monkeypatch.setattr(ai_service, "answer_query", lambda **kwargs: calls.append(kwargs))

    token = _register_and_login(client, "ask-c@example.com")
    response = client.post(
        "/search/ask", json={"question": "anything?"}, headers=_auth_headers(token)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cited_links"] == []
    assert "couldn't find anything" in body["answer"].lower()
    assert calls == []  # AI was never called when there's nothing to answer from


def test_ask_only_searches_own_links(client, db_session):
    token_a = _register_and_login(client, "ask-d@example.com")
    token_b = _register_and_login(client, "ask-e@example.com")
    user_a_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token_a)).json()["id"])
    user_b_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token_b)).json()["id"])

    _make_link(db_session, user_b_id, "https://example.com/not-mine", vector=_vector(1.0, 0.0))

    response = client.post(
        "/search/ask", json={"question": "anything?"}, headers=_auth_headers(token_a)
    )
    body = response.json()
    assert body["cited_links"] == []


def test_ask_returns_503_when_embedding_fails(client, monkeypatch):
    def _raise(text):
        raise embedding_service.EmbeddingServiceError("provider unavailable")

    monkeypatch.setattr(embedding_service, "generate_embedding", _raise)

    token = _register_and_login(client, "ask-f@example.com")
    response = client.post(
        "/search/ask", json={"question": "anything?"}, headers=_auth_headers(token)
    )
    assert response.status_code == 503


def test_ask_returns_503_when_ai_call_fails(client, db_session, monkeypatch):
    token = _register_and_login(client, "ask-g@example.com")
    user_id = uuid.UUID(client.get("/auth/me", headers=_auth_headers(token)).json()["id"])
    _make_link(db_session, user_id, "https://example.com/pricing", vector=_vector(1.0, 0.0))

    def _raise(**kwargs):
        raise ai_service.AIServiceError("provider down")

    monkeypatch.setattr(ai_service, "answer_query", _raise)

    response = client.post(
        "/search/ask", json={"question": "pricing?"}, headers=_auth_headers(token)
    )
    assert response.status_code == 503
