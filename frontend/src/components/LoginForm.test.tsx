import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";

describe("LoginForm", () => {
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login tab with submit button", () => {
    render(<LoginForm onLogin={mockOnLogin} />);
    // Submit button inside the form (not the tab switcher button)
    const signInButtons = screen.getAllByRole("button", { name: "Sign In" });
    expect(signInButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Sign In and Register tabs", () => {
    render(<LoginForm onLogin={mockOnLogin} />);
    // There are two "Sign In" buttons: tab switcher + form submit
    expect(screen.getAllByRole("button", { name: "Sign In" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
  });

  it("renders text input field on login tab", () => {
    render(<LoginForm onLogin={mockOnLogin} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("switches to register form when Register tab is clicked", async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} />);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("shows password mismatch error on register", async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} />);
    await user.click(screen.getByRole("button", { name: "Register" }));

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "newuser");

    const passwordInputs = document.querySelectorAll("input[type=password]");
    await user.type(passwordInputs[0], "password123");
    await user.type(passwordInputs[1], "different456");

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("shows error for password shorter than 6 characters on register", async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} />);
    await user.click(screen.getByRole("button", { name: "Register" }));

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "newuser");
    const passwordInputs = document.querySelectorAll("input[type=password]");
    await user.type(passwordInputs[0], "abc");
    await user.type(passwordInputs[1], "abc");

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
  });
});
