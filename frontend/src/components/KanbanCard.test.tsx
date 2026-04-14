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

// createPortal renders into document.body in jsdom — no mock needed,
// but we need a body element to be available (jsdom provides it).

describe("KanbanCard", () => {
  const mockCard: Card = {
    id: "card-1",
    title: "Test Card",
    details: "Test details",
    priority: "medium",
    dueDate: "",
  };

  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card with title and details", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Test details")).toBeInTheDocument();
  });

  it("renders trash icon delete button", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);
    expect(screen.getByRole("button", { name: /delete test card/i })).toBeInTheDocument();
  });

  it("shows confirmation modal after clicking delete icon", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /delete test card/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete card/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel delete/i })).toBeInTheDocument();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete after confirming in modal", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /delete test card/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(mockOnDelete).toHaveBeenCalledWith("card-1");
  });

  it("does not call onDelete when modal is cancelled", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /delete test card/i }));
    await user.click(screen.getByRole("button", { name: /cancel delete/i }));

    expect(mockOnDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal when clicking backdrop", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /delete test card/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("dialog"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it("has correct test id", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);
    expect(screen.getByTestId("card-card-1")).toBeInTheDocument();
  });

  it("displays empty details correctly", () => {
    const cardNoDetails: Card = {
      id: "card-2",
      title: "No Details",
      details: "",
      priority: "low",
      dueDate: "",
    };
    render(<KanbanCard card={cardNoDetails} onDelete={mockOnDelete} onEdit={mockOnEdit} />);
    expect(screen.getByText("No Details")).toBeInTheDocument();
  });

  it("renders edit button", () => {
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);
    expect(screen.getByRole("button", { name: /edit test card/i })).toBeInTheDocument();
  });

  it("opens edit modal when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /edit test card/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Card title")).toHaveValue("Test Card");
    expect(screen.getByLabelText("Card details")).toHaveValue("Test details");
  });

  it("calls onEdit with updated values when form is saved", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /edit test card/i }));

    const titleInput = screen.getByTestId("edit-title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");

    await user.click(screen.getByRole("button", { name: /save card/i }));

    expect(mockOnEdit).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ title: "Updated Title" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not call onEdit when edit modal is cancelled", async () => {
    const user = userEvent.setup();
    render(<KanbanCard card={mockCard} onDelete={mockOnDelete} onEdit={mockOnEdit} />);

    await user.click(screen.getByRole("button", { name: /edit test card/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
