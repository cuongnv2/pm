import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NewCardForm } from "@/components/NewCardForm";

describe("NewCardForm", () => {
  const mockOnAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders add button when closed", () => {
    render(<NewCardForm onAdd={mockOnAdd} />);
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("opens form when add button is clicked", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));
    expect(screen.getByPlaceholderText("Card title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Details")).toBeInTheDocument();
  });

  it("renders priority selector and due date input", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));
    expect(screen.getByRole("combobox", { name: /priority/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
  });

  it("allows entering title and details", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));

    const titleInput = screen.getByPlaceholderText("Card title") as HTMLInputElement;
    const detailsInput = screen.getByPlaceholderText("Details") as HTMLTextAreaElement;

    await user.type(titleInput, "New Task");
    await user.type(detailsInput, "Task details");

    expect(titleInput.value).toBe("New Task");
    expect(detailsInput.value).toBe("Task details");
  });

  it("calls onAdd with title, details, priority, and dueDate on submit", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));

    await user.type(screen.getByPlaceholderText("Card title"), "New Task");
    await user.type(screen.getByPlaceholderText("Details"), "Important task");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    expect(mockOnAdd).toHaveBeenCalledWith("New Task", "Important task", "medium", "");
  });

  it("calls onAdd with selected priority", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));

    await user.type(screen.getByPlaceholderText("Card title"), "Urgent");
    await user.selectOptions(screen.getByRole("combobox", { name: /priority/i }), "high");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    expect(mockOnAdd).toHaveBeenCalledWith("Urgent", "", "high", "");
  });

  it("closes form after successful submission", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));
    await user.type(screen.getByPlaceholderText("Card title"), "New Task");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("closes form on cancel", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it("trims whitespace from title and details", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));

    await user.type(screen.getByPlaceholderText("Card title"), "  New Task  ");
    await user.type(screen.getByPlaceholderText("Details"), "  Details  ");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    expect(mockOnAdd).toHaveBeenCalledWith("New Task", "Details", "medium", "");
  });

  it("prevents submission with empty title", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    await user.click(screen.getByRole("button", { name: /add a card/i }));
    await user.click(screen.getByRole("button", { name: /add card/i }));
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it("clears form inputs after submission", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);

    await user.click(screen.getByRole("button", { name: /add a card/i }));
    await user.type(screen.getByPlaceholderText("Card title"), "Task 1");
    await user.type(screen.getByPlaceholderText("Details"), "Details 1");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    await user.click(screen.getByRole("button", { name: /add a card/i }));
    expect((screen.getByPlaceholderText("Card title") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("Details") as HTMLTextAreaElement).value).toBe("");
  });
});
