import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanCard } from "@/components/KanbanCard";
import type { Card } from "@/lib/kanban";

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
}));

describe("KanbanCard", () => {
  const mockCard: Card = {
    id: "card-1",
    title: "Test Card",
    details: "Test details",
  };

  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card with title and details", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Test details")).toBeInTheDocument();
  });

  it("renders delete button", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} />);
    expect(screen.getByRole("button", { name: /delete test card/i })).toBeInTheDocument();
  });

  it("calls onDelete when remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} />);
    const deleteButton = screen.getByRole("button", { name: /delete test card/i });

    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith("card-1");
  });

  it("has correct test id", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} />);
    expect(screen.getByTestId("card-card-1")).toBeInTheDocument();
  });

  it("displays empty details correctly", () => {
    const cardNoDetails: Card = {
      id: "card-2",
      title: "No Details",
      details: "",
    };

    render(<KanbanCard card={cardNoDetails} onDelete={mockOnDelete} />);
    expect(screen.getByText("No Details")).toBeInTheDocument();
  });
});
