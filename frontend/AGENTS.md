# Frontend Code Description

## Overview
The frontend is a Next.js 16 + React 19 demo Kanban board application using TypeScript, Tailwind CSS, and dnd-kit for drag-and-drop functionality. It's a client-side component-based demo ready for integration with a backend.

## Structure
- **App Layout:** Root layout with metadata and custom fonts.
- **Components:** KanbanBoard, KanbanColumn, KanbanCard, KanbanCardPreview, NewCardForm.
- **Utilities:** kanban.ts for data structures and logic.

## Key Functionality
- Manages board state with columns and cards.
- Drag-and-drop for moving cards between columns.
- Add, remove, and rename columns/cards.
- Sample data initialization.

## Styling
Uses Tailwind CSS with custom color scheme: Yellow accent (#ecad0a), Blue primary (#209dd7), Purple secondary (#753991), Dark Navy (#032147), Gray text (#888888).

## Testing
Includes unit tests for logic and integration tests for components.

## Dependencies
- @dnd-kit for drag-and-drop
- Vitest for testing
- Tailwind CSS for styling

This is a pure-frontend demo with all state in React, ready for backend integration.