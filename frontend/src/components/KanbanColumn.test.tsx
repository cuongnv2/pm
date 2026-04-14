import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanColumn } from "@/components/KanbanColumn";
import type { Column, Card } from "@/lib/kanban";

// Mock dnd-kit hooks
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: any) => children,
  verticalListSortingStrategy: {},
}));

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

describe("KanbanColumn", () => {
  const mockColumn: Column = {
    id: "col-1",
    title: "To Do",
    cardIds: ["card-1", "card-2"],
  };

  const mockCards: Card[] = [
    { id: "card-1", title: "Task 1", details: "Details 1", priority: "medium", dueDate: "" },
    { id: "card-2", title: "Task 2", details: "Details 2", priority: "high", dueDate: "2026-12-31" },
  ];

  const mockOnRename = vi.fn();
  const mockOnAddCard = vi.fn();
  const mockOnDeleteCard = vi.fn();
  const mockOnDeleteColumn = vi.fn();
  const mockOnEditCard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders column title", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByDisplayValue("To Do")).toBeInTheDocument();
  });

  it("displays card count", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByText("2 cards")).toBeInTheDocument();
  });

  it("renders all cards", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
  });

  it("calls onRename when column title is changed", async () => {
    const user = userEvent.setup();
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    const titleInput = screen.getByDisplayValue("To Do") as HTMLInputElement;

    //  Clear input and type new value
    await user.click(titleInput);
    await user.keyboard("{Control>}a{/Control}");
    await user.type(titleInput, "New Title");

    // Verify onRename was called with the column id
    expect(mockOnRename).toHaveBeenCalled();
    expect(mockOnRename).toHaveBeenCalledWith("col-1", expect.any(String));
  });

  it("shows empty state when no cards", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={[]}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByText("0 cards")).toBeInTheDocument();
    expect(screen.getByText("Drop a card here")).toBeInTheDocument();
  });

  it("renders add card form", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("has correct test id", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByTestId("column-col-1")).toBeInTheDocument();
  });

  it("displays card delete buttons", () => {
    render(
      <KanbanColumn
        column={mockColumn}
        cards={mockCards}
        onRename={mockOnRename}
        onAddCard={mockOnAddCard}
        onDeleteCard={mockOnDeleteCard}
        onEditCard={mockOnEditCard}
        onDeleteColumn={mockOnDeleteColumn}
      />
    );
    expect(screen.getByRole("button", { name: /delete task 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete task 2/i })).toBeInTheDocument();
  });
});
