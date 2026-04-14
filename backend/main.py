from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import create_engine, event, text, inspect
from sqlalchemy.orm import sessionmaker, Session
try:
    from .models import Base, User, Board, ColumnModel, Card
    from .ai import call_ai, call_ai_with_board
except ImportError:
    from models import Base, User, Board, ColumnModel, Card
    from ai import call_ai, call_ai_with_board
from passlib.context import CryptContext
from dotenv import load_dotenv, find_dotenv
from datetime import datetime, timedelta, timezone
import jwt
import logging
import os

load_dotenv(find_dotenv(usecwd=True))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Auth
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.environ["JWT_SECRET"]
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
engine = create_engine(DATABASE_URL)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def _migrate_schema():
    """Add new columns to existing tables if they don't exist (safe to run repeatedly)."""
    inspector = inspect(engine)
    with engine.connect() as conn:
        card_columns = {c["name"] for c in inspector.get_columns("cards")}
        if "priority" not in card_columns:
            conn.execute(text("ALTER TABLE cards ADD COLUMN priority TEXT DEFAULT 'medium'"))
            conn.commit()
        if "due_date" not in card_columns:
            conn.execute(text("ALTER TABLE cards ADD COLUMN due_date TEXT"))
            conn.commit()
        user_columns = {c["name"] for c in inspector.get_columns("users")}
        if "display_name" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN display_name TEXT"))
            conn.commit()

_migrate_schema()

def init_db():
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "user").first()
        if not user:
            user = User(username="user", password_hash=pwd_context.hash("password"))
            db.add(user)
            db.commit()
            db.refresh(user)
            _create_default_board(db, user.id)
        elif not user.password_hash.startswith("$2"):
            user.password_hash = pwd_context.hash("password")
            db.commit()
    finally:
        db.close()

def _create_default_board(db: Session, user_id: int) -> Board:
    board = Board(user_id=user_id, name="My Kanban Board")
    db.add(board)
    db.commit()
    db.refresh(board)

    columns_data = [
        ("Backlog", 0), ("Discovery", 1), ("In Progress", 2), ("Review", 3), ("Done", 4),
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
    return board

init_db()

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""

class UpdateProfileRequest(BaseModel):
    display_name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CardData(BaseModel):
    title: str
    details: str = ""
    priority: str = "medium"
    due_date: str = ""

class ColumnData(BaseModel):
    title: str
    cardIds: list[str]

class BoardUpdate(BaseModel):
    columns: list[ColumnData]
    cards: dict[str, CardData]

class CreateBoardRequest(BaseModel):
    name: str

class RenameBoardRequest(BaseModel):
    name: str

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

def _get_board_by_id_or_404(db: Session, board_id: int, current_user_id: int) -> Board:
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
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
                "priority": card.priority or "medium",
                "dueDate": card.due_date or "",
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
                    priority=card_data.priority or "medium",
                    due_date=card_data.due_date or None,
                )
                db.add(card)
    db.commit()


# ===== Auth Endpoints =====

@app.post("/api/login")
async def login(request: LoginRequest):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == request.username).first()
        if user and pwd_context.verify(request.password, user.password_hash):
            return JSONResponse(content={"success": True, "token": create_token(user.id), "user_id": user.id})
        return JSONResponse(content={"success": False}, status_code=401)
    finally:
        db.close()

@app.post("/api/register")
async def register(request: RegisterRequest):
    if not request.username.strip():
        raise HTTPException(status_code=422, detail="Username cannot be empty")
    if len(request.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    db: Session = SessionLocal()
    try:
        if db.query(User).filter(User.username == request.username.strip()).first():
            raise HTTPException(status_code=409, detail="Username already taken")
        user = User(
            username=request.username.strip(),
            password_hash=pwd_context.hash(request.password),
            display_name=request.display_name.strip() or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        _create_default_board(db, user.id)
        return JSONResponse(content={"success": True, "token": create_token(user.id), "user_id": user.id})
    finally:
        db.close()


# ===== User Profile Endpoints =====

@app.get("/api/users/me")
async def get_profile(current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return JSONResponse(content={
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or "",
        })
    finally:
        db.close()

@app.put("/api/users/me")
async def update_profile(request: UpdateProfileRequest, current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.display_name = request.display_name.strip() or None
        db.commit()
        return JSONResponse(content={"success": True})
    finally:
        db.close()

@app.put("/api/users/me/password")
async def change_password(request: ChangePasswordRequest, current_user_id: int = Depends(verify_token)):
    if len(request.new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not pwd_context.verify(request.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = pwd_context.hash(request.new_password)
        db.commit()
        return JSONResponse(content={"success": True})
    finally:
        db.close()


# ===== Multi-Board Endpoints =====

@app.get("/api/boards")
async def list_boards(current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        boards = db.query(Board).filter(Board.user_id == current_user_id).order_by(Board.created_at).all()
        return JSONResponse(content=[
            {"id": b.id, "name": b.name, "created_at": str(b.created_at)}
            for b in boards
        ])
    finally:
        db.close()

@app.post("/api/boards")
async def create_board(request: CreateBoardRequest, current_user_id: int = Depends(verify_token)):
    if not request.name.strip():
        raise HTTPException(status_code=422, detail="Board name cannot be empty")
    db: Session = SessionLocal()
    try:
        board = Board(user_id=current_user_id, name=request.name.strip())
        db.add(board)
        db.commit()
        db.refresh(board)
        # Add 5 default empty columns
        for title, pos in [("Backlog", 0), ("Discovery", 1), ("In Progress", 2), ("Review", 3), ("Done", 4)]:
            db.add(ColumnModel(board_id=board.id, title=title, position=pos))
        db.commit()
        return JSONResponse(content={"id": board.id, "name": board.name})
    finally:
        db.close()

@app.get("/api/boards/{board_id}")
async def get_board_by_id(board_id: int, current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        board = _get_board_by_id_or_404(db, board_id, current_user_id)
        return JSONResponse(content=_serialize_board(db, board))
    finally:
        db.close()

@app.put("/api/boards/{board_id}")
async def update_board_by_id(board_id: int, update: BoardUpdate, current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        board = _get_board_by_id_or_404(db, board_id, current_user_id)
        _replace_board(db, board, update)
        return JSONResponse(content={"success": True})
    finally:
        db.close()

@app.patch("/api/boards/{board_id}")
async def rename_board(board_id: int, request: RenameBoardRequest, current_user_id: int = Depends(verify_token)):
    if not request.name.strip():
        raise HTTPException(status_code=422, detail="Board name cannot be empty")
    db: Session = SessionLocal()
    try:
        board = _get_board_by_id_or_404(db, board_id, current_user_id)
        board.name = request.name.strip()
        db.commit()
        return JSONResponse(content={"success": True})
    finally:
        db.close()

@app.delete("/api/boards/{board_id}")
async def delete_board(board_id: int, current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        board = _get_board_by_id_or_404(db, board_id, current_user_id)
        # Cascade: delete columns+cards first (FK constraints)
        col_ids = [c.id for c in db.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()]
        if col_ids:
            db.query(Card).filter(Card.column_id.in_(col_ids)).delete(synchronize_session=False)
        db.query(ColumnModel).filter(ColumnModel.board_id == board.id).delete(synchronize_session=False)
        db.delete(board)
        db.commit()
        return JSONResponse(content={"success": True})
    finally:
        db.close()


# ===== AI Endpoints =====

@app.post("/api/ai/chat/board/{board_id}")
async def ai_chat_board(board_id: int, request: ChatRequest, current_user_id: int = Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        board = _get_board_by_id_or_404(db, board_id, current_user_id)
        board_data = _serialize_board(db, board)
        ai_response = call_ai_with_board(board_data, request.message)
        response_text = ai_response.get("response", "No response")
        updates = ai_response.get("updates")
        if updates:
            try:
                board_update = BoardUpdate.model_validate(updates)
                _replace_board(db, board, board_update)
            except Exception as exc:
                logger.warning("AI board update validation failed: %s", exc)
                updates = None
        return JSONResponse(content={"response": response_text, "updated": updates is not None})
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        db.close()


# ===== Legacy Endpoints (kept for backward compatibility) =====

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
            except Exception as exc:
                logger.warning("AI board update validation failed: %s", exc)
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
