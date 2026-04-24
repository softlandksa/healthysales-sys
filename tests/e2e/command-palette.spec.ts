import { test, expect } from "@playwright/test";

// These tests assume a logged-in state via storageState (set up in global setup if available)
// Without auth, they test the command palette UI behavior via direct URL with cookies.

test.describe("Command Palette", () => {
  test("Ctrl+K opens command palette", async ({ page }) => {
    // Go to login page (no auth needed for palette UI check)
    await page.goto("/ar/login");

    // The login page won't have the palette, but the dashboard layout has it.
    // We test the route directly with the dashboard (will redirect to login if not authed).
    // For the palette test we verify the button trigger element exists when logged in.
    await page.goto("/ar/dashboard");

    // If not authenticated, we just verify the login page rendered correctly
    const isLoginPage = page.url().includes("/login");
    if (isLoginPage) {
      // Can't test palette without auth — skip gracefully
      test.skip();
      return;
    }

    // Open with Ctrl+K
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3_000 });

    // Search box inside palette
    const searchInput = page.locator("[placeholder*='بحث']").first();
    await expect(searchInput).toBeFocused();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 2_000 });
  });

  test("search trigger button exists on dashboard", async ({ page }) => {
    await page.goto("/ar/dashboard");
    const isLoginPage = page.url().includes("/login");
    if (isLoginPage) { test.skip(); return; }

    // Search button with "بحث" text or Ctrl+K hint
    const searchBtn = page.getByRole("button", { name: /بحث/i });
    await expect(searchBtn).toBeVisible();
  });
});
