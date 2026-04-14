import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  getUserId: () => "1",
}));

global.fetch = vi.fn();

describe("ChatSidebar", () => {
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    try { localStorage.clear(); } catch { /* jsdom may not expose localStorage */ }
  });

  it("renders chat sidebar with title and input", () => {
    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask the AI...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("allows user to type a message", async () => {
    const user = userEvent.setup();
    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...") as HTMLInputElement;

    await user.type(input, "Test message");
    expect(input.value).toBe("Test message");
  });

  it("sends message on Send button click", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "AI response", updated: false }),
    });

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...");
    const sendButton = screen.getByRole("button", { name: "Send" });

    await user.type(input, "Hello AI");
    await user.click(sendButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/chat/1",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({ message: "Hello AI" }),
        })
      );
    });
  });

  it("sends message on Enter key press", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "AI response", updated: false }),
    });

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...");

    await user.type(input, "Hello AI");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it("displays AI response in chat", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "Hello user!", updated: false }),
    });

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...");
    const sendButton = screen.getByRole("button", { name: "Send" });

    await user.type(input, "Hello");
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Hello user!")).toBeInTheDocument();
    });
  });

  it("clears input after sending message", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "AI response", updated: false }),
    });

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...") as HTMLInputElement;
    const sendButton = screen.getByRole("button", { name: "Send" });

    await user.type(input, "Hello");
    await user.click(sendButton);

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("calls onRefresh when AI updates board", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "Board updated!", updated: true }),
    });

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...");
    const sendButton = screen.getByRole("button", { name: "Send" });

    await user.type(input, "Add a card");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it("displays error message on failed API call", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...");
    const sendButton = screen.getByRole("button", { name: "Send" });

    await user.type(input, "Hello");
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Error: Server error")).toBeInTheDocument();
    });
  });

  it("disables send button while loading", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockImplementationOnce(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ response: "AI response", updated: false }),
        }), 50);
      })
    );

    render(<ChatSidebar onRefresh={mockOnRefresh} />);
    const input = screen.getByPlaceholderText("Ask the AI...");
    const sendButton = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;

    await user.type(input, "Hello");
    await user.click(sendButton);

    expect(sendButton.disabled).toBe(true);
  });
});
