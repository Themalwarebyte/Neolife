import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the local production build.
 * Requires: pnpm build && a reachable local PostgreSQL (docker compose up -d).
 *
 * `channel: "chrome"` uses the system-installed Google Chrome so tests can run
 * without downloading a Playwright Chromium build (the download is blocked in
 * this environment). When a Playwright Chromium build is available, the channel
 * can be removed to use the bundled browser.
 *
 * The `webServer` command first runs `e2e/prepare-standalone.mjs`, because
 * `next build` does not copy `.next/static/` or `public/` into
 * `.next/standalone/`. Without that step the standalone server returns HTML with
 * no client JavaScript or CSS and every browser-driven spec fails. See
 * `Dockerfile` for the equivalent production copy.
 */

// Enables the guarded local-only fixture seeder that `e2e/global-setup.ts` runs.
// The seeder still refuses to act unless DATABASE_URL points at a local host and
// NODE_ENV is not "production"; see e2e/seed-e2e-users.ts.
process.env.E2E_SEED_USERS ??= "1";

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  // Ignore nested agent worktree copies. `.kilo/worktrees/**` contains full
  // duplicate checkouts of this project (untracked, gitignored). Without this,
  // Playwright discovers their stale spec files under `e2e/` and fails on their
  // unresolvable imports.
  testIgnore: "**/.kilo/**",
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
    command:
      "node e2e/prepare-standalone.mjs && node .next/standalone/server.js",
    url: "http://localhost:3000",
    // Deliberately false. If anything else already holds port 3000 — for example
    // an `ssh -L 3000:...` tunnel to a remote host — Playwright must fail loudly
    // instead of adopting that service as its test target. With
    // `reuseExistingServer: true` a reachable remote on port 3000 would silently
    // receive the whole E2E suite while results still looked local.
    reuseExistingServer: false,
    timeout: 60_000,
    // Opt out of Better Auth's default sign-in rate limit (3 per 10s/IP) for
    // E2E runs only: the suite performs five sign-ins from one IP within a
    // few seconds (global setup + P-2 workflow), which the production default
    // throttles with 429s. See src/lib/auth.ts. Production is unaffected.
    env: { E2E_DISABLE_AUTH_RATE_LIMIT: "1" },
  },
});
