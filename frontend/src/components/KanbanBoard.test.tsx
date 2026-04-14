import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData, BoardMeta } from "@/lib/kanban";

const initialData: BoardData = {
  columns: [
    { id: "col-1", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-2", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-3", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-4", title: "Review", cardIds: ["card-6"] },
    { id: "col-5", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes.", priority: "medium", dueDate: "" },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags.", priority: "high", dueDate: "" },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch initial dashboard.", priority: "low", dueDate: "" },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize column labels.", priority: "medium", dueDate: "" },
    "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy and spacing.", priority: "critical", dueDate: "2026-12-31" },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover states.", priority: "medium", dueDate: "" },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved.", priority: "medium", dueDate: "" },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes.", priority: "medium", dueDate: "" },
  },
};

const mockBoards: BoardMeta[] = [
  { id: 1, name: "My Kanban Board", created_at: "" },
  { id: 2, name: "Sprint Board", created_at: "" },
];

const mockOnUpdate = vi.fn();
const mockOnLogout = vi.fn();
const mockOnRefresh = vi.fn();
const mockOnToggleDark = vi.fn();
const mockOnSwitchBoard = vi.fn();
const mockOnCreateBoard = vi.fn();
const mockOnDeleteBoard = vi.fn();
const mockOnRenameBoard = vi.fn();

const defaultProps = {
  initialData,
  boards: mockBoards,
  activeBoardId: 1,
  onUpdate: mockOnUpdate,
  onLogout: mockOnLogout,
  onRefresh: mockOnRefresh,
  onToggleDark: mockOnToggleDark,
  darkMode: false,
  onSwitchBoard: mockOnSwitchBoard,
  onCreateBoard: mockOnCreateBoard,
  onDeleteBoard: mockOnDeleteBoard,
  onRenameBoard: mockOnRenameBoard,
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders five columns", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renders header with title", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("renders dark mode toggle button", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("displays Light button when in dark mode", () => {
    render(<KanbanBoard {...defaultProps} darkMode={true} />);
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("calls onToggleDark when dark mode button is clicked", async () => {
    const user = userEvent.setup();
    render(<KanbanBoard {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(mockOnToggleDark).toHaveBeenCalled();
  });

  it("calls onLogout when logout button is clicked", async () => {
    const user = userEvent.setup();
    render(<KanbanBoard {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(mockOnLogout).toHaveBeenCalled();
  });

  it("renders board selector with active board name", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByTestId("board-selector")).toHaveTextContent("My Kanban Board");
  });

  it("renames a column", async () => {
    const user = userEvent.setup();
    render(<KanbanBoard {...defaultProps} />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await user.clear(input);
    await user.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it("renders Add Column button", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByRole("button", { name: /add column/i })).toBeInTheDocument();
  });

  it("adds a new column when Add Column is clicked", async () => {
    const user = userEvent.setup();
    render(<KanbanBoard {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /add column/i }));
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(6);
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it("adds and removes a card", async () => {
    const user = userEvent.setup();
    render(<KanbanBoard {...defaultProps} />);
    const column = getFirstColumn();
    await user.click(within(column).getByRole("button", { name: /add a card/i }));

    await user.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await user.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await user.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    await user.click(within(column).getByRole("button", { name: /delete new card/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });
});
