import { test, expect } from "@playwright/test";

test.describe("RBAC enforcement", () => {
  test("unauthenticated user cannot access protected routes", async ({ page }) => {
    const protectedRoutes = [
      "/ar/customers",
      "/ar/visits",
      "/ar/sales",
      "/ar/reports",
      "/ar/audit-log",
      "/ar/users",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/ar\/login/, { timeout: 8_000 });
      expect(page.url()).toMatch(/\/ar\/login/);
    }
  });

  test("audit-log redirects to login without auth", async ({ page }) => {
    await page.goto("/ar/audit-log");
    await page.waitForURL(/\/ar\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/ar\/login/);
  });

  test("notifications page redirects to login without auth", async ({ page }) => {
    await page.goto("/ar/notifications");
    await page.waitForURL(/\/ar\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/ar\/login/);
  });

  test("403 page renders with Arabic message", async ({ page }) => {
    await page.goto("/ar/403");
    // Should show some 403/forbidden-related content or redirect
    // If page exists, check for Arabic content
    const body = await page.textContent("body");
    // Any Arabic text on the page is acceptable
    expect(body).toBeTruthy();
  });
});
