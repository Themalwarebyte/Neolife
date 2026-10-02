import { expect, test } from "@playwright/test";
import { E2E_OWNER_EMAIL } from "./seed-e2e-users";

/**
 * Phase P-2 — Admin user management E2E tests.
 *
 * Verifies the complete workflow:
 * 1. Owner logs in, opens Users page, creates a Staff user.
 * 2. New Staff user appears in the list with "Change required" flag.
 * 3. Staff user logs in with temp password.
 * 4. Forced password-change page is shown.
 * 5. Staff cannot bypass the forced change by navigating to CRM directly.
 * 6. Staff changes password and is redirected to CRM.
 * 7. Staff cannot access Owner-only Users management page.
 * 8. Owner can deactivate the Staff user.
 * 9. Deactivated Staff cannot log in.
 * 10. Owner can reactivate the Staff user.
 * 11. Reactivated Staff can sign in with the changed password.
 *
 * Requires: running server + local PostgreSQL with seeded Owner account.
 * The Owner session is created by global-setup.ts.
 */
const testEmail = `e2e-staff-${Date.now()}@neolife.local`;
const tempPassword = "TempPass-123!";
const newPassword = "NewSecurePass-456!";

test.describe.configure({ mode: "serial" });

test("Phase P-2 — Complete admin user management workflow", async ({
  browser,
}) => {
  // Phase 1: Owner creates a Staff user
  const ownerContext = await browser.newContext({
    storageState: "test-results/owner-session.json",
  });
  const ownerPage = await ownerContext.newPage();

  await test.step("Owner opens Users page", async () => {
    await ownerPage.goto("/admin/users");
    await expect(
      ownerPage.getByRole("heading", { name: "Users", exact: true }),
    ).toBeVisible();
  });

  await test.step("Owner creates a new Staff user", async () => {
    await ownerPage.fill('input[name="name"]', "E2E Test Staff");
    await ownerPage.fill('input[name="email"]', testEmail);
    await ownerPage.fill('input[name="password"]', tempPassword);
    await ownerPage.getByRole("button", { name: "Create user" }).click();

    await expect(
      ownerPage.getByText("User created successfully."),
    ).toBeVisible();
    await expect(ownerPage.locator(`text=${testEmail}`)).toBeVisible();
    await expect(
      ownerPage
        .locator("tr", { hasText: testEmail })
        .locator("text=Change required"),
    ).toBeVisible();
  });

  await test.step("Admin accounts are not deactivatable", async () => {
    await ownerPage.goto("/admin/users");
    // Identify the Owner row by its exact email, not by the "Owner" role label.
    // The platform legitimately supports multiple admin accounts, so every
    // admin row renders that label and a text-based role lookup is ambiguous.
    const adminRow = ownerPage.locator("tr", {
      has: ownerPage.getByText(E2E_OWNER_EMAIL, { exact: true }),
    });
    await expect(adminRow).toHaveCount(1);
    await expect(adminRow.locator("button")).toBeDisabled();
  });

  // Phase 2: Staff user signs in with temp password
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();

  await test.step("Staff signs in with temp password and sees forced password change", async () => {
    await staffPage.goto("/admin/login");
    await staffPage.fill('input[name="email"]', testEmail);
    await staffPage.fill('input[name="password"]', tempPassword);
    await staffPage.getByRole("button", { name: "Sign in" }).click();

    await staffPage.waitForURL(/\/admin\/change-password$/);
    await expect(
      staffPage.getByRole("heading", { name: "Change password" }),
    ).toBeVisible();
    await expect(
      staffPage.locator("text=You must change your password"),
    ).toBeVisible();
  });

  await test.step("Staff cannot bypass password change by navigating to CRM directly", async () => {
    await staffPage.goto("/admin/leads");
    await expect(staffPage).toHaveURL(/\/admin\/change-password$/);
  });

  await test.step("Staff changes password", async () => {
    await staffPage.fill('input[name="currentPassword"]', tempPassword);
    await staffPage.fill('input[name="newPassword"]', newPassword);
    await staffPage.fill('input[name="confirmPassword"]', newPassword);
    await staffPage.getByRole("button", { name: "Save new password" }).click();

    await staffPage.waitForURL(/\/admin\/leads$/);
    await expect(
      staffPage.getByRole("heading", { name: "My Contacts" }),
    ).toBeVisible();
  });

  await test.step("Staff cannot access Owner-only Users page", async () => {
    await staffPage.goto("/admin/users");
    await expect(staffPage).toHaveURL(/\/admin\/leads$/);
  });

  await staffContext.close();

  // Phase 3: Owner deactivates the Staff user
  await test.step("Owner deactivates the Staff user", async () => {
    await ownerPage.goto("/admin/users");
    const row = ownerPage.locator("tr", { hasText: testEmail });
    await expect(row.locator("text=Active")).toBeVisible();
    await row.getByRole("button", { name: "Deactivate" }).click();
    await ownerPage.waitForLoadState("networkidle");
    await expect(row.locator("text=Deactivated")).toBeVisible();
  });

  await test.step("Deactivated Staff cannot log in", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await ctx.close();
  });

  // Phase 4: Owner reactivates and Staff signs in with changed password
  await test.step("Owner reactivates the Staff user", async () => {
    await ownerPage.goto("/admin/users");
    const row = ownerPage.locator("tr", { hasText: testEmail });
    await row.getByRole("button", { name: "Activate" }).click();
    await ownerPage.waitForLoadState("networkidle");
    await expect(row.locator("text=Active")).toBeVisible();
  });

  await test.step("Reactivated Staff can sign in with changed password", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/\/admin\/leads$/);
    await expect(
      page.getByRole("heading", { name: "My Contacts" }),
    ).toBeVisible();
    await expect(page.locator("text=Users")).not.toBeVisible();
    await ctx.close();
  });

  // Cleanup: close contexts (test user persists in DB with unique timestamp email)
  await ownerContext.close();
});
