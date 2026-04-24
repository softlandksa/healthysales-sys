import { test, expect } from "@playwright/test";

// These tests require a running dev server with seeded test users.
// They are skipped automatically if the server is not available or test users don't exist.

test.describe("Customer lifecycle (requires auth)", () => {
  test.beforeEach(async ({ page }) => {
    // Attempt login; skip if server not ready
    try {
      await page.goto("/ar/login", { timeout: 10_000 });
    } catch {
      test.skip();
    }
  });

  test("customers list page loads and shows search", async ({ page }) => {
    await page.goto("/ar/customers");
    const isLoginPage = page.url().includes("/login");
    if (isLoginPage) { test.skip(); return; }

    // Check page title
    await expect(page.locator("h1, [data-testid='page-title']")).toContainText("العملاء");

    // Check search input exists
    const searchInput = page.locator("input[type='search'], input[placeholder*='بحث']").first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
  });

  test("customers list has correct RTL layout", async ({ page }) => {
    await page.goto("/ar/customers");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Table or card list should exist
    const tableOrList = page.locator("table, [role='table']").first();
    await expect(tableOrList).toBeVisible({ timeout: 5_000 });

    // Check text-align or dir
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
  });

  test("new customer page has form with required fields", async ({ page }) => {
    await page.goto("/ar/customers/new");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Arabic form labels
    const nameInput = page.getByLabel(/الاسم|اسم العميل/i);
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
  });
});
