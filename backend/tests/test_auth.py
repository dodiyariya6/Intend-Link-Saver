"""Tests for registration, login, password hashing, and JWT auth."""
from app.services import auth_service


# --- registration -----------------------------------------------------

def test_register_creates_user(client):
    response = client.post(
        "/auth/register", json={"email": "alice@example.com", "password": "supersecret123"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert "id" in body
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email_rejected(client):
    payload = {"email": "bob@example.com", "password": "supersecret123"}
    first = client.post("/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/auth/register", json=payload)
    assert second.status_code == 409


def test_register_password_is_hashed_not_stored_plain(client, db_session):
    client.post("/auth/register", json={"email": "carol@example.com", "password": "supersecret123"})

    from app.models.user import User

    user = db_session.query(User).filter(User.email == "carol@example.com").first()
    assert user is not None
    assert user.password_hash != "supersecret123"
    assert user.password_hash.startswith("$2b$")  # bcrypt hash prefix
    assert auth_service.verify_password("supersecret123", user.password_hash)


# --- login --------------------------------------------------------------

def test_login_with_correct_credentials_returns_token(client):
    client.post("/auth/register", json={"email": "dave@example.com", "password": "supersecret123"})

    response = client.post(
        "/auth/login", json={"email": "dave@example.com", "password": "supersecret123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and len(body["access_token"]) > 0


def test_login_with_wrong_password_rejected(client):
    client.post("/auth/register", json={"email": "erin@example.com", "password": "supersecret123"})

    response = client.post(
        "/auth/login", json={"email": "erin@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_login_with_unknown_email_rejected(client):
    response = client.post(
        "/auth/login", json={"email": "ghost@example.com", "password": "whatever123"}
    )
    assert response.status_code == 401


# --- JWT generation/validation ------------------------------------------

def test_access_token_encodes_correct_user_id(client):
    register_resp = client.post(
        "/auth/register", json={"email": "frank@example.com", "password": "supersecret123"}
    )
    user_id = register_resp.json()["id"]

    login_resp = client.post(
        "/auth/login", json={"email": "frank@example.com", "password": "supersecret123"}
    )
    token = login_resp.json()["access_token"]

    decoded_user_id = auth_service.decode_access_token(token)
    assert str(decoded_user_id) == user_id


def test_decode_access_token_rejects_garbage_token():
    assert auth_service.decode_access_token("not-a-real-token") is None


# --- protected route dependency -----------------------------------------

def test_me_requires_authentication(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_returns_current_user_with_valid_token(client):
    client.post("/auth/register", json={"email": "grace@example.com", "password": "supersecret123"})
    login_resp = client.post(
        "/auth/login", json={"email": "grace@example.com", "password": "supersecret123"}
    )
    token = login_resp.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "grace@example.com"


def test_me_rejects_invalid_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer garbage.token.value"})
    assert response.status_code == 401


def test_logout_requires_authentication(client):
    response = client.post("/auth/logout")
    assert response.status_code == 401


def test_logout_succeeds_with_valid_token(client):
    client.post("/auth/register", json={"email": "heidi@example.com", "password": "supersecret123"})
    login_resp = client.post(
        "/auth/login", json={"email": "heidi@example.com", "password": "supersecret123"}
    )
    token = login_resp.json()["access_token"]

    response = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204
