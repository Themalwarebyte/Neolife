import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "node:fs";

/**
 * Global setup for E2E authentication.
 * Creates shared session files so individual tests don't need to re-authenticate.
 * This avoids intermittent login failures from repeated authentication requests.
 */
export default async function globalSetup(config: FullConfig) {
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
