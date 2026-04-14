# Code Review v2 — Kanban Studio

**Date:** 2026-04-14  
**Reviewer:** Claude Code  
**Scope:** Full codebase — backend, frontend, tests, infrastructure

This is a second-pass review following the previous fixes (JWT auth, bcrypt, cascade deletes, DB indexes, DnD collision detection, Docker hardening). All previously identified critical issues have been resolved. This review covers remaining issues found after those fixes.

---

## Priority Table

| # | Severity | Category | Title |
|---|----------|----------|-------|
| 1 | Critical | Security | `.env` file with API key present on disk |
| 2 | Critical | Security | `JWT_SECRET` falls back to a hardcoded default |
| 3 | High | Bug | AI board refresh never reaches KanbanBoard state |
| 4 | High | Security | `echo=True` logs all SQL to stdout |
| 5 | High | Bug | `refreshBoard()` silently ignores 401/403 responses |
| 6 | High | Security | `choices[0]` access without bounds check in ai.py |
| 7 | Medium | Bug | LoginForm swallows network errors silently |
| 8 | Medium | Code Quality | `getToken()` duplicated in page.tsx and ChatSidebar.tsx |
| 9 | Medium | Code Quality | AI update validation errors silently discarded |
| 10 | Medium | Code Quality | Hardcoded `user_id=1` in all frontend API calls |
| 11 | Medium | Code Quality | Large boards can overflow AI model context window |
| 12 | Medium | Tests | No E2E tests exist despite being listed in CLAUDE.md |
| 13 | Low | Tests | Test board restore is manual, not a fixture |
| 14 | Low | Infrastructure | Node.js installed via apt — version uncontrolled |
| 15 | Low | Infrastructure | No Docker HEALTHCHECK |
| 16 | Low | Infrastructure | No CORS middleware configured |

---

## Issues

### 1. `.env` file with API key present on disk

**Severity:** Critical  
**File:** `.env`

The `.env` file exists in the working directory and contains a live API key:

```
OPENROUTER_API_KEY=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
```

While `.gitignore` lists `.env`, the file is present locally and could be accidentally committed in the future. The key should be rotated regardless of whether it was previously committed to git history.

**Action:**
1. Rotate the OpenRouter API key at openrouter.ai.
2. Replace `.env` with `.env.example` containing `OPENROUTER_API_KEY=` (empty) as a template.
3. Update README to instruct users to copy `.env.example` to `.env` and fill in their own key.
4. Verify `.gitignore` includes `.env` and not `.env.example`.

---

### 2. `JWT_SECRET` falls back to a hardcoded default

**Severity:** Critical  
**File:** `backend/main.py:26`

```python
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
```

If `JWT_SECRET` is not set in the environment (e.g., Docker run without `-e JWT_SECRET=...`), the default is used. Any token signed with this default is forgeable by anyone who reads the source code.

**Action:**  
Remove the default. Fail loudly on startup if `JWT_SECRET` is not set:

```python
JWT_SECRET = os.environ["JWT_SECRET"]  # raises KeyError if not set
```

Add `JWT_SECRET` to `.env.example` and document it as a required environment variable.

---

### 3. AI board refresh never reaches KanbanBoard state

**Severity:** High  
**File:** `frontend/src/app/page.tsx:77-89`, `frontend/src/components/KanbanBoard.tsx:32`

When the AI assistant updates the board, `ChatSidebar` calls `onRefresh()`, which calls `refreshBoard()` in `page.tsx`. This updates `boardData` state in the page and re-renders `KanbanBoard` with a new `initialData` prop. However, `KanbanBoard` initialises its own `board` state from `initialData` only once:

```typescript
// KanbanBoard.tsx:32 — initialData is read once at mount; prop changes are ignored
const [board, setBoard] = useState<BoardData>(() => initialData || { columns: [], cards: {} });
```

React's `useState` initialiser runs only on the first render. Subsequent changes to the `initialData` prop have no effect. As a result, AI-triggered board updates fetch new data from the server but the displayed board never changes.

**Action:**  
Replace the local `board` state in `KanbanBoard` with the `initialData` prop directly (lift state up). `page.tsx` already owns `boardData`; pass it down and let `KanbanBoard` call `onUpdate` for mutations. Remove the internal `useState` for `board` in `KanbanBoard` and use the prop directly. Alternatively, add a `useEffect` that calls `setBoard(initialData)` when `initialData` changes:

```typescript
useEffect(() => {
  if (initialData) setBoard(initialData);
}, [initialData]);
```

The former approach (lift state up) is cleaner and eliminates the duplication.

---

### 4. `echo=True` logs all SQL to stdout

**Severity:** High  
**File:** `backend/main.py:46`

```python
engine = create_engine(DATABASE_URL, echo=True)
```

Every SQL statement — including those carrying usernames and board content — is printed to stdout. This is debug-only behaviour and must not run in production.

**Action:**  
Remove `echo=True`:

```python
engine = create_engine(DATABASE_URL)
```

---

### 5. `refreshBoard()` silently ignores 401/403 responses

**Severity:** High  
**File:** `frontend/src/app/page.tsx:77-89`

```typescript
const refreshBoard = async () => {
  try {
    const response = await fetch("/api/board/1", { ... });
    if (response.ok) {
      const data = await response.json();
      setBoardData(data);
    }
    // Non-ok responses are silently dropped
  } catch {
    setError("Failed to refresh board");
  }
};
```

If the token has expired and the server returns 401, `refreshBoard` does nothing. The user remains on the board screen with stale data. Compare `fetchBoard()` (lines 40-63) which correctly handles 401/403 by clearing auth state — `refreshBoard` lacks this same logic.

**Action:**  
Add the same 401/403 handling as `fetchBoard`:

```typescript
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("authToken");
    setLoggedIn(false);
  } else {
    setError("Failed to refresh board");
  }
}
```

---

### 6. `choices[0]` access without bounds check in ai.py

**Severity:** High  
**File:** `backend/ai.py:22`, `backend/ai.py:61`

```python
result = response.json()
return result["choices"][0]["message"]["content"]  # line 22
```

```python
result = response.json()
content = result["choices"][0]["message"]["content"]  # line 61
```

If OpenRouter returns an empty `choices` array (which can happen on rate-limit, model errors, or malformed requests), these lines raise `IndexError`. The `KeyError` case also exists if the response structure differs from expected.

**Action:**  
Add bounds checking before accessing:

```python
choices = result.get("choices", [])
if not choices:
    raise Exception(f"AI returned no choices: {result}")
return choices[0]["message"]["content"]
```

---

### 7. LoginForm swallows network errors silently

**Severity:** Medium  
**File:** `frontend/src/components/LoginForm.tsx:14-28`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const response = await fetch("/api/login", { ... });  // can throw
  const data = await response.json();
  // ...
};
```

There is no try/catch around the fetch. If the backend is unreachable, an unhandled promise rejection is thrown and the form gives no feedback to the user — the button just stops responding.

**Action:**  
Wrap the body in try/catch:

```typescript
try {
  const response = await fetch(...);
  const data = await response.json();
  if (data.success) { ... } else { setError("Invalid credentials"); }
} catch {
  setError("Cannot reach server");
}
```

---

### 8. `getToken()` duplicated in page.tsx and ChatSidebar.tsx

**Severity:** Medium  
**File:** `frontend/src/app/page.tsx:8-14`, `frontend/src/components/ChatSidebar.tsx:11-17`

Identical function in two files:

```typescript
const getToken = () => {
  try { return localStorage.getItem("authToken") || ""; }
  catch { return ""; }
};
```

**Action:**  
Move to `frontend/src/lib/auth.ts` and export it. Import from there in both files.

---

### 9. AI update validation errors silently discarded

**Severity:** Medium  
**File:** `backend/main.py:248-253`

```python
if updates:
    try:
        board_update = BoardUpdate.model_validate(updates)
        _replace_board(db, board, board_update)
    except Exception:
        updates = None  # silently swallowed
```

When the AI returns a malformed board structure that fails Pydantic validation, the error is swallowed without any logging. The response tells the client `"updated": false` with no explanation. Debugging AI update failures requires adding logging manually.

**Action:**  
Log the validation error:

```python
except Exception as exc:
    import logging
    logging.warning("AI board update validation failed: %s", exc)
    updates = None
```

Or surface a hint to the client:

```python
return JSONResponse(content={"response": response_text, "updated": False, "update_error": str(exc)})
```

---

### 10. Hardcoded `user_id=1` in all frontend API calls

**Severity:** Medium  
**File:** `frontend/src/app/page.tsx:44,79,93`, `frontend/src/components/ChatSidebar.tsx:37`

```typescript
const response = await fetch("/api/board/1", { ... });
```

The user ID is hardcoded. Decoding the JWT on the client or returning the user ID on login would make this maintainable. The backend already validates that `current_user_id == user_id`, so the front-end call just needs to pass the right value.

**Action:**  
Return `user_id` in the login response alongside the token:

```python
return JSONResponse(content={"success": True, "token": create_token(user.id), "user_id": user.id})
```

Store it in `localStorage` on login and read it in `getToken()` / wherever the user ID is needed.

---

### 11. Large boards can overflow AI model context window

**Severity:** Medium  
**File:** `backend/ai.py:34`

```python
board_str = json.dumps(board_json)
prompt = f"""...board: {board_str}..."""
```

The full board JSON is embedded in the prompt with no token budget check or truncation. For a board with many cards and long details fields, the prompt can exceed the model's context limit. The free `nvidia/nemotron` model has relatively small context windows.

**Action:**  
Add a character budget before embedding the board. If `len(board_str) > 8000`, truncate card `details` fields to a short summary or omit them:

```python
if len(board_str) > 8000:
    # Strip details from cards to reduce size
    compact = {"columns": board_json["columns"], "cards": {
        k: {"id": v["id"], "title": v["title"]} for k, v in board_json["cards"].items()
    }}
    board_str = json.dumps(compact)
```

---

### 12. No E2E tests exist despite being listed in CLAUDE.md

**Severity:** Medium  
**File:** `frontend/tests/` (does not exist), `CLAUDE.md`

`CLAUDE.md` documents `npm run test:e2e` and mentions `frontend/tests/kanban.spec.ts`, but this file does not exist. The Playwright dependency may or may not be installed.

**Action:**  
Either create a minimal `frontend/tests/kanban.spec.ts` covering:
- Login flow
- Board renders with cards
- Drag card between columns
- AI chat interaction

Or remove the Playwright references from CLAUDE.md and `package.json` if E2E tests are out of scope for now. Leaving the reference in place creates false confidence.

---

### 13. Test board restore is manual, not a fixture

**Severity:** Low  
**File:** `backend/test_main.py`

Several tests that mutate the board call `_restore_default_board()` manually at the end. If such a test fails mid-run before reaching the restore call, subsequent tests see unexpected board state.

**Action:**  
Use a `yield` fixture with cleanup, or call `_restore_default_board()` in a `try/finally` block within each test, or make it an autouse fixture scoped to tests that need it:

```python
@pytest.fixture(autouse=True)
def reset_board(auth_headers):
    yield
    _restore_default_board(auth_headers)
```

---

### 14. Node.js installed via apt — version uncontrolled

**Severity:** Low  
**File:** `Dockerfile:4`

```dockerfile
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
```

The `python:3.12-slim` base image ships with a Debian-era Node.js, typically v18 or older. The installed version depends on the base image's apt repositories and can differ between builds.

**Action:**  
Use a multi-stage build — build the frontend in a `node:22-slim` stage, then copy `frontend/out/` into the Python stage. This pins the Node version and reduces final image size:

```dockerfile
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/ .
RUN npm ci && npm run build

FROM python:3.12-slim
WORKDIR /app
COPY --from=frontend-builder /app/frontend/out ./frontend/out
COPY backend/ ./backend/
RUN pip install -r backend/requirements.txt
RUN useradd -m appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 15. No Docker HEALTHCHECK

**Severity:** Low  
**File:** `Dockerfile`

There is no `HEALTHCHECK` directive. Docker and any orchestrator cannot tell if the app has started or is stuck.

**Action:**  
Add a healthcheck:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/test || exit 1
```

Requires `curl` to be installed in the image, or use a Python one-liner alternative.

---

### 16. No CORS middleware configured

**Severity:** Low  
**File:** `backend/main.py`

No `CORSMiddleware` is added to the FastAPI app. The frontend is currently served from the same origin, so this is not an active bug. However, local development often uses `npm run dev` on port 3000 while the backend runs on 8000. In that case all API calls will be blocked by the browser.

**Action:**  
Add CORS middleware, restricted to known origins:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## Confirmed Fixed (from v1 review)

The following issues from the v1 review are confirmed resolved:

| Issue | Fix |
|-------|-----|
| Plaintext passwords | bcrypt via passlib — `pwd_context.verify/hash` |
| No auth on board/AI endpoints | JWT `verify_token` dependency on all protected routes |
| Mutable default in `call_ai_with_board` | `history: list \| None = None` + guard |
| No HTTP timeout on AI calls | `timeout=30` added to both `requests.post()` calls |
| Deprecated SQLAlchemy import | `from sqlalchemy.orm import declarative_base` |
| Deprecated `onKeyPress` | Changed to `onKeyDown` in ChatSidebar |
| Missing DB indexes | `index=True` on username, user_id, board_id, column_id |
| Missing cascade deletes | `ondelete='CASCADE'` on all ForeignKeys + PRAGMA |
| Docker running as root | `useradd -m appuser` + `USER appuser` |
| `.env` baked into Docker image | `COPY .env .env` removed from Dockerfile |
| DnD collision detection bug | `pointerWithin` + `closestCenter` fallback |
| Unused `initialData` export | Removed from `kanban.ts` |
