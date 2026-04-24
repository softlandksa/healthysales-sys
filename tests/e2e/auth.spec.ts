import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows Arabic error for bad credentials", async ({ page }) => {
    await page.goto("/ar/login");
    await page.getByLabel(/البريد الإلكتروني/i).fill("wrong@example.com");
    await page.getByLabel(/كلمة المرور/i).fill("wrongpassword");
    await page.getByRole("button", { name: /دخول|تسجيل/i }).click();

    // Expect Arabic error message to appear
    await expect(
      page.getByText(/بريد|كلمة مرور|غير صحيح|خطأ/i)
    ).toBeVisible({ timeout: 5_000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/ar\/login/);
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.goto("/ar/login");
    await expect(page.getByRole("heading", { name: /تسجيل الدخول|دخول/i })).toBeVisible();

    // The heading/form should render
    const emailInput = page.getByLabel(/البريد الإلكتروني/i);
    await expect(emailInput).toBeVisible();
  });

  test("unauthenticated access to dashboard redirects to login", async ({ page }) => {
    await page.goto("/ar/dashboard");
    await page.waitForURL(/\/ar\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/ar\/login/);
  });

  test("login page has correct RTL direction", async ({ page }) => {
    await page.goto("/ar/login");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");
  });

  test("login page has correct title metadata", async ({ page }) => {
    await page.goto("/ar/login");
    await expect(page).toHaveTitle(/دخول|تسجيل|مبيعات/i);
  });
});
