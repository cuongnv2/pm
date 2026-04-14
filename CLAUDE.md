# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kanban Studio is a project management app: NextJS frontend + Python FastAPI backend, packaged in Docker. The FastAPI backend serves the statically exported Next.js site at `/` and exposes a REST API at `/api/`. The database is SQLite (`kanban.db`), created automatically on first run.

MVP constraints: single hardcoded user (`user`/`password`), one board per user, runs locally in Docker.

## Architecture

```
frontend/          Next.js (static export via `next build`)
  src/
    app/           page.tsx + layout.tsx (root)
    components/    KanbanBoard, KanbanColumn, KanbanCard, ChatSidebar, LoginForm, etc.
    lib/           kanban.ts — board state logic and types
  tests/           Playwright e2e tests (kanban.spec.ts)

backend/
  main.py          FastAPI app — REST API, DB init, mounts frontend/out at /
  models.py        SQLAlchemy models: User, Board, ColumnModel, Card
  ai.py            OpenRouter API calls (call_ai, call_ai_with_board)
  test_*.py        pytest unit tests

scripts/           start/stop scripts for Mac/Linux/Windows (Docker)
docs/              PLAN.md, database-schema.md, sample-board.json
```

### Data flow
- Board state is stored in SQLite via SQLAlchemy. API serializes it to `{ columns: [...], cards: {...} }` JSON.
- `PUT /api/board/{user_id}` replaces the entire board (delete all + re-insert).
- AI chat (`POST /api/ai/chat/{user_id}`) sends board JSON to OpenRouter; if the AI returns `updates`, the board is replaced.
- AI model: `nvidia/nemotron-3-super-120b-a12b:free` via OpenRouter. Requires `OPENROUTER_API_KEY` in `.env` at project root.
- The frontend hardcodes `user_id=1` in all API calls (`/api/board/1`, `/api/ai/chat/1`). Login state is stored in `localStorage`.

## Commands

### Docker (production / full stack)
```bash
# Build and run
./scripts/start-mac.sh       # or start-linux.sh / start-windows.bat
./scripts/stop-mac.sh

# Manual
docker build -t pm-app .
docker run -d -p 8000:8000 --name pm-container pm-app
```

### Backend (local dev)
```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Tests
pytest                        # all tests
pytest test_main.py           # single file
pytest test_main.py::test_login  # single test
```

### Frontend (local dev)
```bash
cd frontend
npm install
npm run dev                   # dev server (calls /api/* — needs backend running)
npm run build                 # static export to frontend/out/

# Tests
npm run test:unit             # vitest
npm run test:unit:watch       # vitest watch
npm run test:e2e              # playwright
npm run lint
```

## Coding Standards

- No over-engineering, no unnecessary defensive programming, no extra features
- No emojis ever
- Keep README minimal and concise
- Identify root cause before fixing; prove with evidence
- Use latest versions of libraries and idiomatic patterns
