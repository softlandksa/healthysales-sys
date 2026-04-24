import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),

  use: {
    baseURL:     process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace:       "retain-on-failure",
    screenshot:  "only-on-failure",
    video:       "retain-on-failure",
    locale:      "ar-SA",
    timezoneId:  "Asia/Riyadh",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: process.env.CI
    ? {
        command:  "pnpm start",
        port:     3001,
        timeout:  120_000,
        reuseExistingServer: false,
      }
    : {
        command:  "pnpm dev --port 3001",
        port:     3001,
        timeout:  120_000,
        reuseExistingServer: true,
      },
});
