import pytest
from fastapi.testclient import TestClient
from main import app, SessionLocal
from models import User, Board, ColumnModel, Card
from unittest.mock import patch, MagicMock

client = TestClient(app)


@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _restore_default_board():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "user").first()
        if user:
            board = db.query(Board).filter(Board.user_id == user.id).first()
            if board:
                col_ids = [c.id for c in db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()]
                if col_ids:
                    db.query(Card).filter(Card.column_id.in_(col_ids)).delete(synchronize_session=False)
                db.query(ColumnModel).filter(ColumnModel.board_id == board.id).delete(synchronize_session=False)
                db.commit()

                columns_data = [
                    ("Backlog", 0), ("Discovery", 1), ("In Progress", 2), ("Review", 3), ("Done", 4)
                ]
                for title, pos in columns_data:
                    col = ColumnModel(board_id=board.id, title=title, position=pos)
                    db.add(col)
                db.commit()

                cards_data = [
                    (0, "Align roadmap themes", "Draft quarterly themes with impact statements and metrics.", 0),
                    (0, "Gather customer signals", "Review support tags, sales notes, and churn feedback.", 1),
                    (1, "Prototype analytics view", "Sketch initial dashboard layout and key drill-downs.", 0),
                    (2, "Refine status language", "Standardize column labels and tone across the board.", 0),
                    (2, "Design card layout", "Add hierarchy and spacing for scanning dense lists.", 1),
                    (3, "QA micro-interactions", "Verify hover, focus, and loading states.", 0),
                    (4, "Ship marketing page", "Final copy approved and asset pack delivered.", 0),
                    (4, "Close onboarding sprint", "Document release notes and share internally.", 1),
                ]
                columns = db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()
                col_dict = {col.position: col.id for col in columns}
                for col_pos, title, details, pos in cards_data:
                    card = Card(column_id=col_dict[col_pos], title=title, details=details, position=pos)
                    db.add(card)
                db.commit()
    finally:
        db.close()


# ==== Root and Basic Endpoints ====

def test_read_root():
    response = client.get("/")
    assert response.status_code in [200, 404]

def test_api_test():
    response = client.get("/api/test")
    assert response.status_code == 200
    assert response.json() == {"message": "API is working", "status": "success"}


# ==== Login Endpoint Tests ====

def test_login_success():
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data

def test_login_failure_wrong_username():
    response = client.post("/api/login", json={"username": "nonexistent", "password": "password"})
    assert response.status_code == 401
    assert response.json() == {"success": False}

def test_login_failure_wrong_password():
    response = client.post("/api/login", json={"username": "user", "password": "wrongpass"})
    assert response.status_code == 401
    assert response.json() == {"success": False}

def test_login_empty_credentials():
    response = client.post("/api/login", json={"username": "", "password": ""})
    assert response.status_code == 401


# ==== Unauthenticated access ====

def test_get_board_unauthenticated():
    response = client.get("/api/board/1")
    assert response.status_code == 403  # HTTPBearer returns 403 when no token

def test_update_board_unauthenticated():
    response = client.put("/api/board/1", json={"columns": [], "cards": {}})
    assert response.status_code == 403

def test_ai_chat_unauthenticated():
    response = client.post("/api/ai/chat/1", json={"message": "hello"})
    assert response.status_code == 403


# ==== Get Board Endpoint Tests ====

def test_get_board_success(auth_headers):
    response = client.get("/api/board/1", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "cards" in data
    assert len(data["columns"]) == 5
    for col in data["columns"]:
        assert "id" in col
        assert "title" in col
        assert "cardIds" in col
    for card_id, card in data["cards"].items():
        assert "id" in card
        assert "title" in card
        assert "details" in card

def test_get_board_forbidden_other_user(auth_headers):
    # Token is for user 1; accessing user 99999 should be Forbidden, not 404
    response = client.get("/api/board/99999", headers=auth_headers)
    assert response.status_code == 403


# ==== Update Board Endpoint Tests ====

def test_update_board_success(auth_headers):
    response = client.get("/api/board/1", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    if len(data["cards"]) > 0:
        first_card_key = list(data["cards"].keys())[0]
        original_title = data["cards"][first_card_key]["title"]

        data["cards"][first_card_key]["title"] = "New Title"
        response = client.put("/api/board/1", json=data, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"success": True}

        response = client.get("/api/board/1", headers=auth_headers)
        new_data = response.json()
        assert new_data["cards"][first_card_key]["title"] == "New Title"

        new_data["cards"][first_card_key]["title"] = original_title
        client.put("/api/board/1", json=new_data, headers=auth_headers)

def test_update_board_forbidden_other_user(auth_headers):
    response = client.put("/api/board/99999", json={"columns": [], "cards": {}}, headers=auth_headers)
    assert response.status_code == 403

def test_update_board_empty_columns(auth_headers):
    response = client.put("/api/board/1", json={"columns": [], "cards": {}}, headers=auth_headers)
    assert response.status_code == 200
    response = client.get("/api/board/1", headers=auth_headers)
    data = response.json()
    assert len(data["columns"]) == 0
    assert len(data["cards"]) == 0
    _restore_default_board()


# ==== AI Test Endpoint Tests ====

@patch('main.call_ai')
def test_ai_test_success(mock_call_ai):
    mock_call_ai.return_value = "2+2 equals 4"
    response = client.get("/api/ai/test")
    assert response.status_code == 200
    assert response.json()["result"] == "2+2 equals 4"

@patch('main.call_ai')
def test_ai_test_failure(mock_call_ai):
    mock_call_ai.side_effect = Exception("API error")
    response = client.get("/api/ai/test")
    assert response.status_code == 500
    assert "error" in response.json()


# ==== AI Chat Endpoint Tests ====

@patch('main.call_ai_with_board')
def test_ai_chat_success(mock_call_ai_with_board, auth_headers):
    mock_call_ai_with_board.return_value = {
        "response": "I'll move that card to In Progress",
        "updates": None,
    }
    response = client.post("/api/ai/chat/1", json={"message": "Move the first card to In Progress"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "I'll move that card to In Progress"

@patch('main.call_ai_with_board')
def test_ai_chat_with_board_updates(mock_call_ai_with_board, auth_headers):
    response = client.get("/api/board/1", headers=auth_headers)
    board_data = response.json()

    if len(board_data["columns"]) > 0:
        original_title = board_data["columns"][0]["title"]
        updated_board = {
            "columns": [{"title": "Updated Backlog", "cardIds": board_data["columns"][0]["cardIds"]}]
            + [{"title": c["title"], "cardIds": c["cardIds"]} for c in board_data["columns"][1:]],
            "cards": {k: {"title": v["title"], "details": v["details"]} for k, v in board_data["cards"].items()},
        }

        mock_call_ai_with_board.return_value = {
            "response": "I've updated the board",
            "updates": updated_board,
        }
        response = client.post("/api/ai/chat/1", json={"message": "Update the board"}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["response"] == "I've updated the board"

        response = client.get("/api/board/1", headers=auth_headers)
        assert response.json()["columns"][0]["title"] == "Updated Backlog"

        _restore_default_board()

@patch('main.call_ai_with_board')
def test_ai_chat_no_updates(mock_call_ai_with_board, auth_headers):
    mock_call_ai_with_board.return_value = {
        "response": "I understand your request",
        "updates": None,
    }
    response = client.post("/api/ai/chat/1", json={"message": "Show me the board"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["updated"] == False
