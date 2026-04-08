import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import type { Card } from "@/lib/kanban";

describe("KanbanCardPreview", () => {
  const mockCard: Card = {
    id: "card-1",
    title: "Test Card",
    details: "Test details",
  };

  it("renders card title and details", () => {
    render(<KanbanCardPreview card={mockCard} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Test details")).toBeInTheDocument();
  });

  it("displays all card information", () => {
    const card: Card = {
      id: "card-2",
      title: "Complex Task",
      details: "This is a detail text",
    };

    render(<KanbanCardPreview card={card} />);
    expect(screen.getByText("Complex Task")).toBeInTheDocument();
    expect(screen.getByText("This is a detail text")).toBeInTheDocument();
  });

  it("handles empty details", () => {
    const card: Card = {
      id: "card-3",
      title: "No Details Card",
      details: "",
    };

    render(<KanbanCardPreview card={card} />);
    expect(screen.getByText("No Details Card")).toBeInTheDocument();
  });
});
