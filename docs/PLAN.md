# Detailed Project Plan for Project Management MVP

## Part 1: Plan

**Description:** Enrich this document to plan out each of these parts in detail, with substeps listed out as a checklist to be checked off by the agent, and with tests and success criteria for each. Also create an AGENTS.md file inside the frontend directory that describes the existing code there. Ensure the user checks and approves the plan.

**Substeps:**
- [ ] Review existing frontend code structure and components
- [ ] Document key functionalities, dependencies, and architecture in AGENTS.md
- [ ] Create AGENTS.md file in frontend/ directory
- [ ] Break down each subsequent part into detailed substeps with checklists
- [ ] Define tests and success criteria for each part
- [ ] Update this document with enriched content
- [ ] Present the enriched plan to the user for review and approval

**Tests:**
- Manual verification: Ensure AGENTS.md accurately describes the code
- User feedback: Confirm plan is comprehensive and approved

**Success Criteria:**
- AGENTS.md exists in frontend/ with detailed code description
- PLAN.md contains detailed substeps, checklists, tests, and criteria for all parts
- User explicitly approves the plan before proceeding

## Part 2: Scaffolding

**Description:** Set up the Docker infrastructure, the backend in backend/ with FastAPI, and write the start and stop scripts in the scripts/ directory. This should serve example static HTML to confirm that a 'hello world' example works running locally and also make an API call.

**Substeps:**
- [ ] Create Dockerfile in project root for containerizing the app
- [ ] Set up backend/ directory structure
- [ ] Initialize FastAPI app in backend/ with basic routes (e.g., / for static HTML, /api/test for API call)
- [ ] Configure FastAPI to serve static files
- [ ] Install uv as Python package manager in Docker
- [ ] Write start scripts for Mac, PC, Linux in scripts/ (e.g., start-mac.sh, start-windows.bat, start-linux.sh)
- [ ] Write stop scripts for each platform
- [ ] Test building and running the Docker container locally
- [ ] Verify static HTML is served at /
- [ ] Verify API call works (e.g., GET /api/test returns JSON response)

**Tests:**
- Unit tests: Test FastAPI routes
- Integration tests: Build Docker image, run container, check endpoints
- Manual tests: Access / in browser, make API call via curl or browser

**Success Criteria:**
- Docker container builds without errors
- App runs locally via scripts
- Static HTML displays "hello world" at /
- API endpoint responds correctly
- Start/stop scripts work on respective platforms

## Part 3: Add in Frontend

**Description:** Now update so that the frontend is statically built and served, so that the app has the demo Kanban board displayed at /. Comprehensive unit and integration tests.

**Substeps:**
- [ ] Configure Next.js for static export in frontend/
- [ ] Build the frontend statically
- [ ] Update FastAPI to serve the built static files from frontend/
- [ ] Ensure Kanban board demo loads at /
- [ ] Run existing unit tests (kanban.test.ts, KanbanBoard.test.tsx)
- [ ] Add integration tests for full board rendering and interactions
- [ ] Test drag-and-drop functionality in integration tests
- [ ] Verify styling and responsiveness

**Tests:**
- Unit tests: Existing tests pass
- Integration tests: Full board load, add/remove cards, drag-and-drop
- E2E tests: Playwright tests for user flows

**Success Criteria:**
- Frontend builds statically without errors
- Kanban board displays correctly at /
- All unit and integration tests pass
- Drag-and-drop works as expected
- UI matches design (colors, fonts)

## Part 4: Add in a fake user sign in experience

**Description:** Now update so that on first hitting /, you need to log in with dummy credentials ("user", "password") in order to see the Kanban, and you can log out. Comprehensive tests.

**Substeps:**
- [ ] Add login page/component to frontend
- [ ] Implement client-side authentication check (dummy logic)
- [ ] Store login state (e.g., in localStorage)
- [ ] Add logout functionality
- [ ] Update routing to require login before Kanban
- [ ] Add backend route for login (dummy validation)
- [ ] Update static build to include login page
- [ ] Write unit tests for login component
- [ ] Write integration tests for login flow
- [ ] Test logout and session persistence

**Tests:**
- Unit tests: Login form validation, state management
- Integration tests: Login success/failure, logout
- E2E tests: Full login to Kanban flow

**Success Criteria:**
- / redirects to login if not authenticated
- Login with "user"/"password" succeeds
- Kanban visible after login
- Logout clears session and redirects to login
- All tests pass

## Part 5: Database modeling

**Description:** Now propose a database schema for the Kanban, saving it as JSON. Document the database approach in docs/ and get user sign off.

**Substeps:**
- [ ] Design SQLite schema for users, boards, columns, cards
- [ ] Define JSON structure for board data
- [ ] Create sample JSON file with schema
- [ ] Document schema in docs/database-schema.md
- [ ] Document database approach (SQLite, creation on startup)
- [ ] Propose migration strategy if needed
- [ ] Get user sign-off on schema

**Tests:**
- Manual review: Validate schema covers all requirements
- Unit tests: JSON validation against schema

**Success Criteria:**
- Schema documented in docs/
- Sample JSON file created
- User approves the database design

## Part 6: Backend

**Description:** Now add API routes to allow the backend to read and change the Kanban for a given user; test this thoroughly with backend unit tests. The database should be created if it doesn't exist.

**Substeps:**
- [ ] Set up SQLite database connection in FastAPI
- [ ] Create database tables based on schema
- [ ] Add API routes: GET /api/board/{user_id}, PUT /api/board/{user_id}, etc.
- [ ] Implement CRUD operations for boards, columns, cards
- [ ] Add user authentication (dummy for now)
- [ ] Write unit tests for all API routes
- [ ] Write tests for database operations
- [ ] Test database creation on startup
- [ ] Ensure data persistence across restarts

**Tests:**
- Unit tests: API handlers, database functions
- Integration tests: Full CRUD flows
- Database tests: Creation, migrations

**Success Criteria:**
- Database created automatically
- API routes work for reading/writing Kanban data
- All backend unit tests pass
- Data persists correctly

## Part 7: Frontend + Backend

**Description:** Now have the frontend actually use the backend API, so that the app is a proper persistent Kanban board. Test very thoroughly.

**Substeps:**
- [ ] Update frontend to fetch board data from API on load
- [ ] Implement API calls for add/remove/move cards
- [ ] Update state management to sync with backend
- [ ] Handle API errors gracefully
- [ ] Add loading states and error messages
- [ ] Update integration tests to use mock API
- [ ] Write E2E tests for full user flows with backend
- [ ] Test data persistence across sessions
- [ ] Verify drag-and-drop updates backend

**Tests:**
- Unit tests: API client functions
- Integration tests: Frontend-backend interaction
- E2E tests: Complete user workflows

**Success Criteria:**
- Kanban data loads from backend
- Changes persist to backend
- UI updates reflect backend state
- All tests pass, including E2E

## Part 8: AI connectivity

**Description:** Now allow the backend to make an AI call via OpenRouter. Test connectivity with a simple "2+2" test and ensure the AI call is working.

**Substeps:**
- [ ] Set up OpenRouter API client in backend
- [ ] Load OPENROUTER_API_KEY from .env
- [ ] Create AI service module
- [ ] Implement simple test call (e.g., "What is 2+2?")
- [ ] Add API route for AI test
- [ ] Handle API errors and rate limits
- [ ] Write unit tests for AI service
- [ ] Test connectivity and response parsing

**Tests:**
- Unit tests: AI service functions
- Integration tests: API call to OpenRouter

**Success Criteria:**
- AI call succeeds with correct response
- Error handling works
- Tests pass

## Part 9: AI Kanban Integration

**Description:** Now extend the backend call so that it always calls the AI with the JSON of the Kanban board, plus the user's question (and conversation history). The AI should respond with Structured Outputs that includes the response to the user and optionally an update to the Kanban. Test thoroughly.

**Substeps:**
- [ ] Define structured output schema for AI responses
- [ ] Update AI service to include board JSON and user input
- [ ] Implement conversation history tracking
- [ ] Parse AI response for updates and apply to board
- [ ] Add API route for AI chat with board context
- [ ] Handle partial updates (e.g., move card, add card)
- [ ] Write unit tests for parsing and applying updates
- [ ] Test conversation history
- [ ] Ensure AI uses nvidia/llama-nemotron-embed-vl-1b-v2:free model

**Tests:**
- Unit tests: Response parsing, update application
- Integration tests: Full AI interaction with board updates

**Success Criteria:**
- AI receives board JSON and responds with structured output
- Updates applied correctly to board
- Conversation history maintained
- All tests pass

## Part 10: AI Chat UI

**Description:** Now add a beautiful sidebar widget to the UI supporting full AI chat, and allowing the LLM (as it determines) to update the Kanban based on its Structured Outputs. If the AI updates the Kanban, then the UI should refresh automatically.

**Substeps:**
- [ ] Design and implement sidebar chat component
- [ ] Integrate chat with backend AI API
- [ ] Display AI responses in chat
- [ ] Handle board updates from AI and refresh UI
- [ ] Add chat history display
- [ ] Style sidebar with color scheme
- [ ] Write unit tests for chat component
- [ ] Write integration tests for chat-board sync
- [ ] Test real-time updates

**Tests:**
- Unit tests: Chat UI components
- Integration tests: Chat interaction and board updates
- E2E tests: Full chat flow with Kanban changes

**Success Criteria:**
- Sidebar chat works beautifully
- AI responses display correctly
- Board updates from AI refresh UI automatically
- All tests pass
- Matches color scheme and design

---

**Note:** After completing Part 1, present this enriched plan to the user for approval before proceeding to Part 2.