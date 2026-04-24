import { test, expect } from "@playwright/test";

test.describe("Field sales flow (requires auth + seeded data)", () => {
  test("visits new page has customer selector", async ({ page }) => {
    await page.goto("/ar/visits/new");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Should have a customer combobox or select
    const customerField = page.getByLabel(/العميل|اختر عميل/i).first();
    await expect(customerField).toBeVisible({ timeout: 5_000 });
  });

  test("sales new page has items section", async ({ page }) => {
    await page.goto("/ar/sales/new");
    if (page.url().includes("/login")) { test.skip(); return; }

    // Should have product/item section
    const productField = page.getByText(/منتج|المنتج|إضافة/i).first();
    await expect(productField).toBeVisible({ timeout: 5_000 });
  });

  test("collections new page has amount field", async ({ page }) => {
    await page.goto("/ar/collections/new");
    if (page.url().includes("/login")) { test.skip(); return; }

    const amountField = page.getByLabel(/المبلغ|القيمة/i).first();
    await expect(amountField).toBeVisible({ timeout: 5_000 });
  });
});
