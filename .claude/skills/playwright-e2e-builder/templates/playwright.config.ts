import { defineConfig, devices } from "@playwright/test";

// E2E config for a MiniServer web-app (Next.js + Prisma + SQLite).
// Auth: apps are gated by Authentik forward-auth at Traefik — locally/CI there is no gate,
// so the app runs OPEN at the app layer and most tests need no auth. There is NO in-app login form.
// Test DB: a throwaway SQLite file; global-setup migrates + seeds it before the run.
const TEST_DB = process.env.DATABASE_URL ?? "file:./e2e/.test.db";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },

    // For an app that does in-app authorization by reading X-authentik-* headers
    // (no living example yet), simulate a logged-in user by injecting the headers.
    // NEVER script Authentik's login UI. Uncomment + adapt when needed:
    // {
    //   name: "authenticated",
    //   use: {
    //     ...devices["Desktop Chrome"],
    //     extraHTTPHeaders: {
    //       "X-authentik-email": "test@example.com",
    //       "X-authentik-username": "tester",
    //       "X-authentik-groups": "todo-access",
    //     },
    //   },
    // },
  ],

  // Start the real dev server against the TEST database, not the dev/prod data.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATABASE_URL: TEST_DB },
  },
});
