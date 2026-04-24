import { test, expect } from "@playwright/test";

test.describe("Competition flow (requires auth + seeded data)", () => {
  test("competitions list page loads", async ({ page }) => {
    await page.goto("/ar/competitions");
    if (page.url().includes("/login")) { test.skip(); return; }

    await expect(page.locator("h1")).toContainText("المسابقات");
  });

  test("competitions page shows status info", async ({ page }) => {
    await page.goto("/ar/competitions");
    if (page.url().includes("/login")) { test.skip(); return; }

    const content = await page.textContent("main");
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(10);
  });

  test("new competition page accessible for managers", async ({ page }) => {
    await page.goto("/ar/competitions/new");
    if (page.url().includes("/login") || page.url().includes("/dashboard")) {
      test.skip(); return;
    }

    // Should have form with required fields
    const nameInput = page.getByLabel(/اسم المسابقة|العنوان/i).first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
  });
});
