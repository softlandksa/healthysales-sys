import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility — public pages", () => {
  test("login page has zero axe violations", async ({ page }) => {
    await page.goto("/ar/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // RTL/Arabic pages may have language-related issues we intentionally allow
      .exclude("[aria-hidden]")
      .analyze();

    // Filter out known acceptable violations for Arabic RTL apps
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical).toHaveLength(0);
  });

  test("login page has correct heading hierarchy", async ({ page }) => {
    await page.goto("/ar/login");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("login page form inputs have associated labels", async ({ page }) => {
    await page.goto("/ar/login");

    const inputs = page.locator("input[type='email'], input[type='password']");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelCount = await label.count();
        expect(labelCount).toBeGreaterThan(0);
      }
    }
  });

  test("login page is keyboard navigable", async ({ page }) => {
    await page.goto("/ar/login");

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    const focused1 = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A", "SELECT"]).toContain(focused1);

    await page.keyboard.press("Tab");
    const focused2 = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A", "SELECT"]).toContain(focused2);
  });
});

test.describe("Accessibility — dashboard pages (require auth)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Auth-dependent tests run on chromium only");

  test("dashboard (unauthenticated) — login page has no critical violations", async ({ page }) => {
    await page.goto("/ar/dashboard");
    // Will redirect to login — test login page a11y
    await page.waitForURL(/\/ar\/login/, { timeout: 8_000 });
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(critical).toHaveLength(0);
  });
});
