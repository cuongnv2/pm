# Database Schema for Kanban MVP

## Overview
The application uses SQLite as the database for persistence. The database is created automatically on startup if it doesn't exist. For the MVP, we support one user and one board per user.

## Database Approach
- **Engine:** SQLite (file-based, no server required)
- **Location:** `kanban.db` in the project root or configurable path
- **Creation:** Database and tables are created on first run via SQLAlchemy or raw SQL
- **Migrations:** For MVP, no migrations needed; schema is fixed. Future versions can use Alembic for migrations.

## Schema Design
Normalized relational schema for flexibility and scalability.

### Tables

#### users
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- username: TEXT UNIQUE NOT NULL (for MVP, default 'user')
- password_hash: TEXT (for MVP, store plain 'password' or hash later)
- created_at: DATETIME DEFAULT CURRENT_TIMESTAMP

#### boards
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- user_id: INTEGER NOT NULL, FOREIGN KEY REFERENCES users(id)
- name: TEXT NOT NULL (default 'My Kanban Board')
- created_at: DATETIME DEFAULT CURRENT_TIMESTAMP

#### columns
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- board_id: INTEGER NOT NULL, FOREIGN KEY REFERENCES boards(id)
- title: TEXT NOT NULL
- position: INTEGER NOT NULL (for ordering)

#### cards
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- column_id: INTEGER NOT NULL, FOREIGN KEY REFERENCES columns(id)
- title: TEXT NOT NULL
- details: TEXT
- position: INTEGER NOT NULL (for ordering within column)

## JSON Structure for Board Data
For API responses and frontend consumption, the board data is serialized to JSON:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    },
    ...
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics."
    },
    ...
  }
}
```

## Sample Data
See `docs/sample-board.json` for a complete sample.

## Implementation Notes
- Use SQLAlchemy for ORM to simplify queries and relationships.
- On startup, check if database exists; if not, create tables and insert default user/board.
- For MVP, hardcode user 'user' with board populated from initial data.
- Future: Add authentication, multiple boards, etc.

## Migration Strategy
- MVP: No migrations; drop and recreate if schema changes.
- Production: Use Alembic for versioned migrations.