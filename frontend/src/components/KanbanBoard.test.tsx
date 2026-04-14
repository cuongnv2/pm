import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData } from "@/lib/kanban";

const initialData: BoardData = {
  columns: [
    { id: "col-1", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-2", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-3", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-4", title: "Review", cardIds: ["card-6"] },
    { id: "col-5", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch initial dashboard." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize column labels." },
    "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy and spacing." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover states." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved." },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes." },
  },
};

const mockOnUpdate = vi.fn();
const mockOnLogout = vi.fn();
const mockOnRefresh = vi.fn();
const mockOnToggleDark = vi.fn();

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders five columns", () => {
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renders header with title", () => {
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("renders dark mode toggle button", () => {
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("displays Light button when in dark mode", () => {
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={true}
      />
    );
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("calls onToggleDark when dark mode button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    const darkButton = screen.getByRole("button", { name: "Dark" });

    await user.click(darkButton);

    expect(mockOnToggleDark).toHaveBeenCalled();
  });

  it("calls onLogout when logout button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    const logoutButton = screen.getByRole("button", { name: "Logout" });

    await user.click(logoutButton);

    expect(mockOnLogout).toHaveBeenCalled();
  });

  it("renames a column", async () => {
    const user = userEvent.setup();
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await user.clear(input);
    await user.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it("adds and removes a card", async () => {
    const user = userEvent.setup();
    render(
      <KanbanBoard
        initialData={initialData}
        onUpdate={mockOnUpdate}
        onLogout={mockOnLogout}
        onRefresh={mockOnRefresh}
        onToggleDark={mockOnToggleDark}
        darkMode={false}
      />
    );
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await user.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await user.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await user.type(detailsInput, "Notes");

    await user.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await user.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });
});
