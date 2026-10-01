import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the local production build.
 * Requires: pnpm build && a reachable local PostgreSQL (docker compose up -d).
 *
 * `channel: "chrome"` uses the system-installed Google Chrome so tests can run
 * without downloading a Playwright Chromium build (the download is blocked in
 * this environment). When a Playwright Chromium build is available, the channel
 * can be removed to use the bundled browser.
 */
export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  timeout: 30_000,
  retries: 2,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "node .next/standalone/server.js",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
    // Opt out of Better Auth's default sign-in rate limit (3 per 10s/IP) for
    // E2E runs only: the suite performs five sign-ins from one IP within a
    // few seconds (global setup + P-2 workflow), which the production default
    // throttles with 429s. See src/lib/auth.ts. Production is unaffected.
    env: { E2E_DISABLE_AUTH_RATE_LIMIT: "1" },
  },
});
