import { render, screen, within } from "@testing-library/react";
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
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    expect(screen.getByPlaceholderText("Card title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Details")).toBeInTheDocument();
  });

  it("allows entering title and details", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    const titleInput = screen.getByPlaceholderText("Card title") as HTMLInputElement;
    const detailsInput = screen.getByPlaceholderText("Details") as HTMLTextAreaElement;

    await user.type(titleInput, "New Task");
    await user.type(detailsInput, "Task details");

    expect(titleInput.value).toBe("New Task");
    expect(detailsInput.value).toBe("Task details");
  });

  it("calls onAdd with title and details on submit", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    const titleInput = screen.getByPlaceholderText("Card title");
    const detailsInput = screen.getByPlaceholderText("Details");
    const submitButton = screen.getByRole("button", { name: /add card/i });

    await user.type(titleInput, "New Task");
    await user.type(detailsInput, "Important task");
    await user.click(submitButton);

    expect(mockOnAdd).toHaveBeenCalledWith("New Task", "Important task");
  });

  it("closes form after successful submission", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    const titleInput = screen.getByPlaceholderText("Card title");
    const submitButton = screen.getByRole("button", { name: /add card/i });

    await user.type(titleInput, "New Task");
    await user.click(submitButton);

    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("closes form on cancel", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it("trims whitespace from title and details", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    const titleInput = screen.getByPlaceholderText("Card title");
    const detailsInput = screen.getByPlaceholderText("Details");
    const submitButton = screen.getByRole("button", { name: /add card/i });

    await user.type(titleInput, "  New Task  ");
    await user.type(detailsInput, "  Details  ");
    await user.click(submitButton);

    expect(mockOnAdd).toHaveBeenCalledWith("New Task", "Details");
  });

  it("prevents submission with empty title", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });

    await user.click(addButton);

    const submitButton = screen.getByRole("button", { name: /add card/i });
    await user.click(submitButton);

    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it("clears form inputs after submission", async () => {
    const user = userEvent.setup();
    render(<NewCardForm onAdd={mockOnAdd} />);

    // First submission
    await user.click(screen.getByRole("button", { name: /add a card/i }));
    const titleInput = screen.getByPlaceholderText("Card title");
    const detailsInput = screen.getByPlaceholderText("Details");

    await user.type(titleInput, "Task 1");
    await user.type(detailsInput, "Details 1");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    // Open form again
    await user.click(screen.getByRole("button", { name: /add a card/i }));

    expect((screen.getByPlaceholderText("Card title") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("Details") as HTMLTextAreaElement).value).toBe("");
  });
});
