import { test, expect } from "@playwright/test";

test.describe("Reports and export (requires auth)", () => {
  test("reports hub page loads", async ({ page }) => {
    await page.goto("/ar/reports");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Should show report cards
    await expect(page.locator("h1")).toContainText("التقارير");
    const cards = page.locator(".card, [class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });
  });

  test("individual rep report page loads with date filter", async ({ page }) => {
    await page.goto("/ar/reports/rep");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Date range filter should be visible
    const dateInput = page.locator("input[type='date']").first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
  });

  test("export button exists on report page", async ({ page }) => {
    await page.goto("/ar/reports/rep");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Export menu or button
    const exportBtn = page.getByRole("button", { name: /تصدير|Excel|CSV/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 5_000 });
  });

  test("heatmap report loads", async ({ page }) => {
    await page.goto("/ar/reports/heatmap");
    if (page.url().includes("/login")) { test.skip(); return; }

    await expect(page.locator("h1")).toContainText("خريطة");
  });
});
