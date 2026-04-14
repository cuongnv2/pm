"""Tests for user registration and profile management endpoints."""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


@pytest.fixture
def registered_user():
    """Register a unique user and return auth headers + user info."""
    import time
    username = f"testuser_{int(time.time() * 1000)}"
    response = client.post("/api/register", json={"username": username, "password": "securepass"})
    assert response.status_code == 200
    data = response.json()
    return {
        "username": username,
        "token": data["token"],
        "user_id": data["user_id"],
        "headers": {"Authorization": f"Bearer {data['token']}"},
    }


# ==== Registration ====

def test_register_success():
    import time
    username = f"newuser_{int(time.time() * 1000)}"
    response = client.post("/api/register", json={"username": username, "password": "securepass123"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert "user_id" in data

def test_register_with_display_name():
    import time
    username = f"newuser_{int(time.time() * 1000)}"
    response = client.post("/api/register", json={
        "username": username,
        "password": "securepass123",
        "display_name": "Test User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

def test_register_and_login():
    """Registered user should be able to log in immediately."""
    import time
    username = f"newuser_{int(time.time() * 1000)}"
    client.post("/api/register", json={"username": username, "password": "mypassword"})
    response = client.post("/api/login", json={"username": username, "password": "mypassword"})
    assert response.status_code == 200
    assert response.json()["success"] is True

def test_register_creates_default_board():
    """Registration should create a default board for the new user."""
    import time
    username = f"newuser_{int(time.time() * 1000)}"
    reg = client.post("/api/register", json={"username": username, "password": "securepass"})
    token = reg.json()["token"]
    boards = client.get("/api/boards", headers={"Authorization": f"Bearer {token}"})
    assert boards.status_code == 200
    assert len(boards.json()) == 1

def test_register_duplicate_username():
    import time
    username = f"dupuser_{int(time.time() * 1000)}"
    client.post("/api/register", json={"username": username, "password": "pass123"})
    response = client.post("/api/register", json={"username": username, "password": "pass456"})
    assert response.status_code == 409

def test_register_empty_username():
    response = client.post("/api/register", json={"username": "   ", "password": "pass123"})
    assert response.status_code == 422

def test_register_short_password():
    import time
    username = f"shortpass_{int(time.time() * 1000)}"
    response = client.post("/api/register", json={"username": username, "password": "abc"})
    assert response.status_code == 422


# ==== User Profile ====

def test_get_profile_success(registered_user):
    response = client.get("/api/users/me", headers=registered_user["headers"])
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == registered_user["username"]
    assert "display_name" in data
    assert "id" in data

def test_get_profile_unauthorized():
    response = client.get("/api/users/me")
    assert response.status_code == 403

def test_update_display_name(registered_user):
    response = client.put("/api/users/me",
        json={"display_name": "Updated Name"},
        headers=registered_user["headers"]
    )
    assert response.status_code == 200
    assert response.json()["success"] is True

    profile = client.get("/api/users/me", headers=registered_user["headers"])
    assert profile.json()["display_name"] == "Updated Name"

def test_update_display_name_empty(registered_user):
    response = client.put("/api/users/me",
        json={"display_name": ""},
        headers=registered_user["headers"]
    )
    assert response.status_code == 200

def test_change_password_success(registered_user):
    response = client.put("/api/users/me/password",
        json={"current_password": "securepass", "new_password": "newpassword123"},
        headers=registered_user["headers"]
    )
    assert response.status_code == 200
    assert response.json()["success"] is True

    # New password should work
    login = client.post("/api/login", json={
        "username": registered_user["username"],
        "password": "newpassword123"
    })
    assert login.status_code == 200

def test_change_password_wrong_current(registered_user):
    response = client.put("/api/users/me/password",
        json={"current_password": "wrongpassword", "new_password": "newpassword123"},
        headers=registered_user["headers"]
    )
    assert response.status_code == 400

def test_change_password_too_short(registered_user):
    response = client.put("/api/users/me/password",
        json={"current_password": "securepass", "new_password": "abc"},
        headers=registered_user["headers"]
    )
    assert response.status_code == 422

def test_change_password_unauthorized():
    response = client.put("/api/users/me/password",
        json={"current_password": "old", "new_password": "newpassword123"}
    )
    assert response.status_code == 403
