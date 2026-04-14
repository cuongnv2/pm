# Code Review: Kanban Studio

**Date:** 2026-04-08  
**Scope:** Full codebase — backend, frontend, infrastructure, tests

---

## Summary

Kanban Studio is a tightly scoped MVP: one user, one board, local Docker deployment. Given those constraints, the code is generally readable and functional. The critical issues below are not surprising for an MVP, but several of them (plaintext passwords, no auth on board endpoints, `.env` baked into the Docker image) would need to be addressed before any expansion of scope or user access.

---

## Critical Issues

### 1. Plaintext password storage (`backend/main.py:35`, `main.py:90`)

```python
user = User(username="user", password_hash="password")
...
if user and user.password_hash == request.password:
```

The field is named `password_hash` but contains a plaintext string. Any DB leak exposes credentials immediately. Use `bcrypt` or `passlib` even for an MVP — it is a one-line change for hashing and a one-line check for verification.

### 2. No authentication on board endpoints (`backend/main.py:96–260`)

`GET /api/board/{user_id}` and `PUT /api/board/{user_id}` accept any `user_id` with no session or token check. Any unauthenticated caller can read or overwrite any user's board. The login endpoint exists but its response (`{"success": true}`) is never used to gate subsequent requests.

### 3. `.env` baked into the Docker image (`Dockerfile:22`)

```dockerfile
COPY .env .env
```

The API key is copied into the image layer and persists in the image history even if later deleted. Anyone who pulls or inspects the image can extract the key. Pass secrets via `docker run --env-file` or Docker secrets at runtime instead of copying the file at build time.

### 4. Mutable default argument (`backend/ai.py:26`)

```python
def call_ai_with_board(board_json: dict, user_input: str, history: list = []) -> dict:
```

Classic Python bug: the default `[]` is shared across all calls. Any mutations to `history` inside the function would persist between invocations. Change to `history: list | None = None` and assign `history = history or []` inside the function body.

### 5. No request timeout on external API calls (`backend/ai.py:19`, `ai.py:55`)

```python
response = requests.post(url, headers=headers, json=data)
```

Both `call_ai` and `call_ai_with_board` make unbounded HTTP calls. A slow or hung OpenRouter response will hold the FastAPI worker indefinitely. Add `timeout=30` (or similar) to both calls.

---

## Bugs

### 6. `loggedIn` state set before board fetch completes (`frontend/src/app/page.tsx:39`)

```typescript
if (response.ok) {
  const data = await response.json();
  setBoardData(data);
  setLoggedIn(true);  // only reached on success — this is correct
```

Actually this is fine; `setLoggedIn(true)` is inside the `if (response.ok)` block. However, the inverse case has a bug: if `fetchBoard()` fails (non-ok response), `setLoggedIn` is never called — but `localStorage.setItem("loggedIn", "true")` was already written by `LoginForm` before `handleLogin` → `fetchBoard` is invoked. On the next page load, `useEffect` will call `fetchBoard()` again and on failure show `"Failed to load board"` with no way to get back to the login screen (the user appears logged in, board fails, error is shown). A logout button is unreachable at that point since `!loggedIn` renders `<LoginForm>` but `loggedIn` is `false` while `error` is non-empty and the error state renders first.

### 7. Error state blocks login re-entry (`frontend/src/app/page.tsx:97–99`)

```typescript
if (error) {
  return <div ...>{error}</div>;
}
```

This renders before the `!loggedIn` check on line 89. If an error is set (e.g., network failure), `<LoginForm>` is never shown; the user sees only the error string with no recourse. Move the error display inside the logged-in view, or clear `error` on logout.

### 8. `columns.index(col_data)` is O(n) and fragile (`backend/main.py:157`, `main.py:242`)

```python
position=update.columns.index(col_data)
```

`list.index()` uses object identity/equality and iterates the list for each column. For the same reason, `col_data["cardIds"].index(card_id)` on line 167 does the same for every card. Both are quadratic in board size. Use `enumerate()` instead:

```python
for pos, col_data in enumerate(update.columns):
    ...
for card_pos, card_id in enumerate(col_data["cardIds"]):
```

### 9. Duplicate board-serialization and board-update logic (`backend/main.py:108–126` and `202–220`; `147–170` and `232–255`)

The board-to-JSON serialization block is copy-pasted verbatim between `get_board` and `ai_chat`. The delete-and-reinsert block is copy-pasted between `update_board` and `ai_chat`. Extract each into a helper function (`serialize_board(db, board)` and `replace_board(db, board, update_data)`). Any future bug fix or schema change currently needs to be applied in two places.

### 10. Column ID generation is lossy (`backend/main.py:114`)

```python
"id": f"col-{c.title.lower().replace(' ', '-')}",
```

Two columns with titles that normalize to the same slug (e.g., "In Progress" and "In-Progress") would produce the same `id`. The `id` is also not stable — renaming a column changes its id, which breaks any client state that was keyed on the old id. Consider using the database primary key (`f"col-{c.id}"`) as the stable identifier.

---

## Code Quality

### 11. `KanbanBoard` props typed as `any` (`frontend/src/components/KanbanBoard.tsx:19`)

```typescript
export const KanbanBoard = ({ initialData, onUpdate, ... }: { initialData: any, onUpdate: (data: any) => void, ... })
```

The project already has `BoardData` defined in `kanban.ts`. Using `any` here defeats TypeScript's value entirely for this component. Replace with the correct types.

### 12. `BoardUpdate` Pydantic model uses untyped collections (`backend/main.py:131–133`)

```python
class BoardUpdate(BaseModel):
    columns: list
    cards: dict
```

These accept any list/dict with no structure validation. Malformed payloads (missing `title`, `cardIds`, `details` keys) will cause unhandled `KeyError` exceptions deep inside the update loop. Define nested models or use `list[dict]` with explicit field access validation.

### 13. `initialData` in `kanban.ts` is never used

`kanban.ts` exports a hardcoded `initialData` object (lines 18–72) that duplicates the seed data in `main.py:60–69`. This static export is not imported anywhere in the current codebase — it appears to be a leftover from before the backend was wired up. Remove it to avoid confusion about the authoritative data source.

### 14. Deprecated API in `models.py:3`

```python
from sqlalchemy.ext.declarative import declarative_base
```

`declarative_base` from `ext.declarative` has been deprecated since SQLAlchemy 1.4. Use `from sqlalchemy.orm import declarative_base` instead.

### 15. `onKeyPress` is deprecated (`frontend/src/components/ChatSidebar.tsx:93`)

```typescript
onKeyPress={(e) => e.key === "Enter" && sendMessage()}
```

`onKeyPress` is deprecated in React and removed in some browsers. Use `onKeyDown` instead.

### 16. Missing database indexes (`backend/models.py`)

`User.username` is queried on every login with no index. `Board.user_id`, `ColumnModel.board_id`, and `Card.column_id` are all foreign keys queried on every board load with no index. SQLite will do full table scans. Add `index=True` to these columns.

### 17. Missing cascade deletes (`backend/models.py`)

Foreign keys are declared but no `CASCADE` is configured. Deleting a `Board` row directly would leave orphaned `ColumnModel` and `Card` rows. The application works around this by manually deleting children first, but the schema itself does not enforce referential integrity. Add `ondelete="CASCADE"` to the ForeignKey declarations and `cascade="all, delete-orphan"` to any ORM relationships if relationships are added later.

---

## Tests

### 18. Tests share the live database

`test_main.py` uses the same `kanban.db` file that the application uses. Tests mutate real state and rely on `_restore_default_board()` to clean up. If a test fails mid-way, the database is left in an unknown state, causing other tests to fail for unrelated reasons. Use an in-memory SQLite database (`sqlite:///:memory:`) or a pytest fixture that creates and tears down a temp DB per test session.

### 19. `_restore_default_board()` duplicates seed logic

The helper in `test_main.py:10–54` is a third copy of the seed data (already in `main.py:47–75` and `kanban.ts:18–72`). If the default board changes, all three need updating. Expose the seed function from `main.py` and call it from tests instead.

### 20. `test_update_board_empty_columns` is order-dependent

This test (line 148) leaves the board empty and calls `_restore_default_board()` at the end. If any test runs after it before restoration completes, or if the test is run in isolation, subsequent tests may fail. Mark it explicitly with `pytest.mark.last` or restructure as a fixture with proper teardown.

### 21. Playwright `webServer` command assumes working directory (`frontend/playwright.config.ts:14`)

```typescript
command: "cd .. && uvicorn backend.main:app --port 8000",
```

This assumes the test runner's cwd is `frontend/`. Running `npm run test:e2e` from the project root or from a different directory will fail. Use `__dirname` or an absolute path to make it robust.

---

## Infrastructure

### 22. Docker image runs as root

The `Dockerfile` adds no `USER` directive. The container process runs as root, which is unnecessary and increases blast radius if the application is compromised. Add a non-root user:

```dockerfile
RUN useradd -m appuser
USER appuser
```

### 23. `apt-get` cache not cleared (`Dockerfile:4`)

```dockerfile
RUN apt-get update && apt-get install -y nodejs npm
```

Without `&& rm -rf /var/lib/apt/lists/*`, the package cache is baked into the image layer, inflating image size unnecessarily.

### 24. `uv` is installed but not used (`Dockerfile:7`, `25`)

```dockerfile
RUN pip install uv
...
#RUN cd backend && uv pip install --system -r requirements.txt
RUN pip install -r backend/requirements.txt
```

Either use `uv` (uncomment line 25, remove line 26) or remove the `uv` install. The commented-out line is dead code and creates confusion.

### 25. Database path is relative (`backend/main.py:21`)

```python
DATABASE_URL = "sqlite:///kanban.db"
```

This creates `kanban.db` relative to wherever the process is started. When run via Docker with `uvicorn backend.main:app`, the file lands in `/app/kanban.db`, which is fine — but only by accident. Make the path explicit or configurable via an environment variable so it is intentional and testable.

---

## Priority Summary

| Priority | Issue |
|----------|-------|
| Critical | #1 Plaintext passwords |
| Critical | #2 No auth on board endpoints |
| Critical | #3 `.env` in Docker image |
| High | #5 No HTTP timeout on AI calls |
| High | #6/#7 Error state traps user |
| High | #4 Mutable default argument |
| Medium | #8 Quadratic position lookup |
| Medium | #9 Duplicate board logic |
| Medium | #11 `any` types in KanbanBoard |
| Medium | #12 Unvalidated BoardUpdate model |
| Medium | #18 Tests share live database |
| Low | #10 Unstable column IDs |
| Low | #13 Unused `initialData` export |
| Low | #14 Deprecated SQLAlchemy import |
| Low | #15 Deprecated `onKeyPress` |
| Low | #16 Missing DB indexes |
| Low | #17 Missing cascade deletes |
| Low | #22–25 Docker hygiene |
