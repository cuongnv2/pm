import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from models import Base, User, Board, ColumnModel, Card
from datetime import datetime


# Create an in-memory SQLite database for testing
@pytest.fixture
def db_session():
    """Create a test database session."""
    engine = create_engine("sqlite:///:memory:")
    
    # Enable foreign key constraints for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    yield session
    session.close()


# ==== User Model Tests ====

def test_user_creation(db_session):
    """Test creating a User model."""
    user = User(username="testuser", password_hash="hashed_password")
    db_session.add(user)
    db_session.commit()

    retrieved = db_session.query(User).filter(User.username == "testuser").first()
    assert retrieved is not None
    assert retrieved.username == "testuser"
    assert retrieved.password_hash == "hashed_password"
    assert retrieved.created_at is not None

def test_user_unique_username(db_session):
    """Test that username must be unique."""
    user1 = User(username="duplicate", password_hash="pass1")
    user2 = User(username="duplicate", password_hash="pass2")
    db_session.add(user1)
    db_session.commit()
    
    db_session.add(user2)
    with pytest.raises(Exception):  # IntegrityError
        db_session.commit()

def test_user_created_at_timestamp(db_session):
    """Test that created_at is automatically set."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    retrieved = db_session.query(User).filter(User.username == "testuser").first()
    assert retrieved.created_at is not None
    assert isinstance(retrieved.created_at, datetime) or retrieved.created_at is not None


# ==== Board Model Tests ====

def test_board_creation(db_session):
    """Test creating a Board model."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    retrieved = db_session.query(Board).filter(Board.user_id == user.id).first()
    assert retrieved is not None
    assert retrieved.name == "My Board"
    assert retrieved.user_id == user.id
    assert retrieved.created_at is not None

def test_board_requires_user(db_session):
    """Test that board must have a valid user_id."""
    board = Board(user_id=99999, name="Orphan Board")
    db_session.add(board)
    with pytest.raises(Exception):  # IntegrityError - foreign key violation
        db_session.commit()

def test_multiple_boards_per_user(db_session):
    """Test that a user can have multiple boards (though MVP has 1)."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board1 = Board(user_id=user.id, name="Board 1")
    board2 = Board(user_id=user.id, name="Board 2")
    db_session.add(board1)
    db_session.add(board2)
    db_session.commit()

    boards = db_session.query(Board).filter(Board.user_id == user.id).all()
    assert len(boards) == 2


# ==== ColumnModel Tests ====

def test_column_creation(db_session):
    """Test creating a ColumnModel."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    column = ColumnModel(board_id=board.id, title="Todo", position=0)
    db_session.add(column)
    db_session.commit()

    retrieved = db_session.query(ColumnModel).filter(ColumnModel.board_id == board.id).first()
    assert retrieved is not None
    assert retrieved.title == "Todo"
    assert retrieved.position == 0
    assert retrieved.board_id == board.id

def test_column_requires_board(db_session):
    """Test that column must have a valid board_id."""
    column = ColumnModel(board_id=99999, title="Todo", position=0)
    db_session.add(column)
    with pytest.raises(Exception):  # IntegrityError
        db_session.commit()

def test_multiple_columns_per_board(db_session):
    """Test that a board can have multiple columns."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    columns_data = [("Backlog", 0), ("In Progress", 1), ("Done", 2)]
    for title, pos in columns_data:
        column = ColumnModel(board_id=board.id, title=title, position=pos)
        db_session.add(column)
    db_session.commit()

    columns = db_session.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()
    assert len(columns) == 3
    assert [c.title for c in sorted(columns, key=lambda x: x.position)] == ["Backlog", "In Progress", "Done"]

def test_column_position_ordering(db_session):
    """Test that columns are ordered by position."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    # Add columns in reverse order
    for title, pos in [("Done", 4), ("In Progress", 1), ("Backlog", 0)]:
        column = ColumnModel(board_id=board.id, title=title, position=pos)
        db_session.add(column)
    db_session.commit()

    columns = db_session.query(ColumnModel).filter(ColumnModel.board_id == board.id).order_by(ColumnModel.position).all()
    assert [c.title for c in columns] == ["Backlog", "In Progress", "Done"]


# ==== Card Model Tests ====

def test_card_creation(db_session):
    """Test creating a Card model."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    column = ColumnModel(board_id=board.id, title="Todo", position=0)
    db_session.add(column)
    db_session.commit()

    card = Card(column_id=column.id, title="Task 1", details="Do something", position=0)
    db_session.add(card)
    db_session.commit()

    retrieved = db_session.query(Card).filter(Card.column_id == column.id).first()
    assert retrieved is not None
    assert retrieved.title == "Task 1"
    assert retrieved.details == "Do something"
    assert retrieved.position == 0

def test_card_details_optional(db_session):
    """Test that card details are optional."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    column = ColumnModel(board_id=board.id, title="Todo", position=0)
    db_session.add(column)
    db_session.commit()

    card = Card(column_id=column.id, title="Task 1", position=0)
    db_session.add(card)
    db_session.commit()

    retrieved = db_session.query(Card).filter(Card.column_id == column.id).first()
    assert retrieved.details is None

def test_card_requires_column(db_session):
    """Test that card must have a valid column_id."""
    card = Card(column_id=99999, title="Orphan Card", position=0)
    db_session.add(card)
    with pytest.raises(Exception):  # IntegrityError
        db_session.commit()

def test_multiple_cards_per_column(db_session):
    """Test that a column can have multiple cards."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    column = ColumnModel(board_id=board.id, title="Todo", position=0)
    db_session.add(column)
    db_session.commit()

    for i in range(5):
        card = Card(column_id=column.id, title=f"Task {i}", details=f"Details {i}", position=i)
        db_session.add(card)
    db_session.commit()

    cards = db_session.query(Card).filter(Card.column_id == column.id).all()
    assert len(cards) == 5

def test_card_position_ordering(db_session):
    """Test cards can be ordered by position."""
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="My Board")
    db_session.add(board)
    db_session.commit()

    column = ColumnModel(board_id=board.id, title="Todo", position=0)
    db_session.add(column)
    db_session.commit()

    # Add cards in random order
    for title, pos in [("Task 3", 2), ("Task 1", 0), ("Task 2", 1)]:
        card = Card(column_id=column.id, title=title, position=pos)
        db_session.add(card)
    db_session.commit()

    cards = db_session.query(Card).filter(Card.column_id == column.id).order_by(Card.position).all()
    assert [c.title for c in cards] == ["Task 1", "Task 2", "Task 3"]


# ==== Relationship Tests ====

def test_full_hierarchy(db_session):
    """Test the full user -> board -> column -> card hierarchy."""
    # Create user
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    # Create board
    board = Board(user_id=user.id, name="Project Board")
    db_session.add(board)
    db_session.commit()

    # Create column
    column = ColumnModel(board_id=board.id, title="In Progress", position=0)
    db_session.add(column)
    db_session.commit()

    # Create card
    card = Card(column_id=column.id, title="Important Task", details="High priority", position=0)
    db_session.add(card)
    db_session.commit()

    # Verify we can navigate the hierarchy
    retrieved_card = db_session.query(Card).filter(Card.title == "Important Task").first()
    assert retrieved_card is not None
    
    retrieved_column = db_session.query(ColumnModel).filter(ColumnModel.id == retrieved_card.column_id).first()
    assert retrieved_column.title == "In Progress"
    
    retrieved_board = db_session.query(Board).filter(Board.id == retrieved_column.board_id).first()
    assert retrieved_board.name == "Project Board"
    
    retrieved_user = db_session.query(User).filter(User.id == retrieved_board.user_id).first()
    assert retrieved_user.username == "testuser"

def test_cascade_operations(db_session):
    """Test that queries work correctly with foreign key relationships."""
    # Create complete structure
    user = User(username="testuser", password_hash="pass")
    db_session.add(user)
    db_session.commit()

    board = Board(user_id=user.id, name="Board")
    db_session.add(board)
    db_session.commit()

    for col_idx in range(3):
        column = ColumnModel(board_id=board.id, title=f"Column {col_idx}", position=col_idx)
        db_session.add(column)
    db_session.commit()

    # Add cards to columns
    columns = db_session.query(ColumnModel).filter(ColumnModel.board_id == board.id).all()
    for col_idx, column in enumerate(columns):
        for card_idx in range(2):
            card = Card(column_id=column.id, title=f"Card {col_idx}-{card_idx}", position=card_idx)
            db_session.add(card)
    db_session.commit()

    # Verify structure
    board_check = db_session.query(Board).filter(Board.id == board.id).first()
    columns_check = db_session.query(ColumnModel).filter(ColumnModel.board_id == board_check.id).all()
    assert len(columns_check) == 3

    total_cards = 0
    for column in columns_check:
        cards = db_session.query(Card).filter(Card.column_id == column.id).all()
        total_cards += len(cards)
    assert total_cards == 6
