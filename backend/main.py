from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from .models import Base, User, Board, ColumnModel, Card
from .ai import call_ai, call_ai_with_board
from dotenv import load_dotenv
import json

load_dotenv()

app = FastAPI()

# Database setup
DATABASE_URL = "sqlite:///kanban.db"
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize default data
def init_db():
    db: Session = SessionLocal()
    try:
        # Check if user exists
        user = db.query(User).filter(User.username == "user").first()
        if not user:
            user = User(username="user", password_hash="password")  # Plain for MVP
            db.add(user)
            db.commit()
            db.refresh(user)

            # Create board
            board = Board(user_id=user.id, name="My Kanban Board")
            db.add(board)
            db.commit()
            db.refresh(board)

            # Create columns
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

            # Create cards
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

init_db()

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(request: LoginRequest):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == request.username).first()
        if user and user.password_hash == request.password:
            return JSONResponse(content={"success": True})
        return JSONResponse(content={"success": False}, status_code=401)
    finally:
        db.close()

@app.get("/api/board/{user_id}")
async def get_board(user_id: int):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        board = db.query(Board).filter(Board.user_id == user_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")

        columns = db.query(ColumnModel).filter(ColumnModel.board_id == board.id).order_by(ColumnModel.position).all()
        cards = db.query(Card).filter(Card.column_id.in_([c.id for c in columns])).all()

        board_data = {
            "columns": [
                {
                    "id": f"col-{c.title.lower().replace(' ', '-')}",
                    "title": c.title,
                    "cardIds": [f"card-{card.id}" for card in sorted(cards, key=lambda x: x.position) if card.column_id == c.id]
                } for c in columns
            ],
            "cards": {
                f"card-{card.id}": {
                    "id": f"card-{card.id}",
                    "title": card.title,
                    "details": card.details or ""
                } for card in cards
            }
        }
        return JSONResponse(content=board_data)
    finally:
        db.close()

class BoardUpdate(BaseModel):
    columns: list
    cards: dict

@app.put("/api/board/{user_id}")
async def update_board(user_id: int, update: BoardUpdate):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        board = db.query(Board).filter(Board.user_id == user_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")

        # Clear existing data
        db.query(Card).filter(Card.column_id.in_([c.id for c in db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()])).delete()
        db.query(ColumnModel).filter(ColumnModel.board_id == board.id).delete()
        db.commit()

        # Insert new data
        for col_data in update.columns:
            col = ColumnModel(
                board_id=board.id,
                title=col_data["title"],
                position=update.columns.index(col_data)
            )
            db.add(col)
            db.flush()  # To get id
            for card_id in col_data["cardIds"]:
                card_data = update.cards[card_id]
                card = Card(
                    column_id=col.id,
                    title=card_data["title"],
                    details=card_data["details"],
                    position=col_data["cardIds"].index(card_id)
                )
                db.add(card)
        db.commit()
        return JSONResponse(content={"success": True})
    finally:
        db.close()

@app.get("/api/test")
async def test_api():
    return JSONResponse(content={"message": "API is working", "status": "success"})

@app.get("/api/ai/test")
async def test_ai():
    try:
        result = call_ai("What is 2+2?")
        return JSONResponse(content={"result": result})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

class ChatRequest(BaseModel):
    message: str

@app.post("/api/ai/chat/{user_id}")
async def ai_chat(user_id: int, request: ChatRequest):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        board = db.query(Board).filter(Board.user_id == user_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")

        columns = db.query(ColumnModel).filter(ColumnModel.board_id == board.id).order_by(ColumnModel.position).all()
        cards = db.query(Card).filter(Card.column_id.in_([c.id for c in columns])).all()

        board_data = {
            "columns": [
                {
                    "id": f"col-{c.title.lower().replace(' ', '-')}",
                    "title": c.title,
                    "cardIds": [f"card-{card.id}" for card in sorted(cards, key=lambda x: x.position) if card.column_id == c.id]
                } for c in columns
            ],
            "cards": {
                f"card-{card.id}": {
                    "id": f"card-{card.id}",
                    "title": card.title,
                    "details": card.details or ""
                } for card in cards
            }
        }

        # For MVP, no history
        history = []

        ai_response = call_ai_with_board(board_data, request.message, history)

        response_text = ai_response.get("response", "No response")
        updates = ai_response.get("updates")

        if updates:
            # Apply updates
            # Clear existing
            db.query(Card).filter(Card.column_id.in_([c.id for c in db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()])).delete()
            db.query(ColumnModel).filter(ColumnModel.board_id == board.id).delete()
            db.commit()

            # Insert new
            for col_data in updates.get("columns", []):
                col = ColumnModel(
                    board_id=board.id,
                    title=col_data["title"],
                    position=updates["columns"].index(col_data)
                )
                db.add(col)
                db.flush()
                for card_id in col_data["cardIds"]:
                    card_data = updates["cards"][card_id]
                    card = Card(
                        column_id=col.id,
                        title=card_data["title"],
                        details=card_data["details"],
                        position=col_data["cardIds"].index(card_id)
                    )
                    db.add(card)
            db.commit()

        return JSONResponse(content={"response": response_text, "updated": updates is not None})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        db.close()

# Mount static files
import os
if os.path.exists("frontend/out"):
    app.mount("/", StaticFiles(directory="frontend/out", html=True), name="static")