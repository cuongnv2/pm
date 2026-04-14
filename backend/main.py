from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
try:
    from .models import Base, User, Board, ColumnModel, Card
    from .ai import call_ai, call_ai_with_board
except ImportError:
    from models import Base, User, Board, ColumnModel, Card
    from ai import call_ai, call_ai_with_board
from passlib.context import CryptContext
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import jwt
import os

load_dotenv()

app = FastAPI()

# Auth
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

def create_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["user_id"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///kanban.db")
engine = create_engine(DATABASE_URL, echo=True)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def init_db():
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "user").first()
        if not user:
            user = User(username="user", password_hash=pwd_context.hash("password"))
            db.add(user)
            db.commit()
            db.refresh(user)

            board = Board(user_id=user.id, name="My Kanban Board")
            db.add(board)
            db.commit()
            db.refresh(board)

            columns_data = [
                ("Backlog", 0),
                ("Discovery", 1),
                ("In Progress", 2),
                ("Review", 3),
                ("Done", 4),
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
        elif not user.password_hash.startswith("$2"):
            # Upgrade legacy plaintext password to bcrypt hash
            user.password_hash = pwd_context.hash("password")
            db.commit()
    finally:
        db.close()

init_db()

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class CardData(BaseModel):
    title: str
    details: str = ""

class ColumnData(BaseModel):
    title: str
    cardIds: list[str]

class BoardUpdate(BaseModel):
    columns: list[ColumnData]
    cards: dict[str, CardData]

class ChatRequest(BaseModel):
    message: str

# Helpers
def _get_board_or_404(db: Session, user_id: int) -> Board:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    board = db.query(Board).filter(Board.user_id == user_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

def _serialize_board(db: Session, board: Board) -> dict:
    columns = db.query(ColumnModel).filter(ColumnModel.board_id == board.id).order_by(ColumnModel.position).all()
    cards = db.query(Card).filter(Card.column_id.in_([c.id for c in columns])).all()
    cards_by_col: dict[int, list] = {}
    for card in cards:
        cards_by_col.setdefault(card.column_id, []).append(card)
    return {
        "columns": [
            {
                "id": f"col-{c.id}",
                "title": c.title,
                "cardIds": [
                    f"card-{card.id}"
                    for card in sorted(cards_by_col.get(c.id, []), key=lambda x: x.position)
                ],
            }
            for c in columns
        ],
        "cards": {
            f"card-{card.id}": {
                "id": f"card-{card.id}",
                "title": card.title,
                "details": card.details or "",
            }
            for card in cards
        },
    }

def _replace_board(db: Session, board: Board, update: BoardUpdate) -> None:
    col_ids = [c.id for c in db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()]
    if col_ids:
        db.query(Card).filter(Card.column_id.in_(col_ids)).delete(synchronize_session=False)
    db.query(ColumnModel).filter(ColumnModel.board_id == board.id).delete(synchronize_session=False)
    db.commit()
    for col_pos, col_data in enumerate(update.columns):
        col = ColumnModel(board_id=board.id, title=col_data.title, position=col_pos)
        db.add(col)
        db.flush()
        for card_pos, card_id in enumerate(col_data.cardIds):
            card_data = update.cards.get(card_id)
            if card_data:
                card = Card(
                    column_id=col.id,
                    title=card_data.title,
                    details=card_data.details,
                    position=card_pos,
                )
                db.add(card)
    db.commit()

# Endpoints
@app.post("/api/login")
async def login(request: LoginRequest):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == request.username).first()
        if user and pwd_context.verify(request.password, user.password_hash):
            return JSONResponse(content={"success": True, "token": create_token(user.id)})
        return JSONResponse(content={"success": False}, status_code=401)
    finally:
        db.close()

@app.get("/api/board/{user_id}")
async def get_board(user_id: int, current_user_id: int = Depends(verify_token)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db: Session = SessionLocal()
    try:
        board = _get_board_or_404(db, user_id)
        return JSONResponse(content=_serialize_board(db, board))
    finally:
        db.close()

@app.put("/api/board/{user_id}")
async def update_board(user_id: int, update: BoardUpdate, current_user_id: int = Depends(verify_token)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db: Session = SessionLocal()
    try:
        board = _get_board_or_404(db, user_id)
        _replace_board(db, board, update)
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

@app.post("/api/ai/chat/{user_id}")
async def ai_chat(user_id: int, request: ChatRequest, current_user_id: int = Depends(verify_token)):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db: Session = SessionLocal()
    try:
        board = _get_board_or_404(db, user_id)
        board_data = _serialize_board(db, board)
        ai_response = call_ai_with_board(board_data, request.message)
        response_text = ai_response.get("response", "No response")
        updates = ai_response.get("updates")
        if updates:
            try:
                board_update = BoardUpdate.model_validate(updates)
                _replace_board(db, board, board_update)
            except Exception:
                updates = None
        return JSONResponse(content={"response": response_text, "updated": updates is not None})
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        db.close()

# Mount static files
if os.path.exists("frontend/out"):
    app.mount("/", StaticFiles(directory="frontend/out", html=True), name="static")
