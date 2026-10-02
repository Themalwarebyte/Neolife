import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "node:fs";
import { seedE2EFixtures } from "./seed-e2e-users";

/**
 * Global setup for E2E authentication.
 * Creates shared session files so individual tests don't need to re-authenticate.
 * This avoids intermittent login failures from repeated authentication requests.
 *
 * When `E2E_SEED_USERS=1` (set by playwright.config.ts), the two fixture
 * identities are reset first so their passwords are deterministic and the
 * sign-ins below cannot fail on stale or missing accounts. The seeder refuses
 * to run unless DATABASE_URL points at a local host and NODE_ENV is not
 * "production" — see e2e/seed-e2e-users.ts.
 */
export default async function globalSetup(config: FullConfig) {
  if (process.env.E2E_SEED_USERS === "1") {
    await seedE2EFixtures();
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Ensure test-results directory exists
  const resultsDir = "test-results";
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Create Staff session
  const staffEmail = "colleague1@neolife.local";
  const staffPassword = process.env.STAFF_PASSWORD ?? "dev-staff-password-12345";
  await page.goto(`${baseURL}/admin/login`);
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByLabel("Password").fill(staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/leads$/, { timeout: 15000 });
  await context.storageState({ path: `${resultsDir}/staff1-session.json` });

  // Create Owner session
  const ownerEmail = "office@test.local";
  const ownerPassword = process.env.ADMIN_PASSWORD ?? "owner-password-12345";
  await page.goto(`${baseURL}/admin/login`);
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(ownerPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/leads$/, { timeout: 15000 });
  await context.storageState({ path: `${resultsDir}/owner-session.json` });

  await browser.close();
}
