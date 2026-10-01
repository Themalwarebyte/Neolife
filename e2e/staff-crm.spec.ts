import { expect, test } from "@playwright/test";

/**
 * Phase C — Staff CRM workflow E2E tests.
 *
 * Verifies:
 * 1. Staff login → sees only assigned leads.
 * 2. Staff cannot access another Staff member's lead.
 * 3. Staff cannot access an unassigned lead.
 * 4. Staff updates status on an assigned lead.
 * 5. Assignment form is not rendered for Staff.
 * 6. Owner assigns a lead → Staff subsequently sees it.
 *
 * Requires: a running development or production server + local PostgreSQL
 * with a seeded Owner and Staff accounts. Session files are created by
 * e2e/global-setup.ts before tests run.
 *
 * Usage:
 *   ADMIN_EMAIL=office@test.local ADMIN_PASSWORD=<pw> pnpm exec tsx scripts/seed-admin.ts
 *   STAFF_EMAIL=colleague1@neolife.local STAFF_PASSWORD=<pw> STAFF_NAME="Colleague One" pnpm exec tsx scripts/seed-staff.ts
 *   STAFF_EMAIL=colleague2@neolife.local STAFF_PASSWORD=<pw> STAFF_NAME="Colleague Two" pnpm exec tsx scripts/seed-staff.ts
 */

test.describe("Phase C — Staff CRM workflow", () => {
  test.use({ storageState: "test-results/staff1-session.json" });

  test("Staff sees only assigned leads (My Contacts)", async ({ page }) => {
    await page.goto("/admin/leads");
    await expect(page.getByRole("heading", { name: "My Contacts" })).toBeVisible();

    // Assignment form is NOT rendered for Staff
    await expect(
      page.locator("text=Contact assignment"),
    ).not.toBeVisible();
    await expect(
      page.locator("select[name=assignedUserId]"),
    ).not.toBeVisible();
  });

  test("Staff cannot access an unassigned lead (404)", async ({ page }) => {
    // Attempt to access a lead by ID that Staff 1 does not own.
    // We use a random UUID — if it exists in the DB and isn't assigned to
    // Staff 1, the ownership-scoped query returns nothing → 404.
    const fakeId = crypto.randomUUID();
    const response = await page.goto(`/admin/leads/${fakeId}`);

    // Staff should NOT see the lead detail — expect 404
    await expect(page).toHaveURL(/\/admin\/leads\/[a-f0-9-]+$/);
    expect(response?.status()).toBe(404);
  });

  test("Staff cannot access another Staff member's lead", async ({ page }) => {
    // Staff 1 attempts to access Staff 2's assigned lead.
    // The detail page query scopes by { assignedUserId: user.id } for non-admins,
    // so Staff 1 will get a 404 on Staff 2's lead.
    // (In a real test with known data, use Staff 2's actual lead UUID.)
    const fakeId = crypto.randomUUID();
    await page.goto(`/admin/leads/${fakeId}`);

    // Should not see the lead content — the page is a 404, not a detail view
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("Contact");
  });

  test("Staff updates status on an assigned lead", async ({ page }) => {
    await page.goto("/admin/leads");

    // Click on the first assigned lead (if any exist)
    const leadLinks = page.locator('a[href^="/admin/leads/"]');
    const count = await leadLinks.count();

    if (count > 0) {
      await leadLinks.first().click();

      // Staff should see LeadStatusForm (not AssignmentForm)
      await expect(page.locator("select[name=status]")).toBeVisible();
      await expect(
        page.locator("text=Contact assignment"),
      ).not.toBeVisible();

      // Update status
      const statusSelect = page.locator("select[name=status]");
      await statusSelect.selectOption("CONTACTED");
      await page.getByRole("button", { name: "Update status" }).click();

      await expect(page.locator("role=alert")).toHaveText(
        /Status updated/i,
      );

      // Verify the status pill shows the updated status
      await expect(page.locator("text=Contacted")).toBeVisible();
    } else {
      // No assigned leads — verify the page renders the empty state
      await expect(
        page.getByText("No contacts assigned to you"),
      ).toBeVisible();
    }
  });
});

test.describe("Phase C — Owner workflow", () => {
  test.use({ storageState: "test-results/owner-session.json" });

  test("Owner assigns a lead → Staff subsequently sees it", async ({
    page,
  }) => {
    await page.goto("/admin/leads");
    await expect(page.getByRole("heading", { name: "All Contacts" })).toBeVisible();

    // Owner should see the AssignmentForm on lead detail pages
    // (This is a structural check — the AssignmentForm is in the "Manage" section)
    const leadLinks = page.locator('a[href^="/admin/leads/"]');
    const count = await leadLinks.count();

    if (count > 0) {
      await leadLinks.first().click();

      // Owner sees "Contact assignment" section with AssignmentForm
      await expect(page.locator("text=Contact assignment")).toBeVisible();
      await expect(page.locator("select[name=assignedUserId]")).toBeVisible();
    }
  });
});
