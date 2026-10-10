import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the local stack: Supabase running (`pnpm db:start`) with the demo data
 * (`pnpm db:reset && pnpm db:seed`; `pnpm test:e2e` does both). The dev server is started if it is not
 * running yet. See README "Tests".
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one database and some change it; run them in order.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "uz-UZ",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
