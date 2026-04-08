import pytest
from fastapi.testclient import TestClient
from main import app, SessionLocal
from models import User, Board, ColumnModel, Card
from unittest.mock import patch, MagicMock

client = TestClient(app)


def _restore_default_board():
    """Helper function to restore the board to its default state."""
    db = SessionLocal()
    try:
        # Check if board exists
        user = db.query(User).filter(User.username == "user").first()
        if user:
            board = db.query(Board).filter(Board.user_id == user.id).first()
            if board:
                # Clear existing data
                db.query(Card).filter(Card.column_id.in_([c.id for c in db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()])).delete()
                db.query(ColumnModel).filter(ColumnModel.board_id == board.id).delete()
                db.commit()
                
                # Recreate default columns and cards
                columns_data = [
                    ("Backlog", 0),
                    ("Discovery", 1),
                    ("In Progress", 2),
                    ("Review", 3),
                    ("Done", 4)
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
                    (4, "Close onboarding sprint", "Document release notes and share internally.", 1)
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
    # Root will be 404 if frontend/out doesn't exist, 200 if it does
    response = client.get("/")
    # Accept either 200 (static files mounted) or 404 (no frontend build)
    assert response.status_code in [200, 404]

def test_api_test():
    response = client.get("/api/test")
    assert response.status_code == 200
    assert response.json() == {"message": "API is working", "status": "success"}

# ==== Login Endpoint Tests ====

def test_login_success():
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert response.json() == {"success": True}

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

# ==== Get Board Endpoint Tests ====

def test_get_board_success():
    response = client.get("/api/board/1")
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "cards" in data
    assert len(data["columns"]) == 5
    # Verify column structure
    for col in data["columns"]:
        assert "id" in col
        assert "title" in col
        assert "cardIds" in col
    # Verify card structure
    for card_id, card in data["cards"].items():
        assert "id" in card
        assert "title" in card
        assert "details" in card

def test_get_board_nonexistent_user():
    response = client.get("/api/board/99999")
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]

# ==== Update Board Endpoint Tests ====

def test_update_board_success():
    # Get current board
    response = client.get("/api/board/1")
    assert response.status_code == 200
    data = response.json()
    
    # Only test if there are cards to update
    if len(data["cards"]) > 0:
        first_card_key = list(data["cards"].keys())[0]
        original_title = data["cards"][first_card_key]["title"]
        
        # Modify board
        data["cards"][first_card_key]["title"] = "New Title"
        response = client.put("/api/board/1", json=data)
        assert response.status_code == 200
        assert response.json() == {"success": True}
        
        # Verify update
        response = client.get("/api/board/1")
        new_data = response.json()
        assert new_data["cards"][first_card_key]["title"] == "New Title"
        
        # Reset for other tests by changing it back
        new_data["cards"][first_card_key]["title"] = original_title
        client.put("/api/board/1", json=new_data)

def test_update_board_nonexistent_user():
    response = client.put("/api/board/99999", json={"columns": [], "cards": {}})
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]

def test_update_board_empty_columns():
    """Test updating board with empty columns (cleanup test - run last)."""
    response = client.put("/api/board/1", json={"columns": [], "cards": {}})
    assert response.status_code == 200
    # Verify board is now empty
    response = client.get("/api/board/1")
    data = response.json()
    assert len(data["columns"]) == 0
    assert len(data["cards"]) == 0
    
    # Restore default board for other tests
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
def test_ai_chat_success(mock_call_ai_with_board):
    mock_call_ai_with_board.return_value = {
        "response": "I'll move that card to In Progress",
        "updates": None
    }
    response = client.post("/api/ai/chat/1", json={"message": "Move the first card to In Progress"})
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["response"] == "I'll move that card to In Progress"

@patch('main.call_ai_with_board')
def test_ai_chat_with_board_updates(mock_call_ai_with_board):
    # Get initial board structure
    response = client.get("/api/board/1")
    board_data = response.json()
    
    # Only test if there are columns
    if len(board_data["columns"]) > 0:
        original_title = board_data["columns"][0]["title"]
        
        # Mock AI response with board updates
        updated_board = board_data.copy()
        updated_board["columns"][0]["title"] = "Updated Backlog"
        
        mock_call_ai_with_board.return_value = {
            "response": "I've updated the board",
            "updates": updated_board
        }
        response = client.post("/api/ai/chat/1", json={"message": "Update the board"})
        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "I've updated the board"
        
        # Verify board was updated
        response = client.get("/api/board/1")
        new_board = response.json()
        assert new_board["columns"][0]["title"] == "Updated Backlog"
        
        # Reset for other tests
        new_board["columns"][0]["title"] = original_title
        client.put("/api/board/1", json=new_board)

@patch('main.call_ai_with_board')
def test_ai_chat_with_updates_no_ai_response(mock_call_ai_with_board):
    """Test chat when AI returns no updates."""
    mock_call_ai_with_board.return_value = {
        "response": "I understand your request",
        "updates": None
    }
    response = client.post("/api/ai/chat/1", json={"message": "Show me the board"})
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["updated"] == False