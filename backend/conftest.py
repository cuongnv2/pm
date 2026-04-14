import sys
import os
import tempfile

# Allow direct imports (from main import ...) when running pytest from backend/
sys.path.insert(0, os.path.dirname(__file__))

# Use a temporary database for each test session so tests never touch kanban.db
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.close(_test_db_fd)
os.unlink(_test_db_path)  # SQLite will recreate it; we just need the path
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("JWT_SECRET", "test-secret")

def pytest_sessionfinish(session, exitstatus):
    try:
        os.unlink(_test_db_path)
    except FileNotFoundError:
        pass
