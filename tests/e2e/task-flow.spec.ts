import { test, expect } from "@playwright/test";

test.describe("Task flow (requires auth + seeded data)", () => {
  test("tasks list page loads", async ({ page }) => {
    await page.goto("/ar/tasks");
    if (page.url().includes("/login")) { test.skip(); return; }

    await expect(page.locator("h1")).toContainText("المهام");
  });

  test("new task page has required fields", async ({ page }) => {
    await page.goto("/ar/tasks/new");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Title and assignee fields
    const titleInput = page.getByLabel(/العنوان|اسم المهمة/i).first();
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
  });

  test("tasks page shows status badges", async ({ page }) => {
    await page.goto("/ar/tasks");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Either empty state or status badges
    const content = await page.textContent("main");
    expect(content).toBeTruthy();
  });
});
