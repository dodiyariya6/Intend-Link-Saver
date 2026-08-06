"""Tests for link CRUD, ownership isolation, URL validation, pagination, and filters."""
import pytest


def _register_and_login(client, email: str, password: str = "supersecret123") -> str:
    client.post("/auth/register", json={"email": email, "password": password})
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def user_a_token(client):
    return _register_and_login(client, "linkuser-a@example.com")


@pytest.fixture()
def user_b_token(client):
    return _register_and_login(client, "linkuser-b@example.com")


# --- auth gating ----------------------------------------------------------

def test_create_link_requires_auth(client):
    response = client.post("/links", json={"url": "https://example.com"})
    assert response.status_code == 401


def test_list_links_requires_auth(client):
    assert client.get("/links").status_code == 401


# --- create / URL validation ----------------------------------------------

def test_create_link_success(client, user_a_token):
    response = client.post(
        "/links",
        json={
            "url": "https://example.com/article",
            "note": "saving for the Q3 pricing deck",
            "intent_category": "research",
            "tags": ["Pricing", " pricing ", "competitor-analysis"],
        },
        headers=_auth_headers(user_a_token),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["url"] == "https://example.com/article"
    assert body["user_note"] == "saving for the Q3 pricing deck"
    assert body["intent_category"] == "research"
    assert body["status"] == "ready"
    assert body["ai_summary"] is None
    assert body["ai_reason"] is None
    # tags normalized (trimmed/lowercased) and deduplicated
    assert sorted(body["tags"]) == ["competitor-analysis", "pricing"]


def test_create_link_without_optional_fields(client, user_a_token):
    response = client.post(
        "/links", json={"url": "https://example.com"}, headers=_auth_headers(user_a_token)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["tags"] == []
    assert body["user_note"] is None
    assert body["intent_category"] is None


@pytest.mark.parametrize(
    "bad_url",
    ["not-a-url", "example.com", "ftp:/broken", "just some text", ""],
)
def test_create_link_invalid_url_rejected(client, user_a_token, bad_url):
    response = client.post("/links", json={"url": bad_url}, headers=_auth_headers(user_a_token))
    assert response.status_code == 422


# --- get by id / ownership -------------------------------------------------

def test_get_link_by_id(client, user_a_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/a"}, headers=_auth_headers(user_a_token)
    )
    link_id = create_resp.json()["id"]

    response = client.get(f"/links/{link_id}", headers=_auth_headers(user_a_token))
    assert response.status_code == 200
    assert response.json()["id"] == link_id


def test_get_link_not_found(client, user_a_token):
    response = client.get(
        "/links/00000000-0000-0000-0000-000000000000", headers=_auth_headers(user_a_token)
    )
    assert response.status_code == 404


def test_user_cannot_get_another_users_link(client, user_a_token, user_b_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/private"}, headers=_auth_headers(user_a_token)
    )
    link_id = create_resp.json()["id"]

    response = client.get(f"/links/{link_id}", headers=_auth_headers(user_b_token))
    assert response.status_code == 404


def test_user_cannot_update_another_users_link(client, user_a_token, user_b_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/private"}, headers=_auth_headers(user_a_token)
    )
    link_id = create_resp.json()["id"]

    response = client.patch(
        f"/links/{link_id}", json={"note": "hijacked"}, headers=_auth_headers(user_b_token)
    )
    assert response.status_code == 404

    # confirm it was NOT modified
    check = client.get(f"/links/{link_id}", headers=_auth_headers(user_a_token))
    assert check.json()["user_note"] is None


def test_user_cannot_delete_another_users_link(client, user_a_token, user_b_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/private"}, headers=_auth_headers(user_a_token)
    )
    link_id = create_resp.json()["id"]

    response = client.delete(f"/links/{link_id}", headers=_auth_headers(user_b_token))
    assert response.status_code == 404

    # still exists for the real owner
    check = client.get(f"/links/{link_id}", headers=_auth_headers(user_a_token))
    assert check.status_code == 200


# --- update -----------------------------------------------------------------

def test_update_link_fields(client, user_a_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/a", "tags": ["old-tag"]},
        headers=_auth_headers(user_a_token),
    )
    link_id = create_resp.json()["id"]

    response = client.patch(
        f"/links/{link_id}",
        json={
            "note": "updated note",
            "intent_category": "reference",
            "tags": ["new-tag"],
        },
        headers=_auth_headers(user_a_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user_note"] == "updated note"
    assert body["intent_category"] == "reference"
    assert body["tags"] == ["new-tag"]


def test_update_link_partial_leaves_other_fields_untouched(client, user_a_token):
    create_resp = client.post(
        "/links",
        json={"url": "https://example.com/a", "note": "original note", "tags": ["keep-me"]},
        headers=_auth_headers(user_a_token),
    )
    link_id = create_resp.json()["id"]

    response = client.patch(
        f"/links/{link_id}", json={"intent_category": "research"}, headers=_auth_headers(user_a_token)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user_note"] == "original note"
    assert body["tags"] == ["keep-me"]
    assert body["intent_category"] == "research"


def test_update_link_invalid_url_rejected(client, user_a_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/a"}, headers=_auth_headers(user_a_token)
    )
    link_id = create_resp.json()["id"]

    response = client.patch(
        f"/links/{link_id}", json={"url": "not-a-url"}, headers=_auth_headers(user_a_token)
    )
    assert response.status_code == 422


def test_update_nonexistent_link_returns_404(client, user_a_token):
    response = client.patch(
        "/links/00000000-0000-0000-0000-000000000000",
        json={"note": "x"},
        headers=_auth_headers(user_a_token),
    )
    assert response.status_code == 404


# --- delete -------------------------------------------------------------

def test_delete_link(client, user_a_token):
    create_resp = client.post(
        "/links", json={"url": "https://example.com/a"}, headers=_auth_headers(user_a_token)
    )
    link_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/links/{link_id}", headers=_auth_headers(user_a_token))
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/links/{link_id}", headers=_auth_headers(user_a_token))
    assert get_resp.status_code == 404


def test_delete_nonexistent_link_returns_404(client, user_a_token):
    response = client.delete(
        "/links/00000000-0000-0000-0000-000000000000", headers=_auth_headers(user_a_token)
    )
    assert response.status_code == 404


# --- list / pagination / filters -------------------------------------------

def test_list_only_returns_own_links(client, user_a_token, user_b_token):
    client.post("/links", json={"url": "https://example.com/a"}, headers=_auth_headers(user_a_token))
    client.post("/links", json={"url": "https://example.com/b"}, headers=_auth_headers(user_b_token))

    response = client.get("/links", headers=_auth_headers(user_a_token))
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/a"


def test_list_pagination(client, user_a_token):
    for i in range(5):
        client.post(
            "/links", json={"url": f"https://example.com/{i}"}, headers=_auth_headers(user_a_token)
        )

    page1 = client.get("/links?page=1&page_size=2", headers=_auth_headers(user_a_token)).json()
    assert page1["total"] == 5
    assert page1["page"] == 1
    assert page1["page_size"] == 2
    assert page1["pages"] == 3
    assert len(page1["items"]) == 2

    page2 = client.get("/links?page=2&page_size=2", headers=_auth_headers(user_a_token)).json()
    assert len(page2["items"]) == 2

    page3 = client.get("/links?page=3&page_size=2", headers=_auth_headers(user_a_token)).json()
    assert len(page3["items"]) == 1

    # pages should be non-overlapping and cover all 5 links
    all_ids = {item["id"] for item in page1["items"] + page2["items"] + page3["items"]}
    assert len(all_ids) == 5


def test_list_filter_by_intent_category(client, user_a_token):
    client.post(
        "/links",
        json={"url": "https://example.com/a", "intent_category": "research"},
        headers=_auth_headers(user_a_token),
    )
    client.post(
        "/links",
        json={"url": "https://example.com/b", "intent_category": "read-later"},
        headers=_auth_headers(user_a_token),
    )

    response = client.get("/links?intent_category=research", headers=_auth_headers(user_a_token))
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/a"


def test_list_filter_by_tags(client, user_a_token):
    client.post(
        "/links",
        json={"url": "https://example.com/a", "tags": ["pricing", "competitor"]},
        headers=_auth_headers(user_a_token),
    )
    client.post(
        "/links", json={"url": "https://example.com/b", "tags": ["recipe"]},
        headers=_auth_headers(user_a_token),
    )
    client.post("/links", json={"url": "https://example.com/c"}, headers=_auth_headers(user_a_token))

    response = client.get("/links?tags=pricing", headers=_auth_headers(user_a_token))
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/a"

    # matches links having ANY of the given tags
    response = client.get(
        "/links?tags=pricing&tags=recipe", headers=_auth_headers(user_a_token)
    )
    body = response.json()
    assert body["total"] == 2


def test_list_filter_by_intent_category_and_tags_combined(client, user_a_token):
    client.post(
        "/links",
        json={"url": "https://example.com/a", "intent_category": "research", "tags": ["pricing"]},
        headers=_auth_headers(user_a_token),
    )
    client.post(
        "/links",
        json={"url": "https://example.com/b", "intent_category": "read-later", "tags": ["pricing"]},
        headers=_auth_headers(user_a_token),
    )

    response = client.get(
        "/links?intent_category=research&tags=pricing", headers=_auth_headers(user_a_token)
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/a"
