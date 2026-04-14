"""Tests for multi-board management and board-scoped AI chat endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def user_a():
    """Create a unique user A and return auth info."""
    import time
    username = f"usera_{int(time.time() * 1000)}"
    reg = client.post("/api/register", json={"username": username, "password": "password123"})
    data = reg.json()
    return {"token": data["token"], "user_id": data["user_id"],
            "headers": {"Authorization": f"Bearer {data['token']}"}}

@pytest.fixture(scope="module")
def user_b():
    """Create a unique user B for cross-user isolation tests."""
    import time
    username = f"userb_{int(time.time() * 1000)}"
    reg = client.post("/api/register", json={"username": username, "password": "password123"})
    data = reg.json()
    return {"token": data["token"], "user_id": data["user_id"],
            "headers": {"Authorization": f"Bearer {data['token']}"}}


# ==== List Boards ====

def test_list_boards_returns_default(user_a):
    response = client.get("/api/boards", headers=user_a["headers"])
    assert response.status_code == 200
    boards = response.json()
    assert isinstance(boards, list)
    assert len(boards) >= 1
    assert "id" in boards[0]
    assert "name" in boards[0]

def test_list_boards_unauthorized():
    response = client.get("/api/boards")
    assert response.status_code == 403

def test_list_boards_isolated_between_users(user_a, user_b):
    """User B should not see user A's boards."""
    boards_a = client.get("/api/boards", headers=user_a["headers"]).json()
    boards_b = client.get("/api/boards", headers=user_b["headers"]).json()
    ids_a = {b["id"] for b in boards_a}
    ids_b = {b["id"] for b in boards_b}
    assert ids_a.isdisjoint(ids_b)


# ==== Create Board ====

def test_create_board_success(user_a):
    import time
    name = f"Sprint {int(time.time())}"
    response = client.post("/api/boards", json={"name": name}, headers=user_a["headers"])
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == name
    assert "id" in data

def test_create_board_creates_default_columns(user_a):
    import time
    response = client.post("/api/boards", json={"name": f"Cols Test {int(time.time())}"}, headers=user_a["headers"])
    board_id = response.json()["id"]
    board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"])
    assert len(board.json()["columns"]) == 5

def test_create_board_empty_name(user_a):
    response = client.post("/api/boards", json={"name": "   "}, headers=user_a["headers"])
    assert response.status_code == 422

def test_create_board_unauthorized():
    response = client.post("/api/boards", json={"name": "Unauthorized"})
    assert response.status_code == 403


# ==== Get Board By ID ====

def test_get_board_by_id_success(user_a):
    boards = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id = boards[0]["id"]
    response = client.get(f"/api/boards/{board_id}", headers=user_a["headers"])
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "cards" in data

def test_get_board_by_id_not_found(user_a):
    response = client.get("/api/boards/999999", headers=user_a["headers"])
    assert response.status_code == 404

def test_get_board_by_id_forbidden(user_a, user_b):
    """User B cannot access User A's boards."""
    boards_a = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id_a = boards_a[0]["id"]
    response = client.get(f"/api/boards/{board_id_a}", headers=user_b["headers"])
    assert response.status_code == 403

def test_get_board_cards_include_priority_and_due_date(user_a):
    boards = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id = boards[0]["id"]
    board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()
    for card in board["cards"].values():
        assert "priority" in card
        assert "dueDate" in card


# ==== Update Board By ID ====

def test_update_board_by_id_success(user_a):
    import time
    response = client.post("/api/boards", json={"name": f"Update Test {int(time.time())}"}, headers=user_a["headers"])
    board_id = response.json()["id"]
    board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()

    update_payload = {
        "columns": [{"title": "New Col", "cardIds": ["tmp-1"]}],
        "cards": {"tmp-1": {"title": "My Card", "details": "Details", "priority": "high", "due_date": "2026-12-31"}},
    }
    r = client.put(f"/api/boards/{board_id}", json=update_payload, headers=user_a["headers"])
    assert r.status_code == 200

    updated = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()
    assert updated["columns"][0]["title"] == "New Col"
    card = list(updated["cards"].values())[0]
    assert card["title"] == "My Card"
    assert card["priority"] == "high"
    assert card["dueDate"] == "2026-12-31"

def test_update_board_by_id_forbidden(user_a, user_b):
    boards_a = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id_a = boards_a[0]["id"]
    response = client.put(f"/api/boards/{board_id_a}",
        json={"columns": [], "cards": {}},
        headers=user_b["headers"]
    )
    assert response.status_code == 403

def test_update_board_empty_clears_cards(user_a):
    import time
    r = client.post("/api/boards", json={"name": f"Clear Test {int(time.time())}"}, headers=user_a["headers"])
    board_id = r.json()["id"]
    client.put(f"/api/boards/{board_id}", json={"columns": [], "cards": {}}, headers=user_a["headers"])
    board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()
    assert len(board["columns"]) == 0
    assert len(board["cards"]) == 0


# ==== Rename Board ====

def test_rename_board_success(user_a):
    import time
    r = client.post("/api/boards", json={"name": f"Old Name {int(time.time())}"}, headers=user_a["headers"])
    board_id = r.json()["id"]
    response = client.patch(f"/api/boards/{board_id}", json={"name": "New Name"}, headers=user_a["headers"])
    assert response.status_code == 200

    boards = client.get("/api/boards", headers=user_a["headers"]).json()
    names = [b["name"] for b in boards]
    assert "New Name" in names

def test_rename_board_empty_name(user_a):
    boards = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id = boards[0]["id"]
    response = client.patch(f"/api/boards/{board_id}", json={"name": "  "}, headers=user_a["headers"])
    assert response.status_code == 422

def test_rename_board_forbidden(user_a, user_b):
    boards_a = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id_a = boards_a[0]["id"]
    response = client.patch(f"/api/boards/{board_id_a}", json={"name": "Hacked"}, headers=user_b["headers"])
    assert response.status_code == 403


# ==== Delete Board ====

def test_delete_board_success(user_a):
    import time
    r = client.post("/api/boards", json={"name": f"To Delete {int(time.time())}"}, headers=user_a["headers"])
    board_id = r.json()["id"]

    response = client.delete(f"/api/boards/{board_id}", headers=user_a["headers"])
    assert response.status_code == 200

    check = client.get(f"/api/boards/{board_id}", headers=user_a["headers"])
    assert check.status_code == 404

def test_delete_board_not_found(user_a):
    response = client.delete("/api/boards/999999", headers=user_a["headers"])
    assert response.status_code == 404

def test_delete_board_forbidden(user_a, user_b):
    boards_a = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id_a = boards_a[0]["id"]
    response = client.delete(f"/api/boards/{board_id_a}", headers=user_b["headers"])
    assert response.status_code == 403

def test_delete_board_unauthorized():
    response = client.delete("/api/boards/1")
    assert response.status_code == 403


# ==== AI Chat (board-scoped) ====

@patch("main.call_ai_with_board")
def test_ai_chat_board_success(mock_ai, user_a):
    mock_ai.return_value = {"response": "Looking good!", "updates": None}
    boards = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id = boards[0]["id"]
    response = client.post(f"/api/ai/chat/board/{board_id}",
        json={"message": "How is my board?"},
        headers=user_a["headers"]
    )
    assert response.status_code == 200
    assert response.json()["response"] == "Looking good!"
    assert response.json()["updated"] is False

@patch("main.call_ai_with_board")
def test_ai_chat_board_with_updates(mock_ai, user_a):
    import time
    r = client.post("/api/boards", json={"name": f"AI Board {int(time.time())}"}, headers=user_a["headers"])
    board_id = r.json()["id"]

    mock_ai.return_value = {
        "response": "I've updated the board",
        "updates": {
            "columns": [{"title": "AI Column", "cardIds": ["ai-1"]}],
            "cards": {"ai-1": {"title": "AI Task", "details": "Created by AI", "priority": "high", "due_date": ""}},
        },
    }
    response = client.post(f"/api/ai/chat/board/{board_id}",
        json={"message": "Add a card"},
        headers=user_a["headers"]
    )
    assert response.status_code == 200
    assert response.json()["updated"] is True

    board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()
    assert board["columns"][0]["title"] == "AI Column"

@patch("main.call_ai_with_board")
def test_ai_chat_board_forbidden(mock_ai, user_a, user_b):
    boards_a = client.get("/api/boards", headers=user_a["headers"]).json()
    board_id_a = boards_a[0]["id"]
    response = client.post(f"/api/ai/chat/board/{board_id_a}",
        json={"message": "Hello"},
        headers=user_b["headers"]
    )
    assert response.status_code == 403

def test_ai_chat_board_unauthorized():
    response = client.post("/api/ai/chat/board/1", json={"message": "Hello"})
    assert response.status_code == 403


# ==== Card Priority and Due Date ====

def test_card_priority_stored_and_retrieved(user_a):
    import time
    r = client.post("/api/boards", json={"name": f"Priority Test {int(time.time())}"}, headers=user_a["headers"])
    board_id = r.json()["id"]

    for priority in ["low", "medium", "high", "critical"]:
        client.put(f"/api/boards/{board_id}", json={
            "columns": [{"title": "Todo", "cardIds": ["c-1"]}],
            "cards": {"c-1": {"title": "Task", "details": "", "priority": priority, "due_date": ""}},
        }, headers=user_a["headers"])
        board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()
        card = list(board["cards"].values())[0]
        assert card["priority"] == priority

def test_card_due_date_stored_and_retrieved(user_a):
    import time
    r = client.post("/api/boards", json={"name": f"DueDate Test {int(time.time())}"}, headers=user_a["headers"])
    board_id = r.json()["id"]

    client.put(f"/api/boards/{board_id}", json={
        "columns": [{"title": "Todo", "cardIds": ["c-1"]}],
        "cards": {"c-1": {"title": "Deadline Task", "details": "", "priority": "high", "due_date": "2026-12-31"}},
    }, headers=user_a["headers"])
    board = client.get(f"/api/boards/{board_id}", headers=user_a["headers"]).json()
    card = list(board["cards"].values())[0]
    assert card["dueDate"] == "2026-12-31"
