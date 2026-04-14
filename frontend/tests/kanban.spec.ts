import { expect, test } from "@playwright/test";

// Helper: log in as the default user
async function loginAs(page: any, username = "user", password = "password") {
  await page.goto("/");
  // Wait for the login form to appear (Sign In tab button is present)
  await page.waitForSelector('input[type="text"]');
  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', password);
  // Click the submit button inside the form (not the tab button)
  await page.getByRole("button", { name: "Sign In" }).last().click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await loginAs(page);
});

// ==== Board loading ====

test("loads the kanban board with 5 columns", async ({ page }) => {
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("renders Add Column button", async ({ page }) => {
  await expect(page.getByRole("button", { name: /add column/i })).toBeVisible();
});

// ==== Card operations ====

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("deletes a card with confirmation modal", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  // Add a card to delete
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("To delete");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("To delete")).toBeVisible();

  // Click delete icon — modal should appear
  await firstColumn.getByRole("button", { name: /delete to delete/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Confirm deletion
  await page.getByRole("button", { name: /confirm delete/i }).click();
  await expect(firstColumn.getByText("To delete")).not.toBeVisible();
});

test("cancels card deletion from modal", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Keep me");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Keep me")).toBeVisible();

  await firstColumn.getByRole("button", { name: /delete keep me/i }).click();
  await page.getByRole("button", { name: /cancel delete/i }).click();

  // Card should still be there
  await expect(firstColumn.getByText("Keep me")).toBeVisible();
  // Clean up
  await firstColumn.getByRole("button", { name: /delete keep me/i }).click();
  await page.getByRole("button", { name: /confirm delete/i }).click();
});

test("edits a card title and details", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  // Add a card to edit
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Original Title");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Original Title")).toBeVisible();

  // Open edit modal
  await firstColumn.getByRole("button", { name: /edit original title/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Update title
  await dialog.getByTestId("edit-title").clear();
  await dialog.getByTestId("edit-title").fill("Edited Title");
  await dialog.getByRole("button", { name: /save card/i }).click();

  await expect(firstColumn.getByText("Edited Title")).toBeVisible();
  await expect(firstColumn.getByText("Original Title")).not.toBeVisible();

  // Clean up
  await firstColumn.getByRole("button", { name: /delete edited title/i }).click();
  await page.getByRole("button", { name: /confirm delete/i }).click();
});

// ==== Column operations ====

test("adds a new column", async ({ page }) => {
  const before = await page.locator('[data-testid^="column-"]').count();
  await page.getByRole("button", { name: /add column/i }).click();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(before + 1);
});

test("renames a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const input = firstColumn.getByLabel("Column title");
  await input.clear();
  await input.fill("Renamed Column");
  // Blur to trigger update
  await input.press("Tab");
  await expect(input).toHaveValue("Renamed Column");
});

// ==== Card drag and drop ====

test("moves a card between columns", async ({ page }) => {
  const card = page.locator('[data-testid^="card-card-"]').first();
  const targetColumn = page.locator('[data-testid^="column-col-"]').nth(3);
  const cardTestId = await card.getAttribute("data-testid");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) throw new Error("Unable to resolve drag coordinates.");

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect(targetColumn.locator(`[data-testid="${cardTestId}"]`)).toBeVisible();
});

// ==== Authentication ====

test("logs out and returns to login screen", async ({ page }) => {
  await page.click('button:has-text("Logout")');
  // After logout, the Sign In button should be visible again
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("shows error on wrong password", async ({ page }) => {
  await page.click('button:has-text("Logout")');
  await page.waitForSelector('input[type="text"]');
  await page.fill('input[type="text"]', "user");
  await page.fill('input[type="password"]', "wrongpass");
  await page.getByRole("button", { name: "Sign In" }).last().click();
  // Should not navigate to board
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).not.toBeVisible();
});

// ==== Registration ====

test("shows registration form when Register tab is clicked", async ({ page }) => {
  await page.click('button:has-text("Logout")');
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
});

test("shows error for mismatched passwords on register", async ({ page }) => {
  await page.click('button:has-text("Logout")');
  await page.getByRole("button", { name: "Register" }).click();
  const inputs = await page.getByRole("textbox").all();
  await inputs[0].fill("newuser_test");
  const passwordInputs = await page.locator('input[type="password"]').all();
  await passwordInputs[0].fill("password123");
  await passwordInputs[1].fill("different456");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
});

// ==== Multi-board ====

test("shows board selector with active board name", async ({ page }) => {
  await expect(page.getByTestId("board-selector")).toBeVisible();
});

test("creates a new board from board selector", async ({ page }) => {
  await page.getByTestId("board-selector").click();
  await page.getByLabel("New board name").fill("E2E Test Board");
  await page.getByLabel("Create board").click();
  // Should switch to the new board
  await expect(page.getByTestId("board-selector")).toContainText("E2E Test Board");
});
