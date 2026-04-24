import type { Page } from "@playwright/test";

export const TEST_USERS = {
  admin:        { email: "admin@test.local",   password: "testpass123" },
  rep:          { email: "rep@test.local",      password: "testpass123" },
  team_manager: { email: "tm@test.local",       password: "testpass123" },
  sales_manager:{ email: "sm@test.local",       password: "testpass123" },
};

export async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];
  await page.goto("/ar/login");
  await page.getByLabel(/البريد الإلكتروني/i).fill(user.email);
  await page.getByLabel(/كلمة المرور/i).fill(user.password);
  await page.getByRole("button", { name: /دخول|تسجيل/i }).click();
  await page.waitForURL(/\/ar\/dashboard/);
}

export async function logout(page: Page) {
  // Open user dropdown and click logout
  await page.getByRole("button", { name: /الحساب الشخصي/i }).click();
  await page.getByRole("menuitem", { name: /تسجيل الخروج/i }).click();
  await page.waitForURL(/\/ar\/login/);
}
