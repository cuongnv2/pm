# Code Review v3 — Kanban Studio

**Date:** 2026-04-14  
**Reviewer:** Claude Code  
**Scope:** Post-v2-fix pass — new issues introduced or uncovered by recent changes

This review covers the codebase state after the v2 fixes were applied. All v2 Critical and High issues are confirmed resolved. The items below are either newly introduced by the v2 fixes, pre-existing issues not caught in earlier passes, or low-priority items carried from v2.

---

## Priority Table

| # | Severity | Category | Title | File |
|---|----------|----------|-------|------|
| 1 | High | Bug | Side effect inside `setState` updater — double-fires in Strict Mode | KanbanBoard.tsx |
| 2 | High | Bug | Board mutation handlers ignore 401/403 — user not logged out on token expiry | page.tsx |
| 3 | Medium | Bug | Board shows stale state after failed update — no rollback | page.tsx + KanbanBoard.tsx |
| 4 | Medium | Bug | ChatSidebar ignores 401/403 from AI endpoint | ChatSidebar.tsx |
| 5 | Medium | Code Quality | `getUserId()` fallback of `"1"` is semantically wrong when not logged in | auth.ts |
| 6 | Medium | Code Quality | No logging handler configured — `logger.warning()` may be silently dropped | main.py |
| 7 | Medium | Code Quality | AI context budget strips all card details at once rather than selectively | ai.py |
| 8 | Medium | Tests | E2E tests use hardcoded card IDs tied to DB auto-increment | tests/kanban.spec.ts |
| 9 | Low | Tests | Test board restore is manual, not a fixture (carried from v2 #13) | test_main.py |
| 10 | Low | Infrastructure | Node.js installed via apt — version uncontrolled (carried from v2 #14) | Dockerfile |
| 11 | Low | Infrastructure | No Docker HEALTHCHECK (carried from v2 #15) | Dockerfile |
| 12 | Low | Infrastructure | No CORS middleware configured (carried from v2 #16) | main.py |

---

## Issues

### 1. Side effect inside `setState` updater — double-fires in Strict Mode

**Severity:** High  
**File:** `frontend/src/components/KanbanBoard.tsx:62-69`

```typescript
setBoard((prev) => {
  const newBoard = {
    ...prev,
    columns: moveCard(prev.columns, active.id as string, over.id as string),
  };
  onUpdate(newBoard);  // <-- side effect inside updater
  return newBoard;
});
```

React's `setState` updater function must be a pure function. React 18 Strict Mode deliberately calls updaters twice in development to detect violations. With the current code, `onUpdate(newBoard)` — which triggers a `PUT /api/board/{id}` network call — is invoked inside the updater, so in development each drag-end fires two API requests. In production this only fires once, but the pattern is fragile: if React ever batches or retries the updater, the API call would fire again.

The same pattern appears in `handleRenameColumn` (line 76), `handleAddCard` (line 87), and `handleDeleteCard` (line 106) — all call `onUpdate(newBoard)` inside `setBoard`.

**Action:**  
Move `onUpdate` outside the `setState` call. Capture the result and call it after `setBoard`:

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  setActiveCardId(null);
  if (!over || active.id === over.id) return;

  setBoard((prev) => ({
    ...prev,
    columns: moveCard(prev.columns, active.id as string, over.id as string),
  }));

  // Read the new state and call onUpdate separately
  // (Use a ref or functional approach — see below)
};
```

The cleanest fix: compute `newBoard` outside `setBoard`, call `setBoard(newBoard)` (not the updater form), then call `onUpdate(newBoard)`:

```typescript
const newBoard = {
  ...board,
  columns: moveCard(board.columns, active.id as string, over.id as string),
};
setBoard(newBoard);
onUpdate(newBoard);
```

Apply the same pattern to `handleRenameColumn`, `handleAddCard`, and `handleDeleteCard`.

---

### 2. Board mutation handlers ignore 401/403

**Severity:** High  
**File:** `frontend/src/app/page.tsx:91-109`

The v2 fix correctly added 401/403 handling to `refreshBoard`. However, `handleUpdateBoard` still ignores auth errors:

```typescript
const handleUpdateBoard = async (newData: BoardData) => {
  try {
    const response = await fetch(`/api/board/${getUserId()}`, { ... });
    if (response.ok) {
      setBoardData(newData);
    } else {
      setError("Failed to update board");  // no auth check
    }
  } catch {
    setError("Network error");
  }
};
```

If the JWT expires while the user is active, any drag, rename, add, or delete will silently fail with a "Failed to update board" error. The user is not logged out and must manually click Logout.

**Action:**  
Add the same 401/403 branch as `fetchBoard` and `refreshBoard`:

```typescript
} else if (response.status === 401 || response.status === 403) {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userId");
  setLoggedIn(false);
} else {
  setError("Failed to update board");
}
```

---

### 3. Board shows stale state after failed update — no rollback

**Severity:** Medium  
**File:** `frontend/src/app/page.tsx` + `frontend/src/components/KanbanBoard.tsx`

Board mutations use optimistic updates: `setBoard(newBoard)` fires immediately in KanbanBoard before the API responds. If the PUT fails:

1. KanbanBoard's `board` state = new (optimistic) data
2. `page.tsx` `boardData` state = old data (not updated because `setBoardData` is only called on success)
3. `initialData` prop to KanbanBoard = old data (unchanged)
4. The `useEffect` in KanbanBoard does NOT fire because `initialData` reference hasn't changed

Result: KanbanBoard displays wrong state that the server never accepted, with no recovery path except a page reload.

**Action:**  
On update failure in `handleUpdateBoard`, trigger a board refresh to reset KanbanBoard to the server-confirmed state:

```typescript
} else {
  setError("Failed to update board");
  await refreshBoard();  // pull fresh state from server to discard optimistic update
}
```

Alternatively, pass an explicit `key` prop based on a revision counter to force KanbanBoard to remount and re-read `initialData`:

```tsx
<KanbanBoard key={boardRevision} initialData={boardData} ... />
```

---

### 4. ChatSidebar ignores 401/403 from AI endpoint

**Severity:** Medium  
**File:** `frontend/src/components/ChatSidebar.tsx:56-63`

```typescript
} else {
  const errorMessage: Message = {
    id: (Date.now() + 1).toString(),
    text: `Error: ${data.error}`,  // displays "Error: Invalid or expired token"
    isUser: false,
  };
  setMessages((prev) => [...prev, errorMessage]);
}
```

When the token expires, the AI endpoint returns 401 with `{"detail": "Invalid or expired token"}`. ChatSidebar renders this as a chat message and leaves the user on the board. Unlike `page.tsx`, there is no auth-clearing logic here.

**Action:**  
Check the response status before rendering the error message:

```typescript
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    // Notify parent to log out — needs a prop or a shared auth event
  } else {
    // render error as chat message
  }
}
```

This requires adding an `onAuthError` prop to `ChatSidebar` (or using a shared auth event bus) so the parent can call `setLoggedIn(false)`.

---

### 5. `getUserId()` fallback of `"1"` is semantically wrong

**Severity:** Medium  
**File:** `frontend/src/lib/auth.ts:9-13`

```typescript
export const getUserId = () => {
  try {
    return localStorage.getItem("userId") || "1";
  } catch {
    return "1";
  }
};
```

The fallback `"1"` was chosen because MVP has a single user. However, this function is called in unauthenticated states (e.g., after `localStorage.clear()`, or before first login). In those cases it returns `"1"` and API calls are made to `/api/board/1` without a valid token, producing 401s. While 401s are handled, the fallback creates confusion: a function named `getUserId` should return the authenticated user's ID or nothing, not a hardcoded default.

More concretely, if a second user is added in future and their ID is not 1, the fallback silently routes their requests to user 1's board.

**Action:**  
Return an empty string (or `null`) as the fallback:

```typescript
export const getUserId = (): string => {
  try {
    return localStorage.getItem("userId") ?? "";
  } catch {
    return "";
  }
};
```

Guards in `fetchBoard` and `handleUpdateBoard` should check for empty userId before calling the API.

---

### 6. No logging handler configured — `logger.warning()` may be silently dropped

**Severity:** Medium  
**File:** `backend/main.py:21`

```python
logger = logging.getLogger(__name__)
```

There is no `logging.basicConfig()` or handler attached in `main.py`. When running under uvicorn, uvicorn configures its own logging on startup, which typically captures the root logger. In most deployment scenarios the warning will appear. However, when running tests via `pytest` with `TestClient`, uvicorn's logging setup does not run, so `logger.warning("AI board update validation failed: %s", exc)` may produce no output.

**Action:**  
Add a basic logging configuration at startup, or configure logging in a uvicorn startup event:

```python
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
```

Alternatively rely on uvicorn's `--log-config` for production and add a `caplog` assertion in the relevant pytest test to confirm the warning is emitted.

---

### 7. AI context budget strips all card details at once rather than selectively

**Severity:** Medium  
**File:** `backend/ai.py:35-41`

```python
if len(board_str) > 8000:
    compact = {
        "columns": board_json["columns"],
        "cards": {k: {"id": v["id"], "title": v["title"]} for k, v in board_json["cards"].items()},
    }
    board_str = json.dumps(compact)
```

When the board exceeds 8000 characters, all card details are stripped from every card at once. This is a blunt cut: a board with 10 cards where one card has a 3000-character detail field loses context for all 9 other cards. The board could also still exceed 8000 chars after stripping (if there are many cards with long titles), but now with no safety net.

**Action:**  
Truncate selectively — first try trimming only the longest detail fields, then fall back to stripping all:

```python
BUDGET = 8000
board_str = json.dumps(board_json)
if len(board_str) > BUDGET:
    # Truncate individual long details before stripping all
    trimmed_cards = {
        k: {**v, "details": v["details"][:200] + "…" if len(v.get("details", "")) > 200 else v.get("details", "")}
        for k, v in board_json["cards"].items()
    }
    board_str = json.dumps({**board_json, "cards": trimmed_cards})
if len(board_str) > BUDGET:
    # Last resort: strip details entirely
    board_str = json.dumps({
        "columns": board_json["columns"],
        "cards": {k: {"id": v["id"], "title": v["title"]} for k, v in board_json["cards"].items()},
    })
```

---

### 8. E2E tests use hardcoded card IDs tied to DB auto-increment

**Severity:** Medium  
**File:** `frontend/tests/kanban.spec.ts:26,44`

```typescript
const card = page.getByTestId("card-card-1");
const targetColumn = page.getByTestId("column-col-review");
```

`card-card-1` assumes the first card in the DB has primary key `1`. `column-col-review` is incorrect entirely — with the current backend, column IDs are `col-{db_pk}` (e.g., `col-4` for Review, not `col-review`).

Two problems:
1. **Column ID mismatch**: `column-col-review` will never match. The Review column's testid is `column-col-4` (or whatever DB PK it gets). The drag test will always fail with "Unable to resolve drag coordinates."
2. **Card ID fragility**: After any test run that adds cards (the "adds a card" test), the next E2E run starts with a fresh DB where PKs continue from where they left off (if the same `kanban.db` is reused). Card-1 may not exist. The playwright config uses `reuseExistingServer: true`, which also means the DB isn't reset between runs.

**Action:**  
1. Fix the column selector to use the correct ID format — either query by column title instead of testid, or add a `data-testid` based on title slug:
   ```typescript
   const targetColumn = page.getByRole("region").filter({ hasText: "Review" });
   ```
2. Fix the card selector to not rely on a specific PK. Query by card title instead:
   ```typescript
   const card = page.getByTestId(/^card-card-/).first();
   // or
   const card = page.getByText("Align roadmap themes").closest("article");
   ```
3. Add a DB reset between E2E test runs (e.g., delete and recreate `kanban.db` in a `playwright.config.ts` `globalSetup`).

---

### 9. Test board restore is manual, not a fixture (carried from v2 #13)

**Severity:** Low  
**File:** `backend/test_main.py:168, 225`

`_restore_default_board()` is called manually at the end of tests that mutate the board. If the test fails before reaching that call, subsequent tests see unexpected state.

**Action:**  
Wrap in `try/finally` or convert to a `yield` fixture with cleanup.

---

### 10. Node.js installed via apt — version uncontrolled (carried from v2 #14)

**Severity:** Low  
**File:** `Dockerfile:4`

`apt-get install nodejs npm` installs the Debian-packaged Node.js, typically an older LTS version. Use a multi-stage build with `node:22-slim` as the frontend build stage.

---

### 11. No Docker HEALTHCHECK (carried from v2 #15)

**Severity:** Low  
**File:** `Dockerfile`

No `HEALTHCHECK` directive. Docker and orchestrators cannot determine whether the app has started successfully.

**Action:** Add `HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8000/api/test || exit 1`.

---

### 12. No CORS middleware configured (carried from v2 #16)

**Severity:** Low  
**File:** `backend/main.py`

No `CORSMiddleware` is added. Running the frontend dev server (`npm run dev` on port 3000) against the backend on port 8000 will fail due to missing CORS headers.

**Action:** Add `CORSMiddleware` restricted to `http://localhost:3000` for development.
