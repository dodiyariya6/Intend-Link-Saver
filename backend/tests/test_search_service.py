"""
Tests for search_service.search_links — exercised directly against a real
Postgres+pgvector database (no mocking of the DB layer), with hand-crafted
embedding vectors so similarity/ranking is fully predictable.

Vectors are built as (x, y, 0, 0, ..., 0) — with every other dimension
zero for every vector in a given test, cosine similarity reduces to plain
2D cosine similarity between (x, y) pairs, so expected ordering is exact
and easy to reason about.
"""
import uuid

import pytest

from app.models.link import EMBEDDING_DIM, Link
from app.services import link_service, search_service


def _vector(x: float, y: float) -> list[float]:
    return [x, y] + [0.0] * (EMBEDDING_DIM - 2)


@pytest.fixture()
def user_a_id(client):
    resp = client.post(
        "/auth/register", json={"email": "search-a@example.com", "password": "supersecret123"}
    )
    return uuid.UUID(resp.json()["id"])


@pytest.fixture()
def user_b_id(client):
    resp = client.post(
        "/auth/register", json={"email": "search-b@example.com", "password": "supersecret123"}
    )
    return uuid.UUID(resp.json()["id"])


def _make_link(db_session, user_id, url, *, vector=None, intent_category=None, tags=None, status="enriched"):
    link = Link(
        user_id=user_id,
        url=url,
        embedding=vector,
        intent_category=intent_category,
        status=status,
    )
    if tags:
        link.tags = link_service.get_or_create_tags(db_session, user_id, tags)
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)
    return link


# --- ranking ----------------------------------------------------------

def test_search_ranks_by_similarity_highest_first(db_session, user_a_id):
    pricing_exact = _make_link(db_session, user_a_id, "https://example.com/pricing-exact", vector=_vector(1.0, 0.0))
    pricing_close = _make_link(db_session, user_a_id, "https://example.com/pricing-close", vector=_vector(0.9, 0.1))
    unrelated = _make_link(db_session, user_a_id, "https://example.com/unrelated", vector=_vector(0.0, 1.0))

    query_vector = _vector(1.0, 0.0)
    results, total = search_service.search_links(db_session, user_a_id, query_vector)

    assert total == 3
    ids_in_order = [r.link.id for r in results]
    assert ids_in_order == [pricing_exact.id, pricing_close.id, unrelated.id]

    # similarity scores themselves make sense: exact match ~1.0, orthogonal ~0.0
    assert results[0].similarity == pytest.approx(1.0, abs=1e-4)
    assert results[2].similarity == pytest.approx(0.0, abs=1e-4)
    assert results[0].similarity > results[1].similarity > results[2].similarity


def test_search_excludes_links_without_embeddings(db_session, user_a_id):
    with_embedding = _make_link(db_session, user_a_id, "https://example.com/a", vector=_vector(1.0, 0.0))
    _make_link(db_session, user_a_id, "https://example.com/no-embedding", vector=None, status="ready")

    results, total = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0))
    assert total == 1
    assert results[0].link.id == with_embedding.id


# --- ownership --------------------------------------------------------

def test_search_only_returns_own_links(db_session, user_a_id, user_b_id):
    _make_link(db_session, user_a_id, "https://example.com/mine", vector=_vector(1.0, 0.0))
    _make_link(db_session, user_b_id, "https://example.com/not-mine", vector=_vector(1.0, 0.0))

    results, total = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0))
    assert total == 1
    assert results[0].link.url == "https://example.com/mine"


# --- empty results ------------------------------------------------------

def test_search_with_no_links_returns_empty(db_session, user_a_id):
    results, total = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0))
    assert results == []
    assert total == 0


def test_search_with_only_unrelated_links_still_returns_them_ranked_low(db_session, user_a_id):
    # semantic search always ranks *something* if there are enriched links —
    # "no relevant results" in practice means an empty link set, not a
    # hard similarity cutoff (no threshold is implemented in this module).
    _make_link(db_session, user_a_id, "https://example.com/unrelated", vector=_vector(-1.0, 0.0))
    results, total = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0))
    assert total == 1
    assert results[0].similarity == pytest.approx(-1.0, abs=1e-4)


# --- pagination ---------------------------------------------------------

def test_search_pagination(db_session, user_a_id):
    # 5 links at decreasing similarity to the query vector (1, 0)
    vectors = [_vector(1.0, 0.0), _vector(0.8, 0.2), _vector(0.6, 0.4), _vector(0.4, 0.6), _vector(0.2, 0.8)]
    created = [
        _make_link(db_session, user_a_id, f"https://example.com/{i}", vector=v)
        for i, v in enumerate(vectors)
    ]

    page1, total = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0), page=1, page_size=2)
    assert total == 5
    assert len(page1) == 2
    assert [r.link.id for r in page1] == [created[0].id, created[1].id]

    page2, _ = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0), page=2, page_size=2)
    assert [r.link.id for r in page2] == [created[2].id, created[3].id]

    page3, _ = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0), page=3, page_size=2)
    assert [r.link.id for r in page3] == [created[4].id]


# --- filters --------------------------------------------------------

def test_search_filter_by_intent_category(db_session, user_a_id):
    _make_link(
        db_session, user_a_id, "https://example.com/a",
        vector=_vector(1.0, 0.0), intent_category="research",
    )
    _make_link(
        db_session, user_a_id, "https://example.com/b",
        vector=_vector(0.9, 0.1), intent_category="read-later",
    )

    results, total = search_service.search_links(
        db_session, user_a_id, _vector(1.0, 0.0), intent_category="research"
    )
    assert total == 1
    assert results[0].link.url == "https://example.com/a"


def test_search_filter_by_tags(db_session, user_a_id):
    _make_link(db_session, user_a_id, "https://example.com/a", vector=_vector(1.0, 0.0), tags=["pricing"])
    _make_link(db_session, user_a_id, "https://example.com/b", vector=_vector(0.9, 0.1), tags=["recipe"])

    results, total = search_service.search_links(db_session, user_a_id, _vector(1.0, 0.0), tags=["pricing"])
    assert total == 1
    assert results[0].link.url == "https://example.com/a"

    # matches ANY of the given tags
    results2, total2 = search_service.search_links(
        db_session, user_a_id, _vector(1.0, 0.0), tags=["pricing", "recipe"]
    )
    assert total2 == 2


def test_search_filter_by_intent_category_and_tags_combined(db_session, user_a_id):
    _make_link(
        db_session, user_a_id, "https://example.com/a", vector=_vector(1.0, 0.0),
        intent_category="research", tags=["pricing"],
    )
    _make_link(
        db_session, user_a_id, "https://example.com/b", vector=_vector(0.9, 0.1),
        intent_category="read-later", tags=["pricing"],
    )

    results, total = search_service.search_links(
        db_session, user_a_id, _vector(1.0, 0.0), intent_category="research", tags=["pricing"]
    )
    assert total == 1
    assert results[0].link.url == "https://example.com/a"
