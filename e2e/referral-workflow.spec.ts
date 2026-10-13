import { expect, test, type Browser, type Page } from "@playwright/test";
import { prisma } from "../src/server/db/prisma";
import { E2E_STAFF_EMAIL, E2E_STAFF2_EMAIL } from "./seed-e2e-users";

/**
 * Task #027 / D-034 — referral + notification + communications E2E.
 *
 * Browser-level verification (scenarios A–M):
 *   A. Owner creates referral links for Staff A and Staff B
 *   B. Visitor opens Staff A's referral link
 *   C. Visitor submits the lead form
 *   D. Lead appears automatically assigned to Staff A
 *   E. Staff A receives a (privacy-safe) notification
 *   F. Staff B cannot access Staff A's lead
 *   G. Owner reassigns the lead to Staff B
 *   H. Original referrer remains Staff A
 *   I. Staff A loses access to private lead details
 *   J. Staff B gains access
 *   K. Revoked/invalid referrals create UNASSIGNED leads
 *   L. Email composer shows its disabled state without a provider
 *   M. Mulberry admin UI loads and works on desktop and mobile viewports
 *
 * Uses the existing local fixture + standalone-server workflow
 * (e2e/global-setup.ts session files). Fixture seeding is guarded by
 * E2E_SEED_USERS=1 + loopback DATABASE_URL in e2e/seed-e2e-users.ts — it can
 * never act against production.
 */

const OWNER_SESSION = "test-results/owner-session.json";
const STAFF1_SESSION = "test-results/staff1-session.json";
const STAFF2_SESSION = "test-results/staff2-session.json";

// Staff B display name (from e2e/seed-e2e-users.ts).
const STAFF_B_NAME = "E2E Colleague Two";

// Unique E2E lead phone numbers (referrals-db tests use the 254721 range).
const REFERRAL_PHONE = "+254733990001"; // Staff A referral lead
const INVALID_REF_PHONE = "+254733990002"; // unknown code
const REVOKED_REF_PHONE = "+254733990003"; // revoked Staff A link

let leadUrl = "";

async function cleanupLead(phone: string) {
  await prisma.notification.deleteMany({ where: { lead: { phone } } });
  await prisma.leadEvent.deleteMany({ where: { lead: { phone } } });
  await prisma.lead.deleteMany({ where: { phone } });
}

async function staffId(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`[e2e] missing fixture user ${email}`);
  return user.id;
}

/** Resolves the (possibly revoked) referral code through the DB. */
async function referralCodeByEmail(email: string): Promise<string> {
  const row = await prisma.referralCode.findUnique({
    where: { userId: await staffId(email) },
    select: { code: true },
  });
  if (!row) throw new Error(`[e2e] missing referral code for ${email}`);
  return row.code;
}

/** Fills and submits the public lead form. */
async function submitLeadForm(
  page: Page,
  phone: string,
  lastName: string,
) {
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name", { exact: false }).fill(lastName);
  await page.getByLabel("Phone").fill(phone);
  await page
    .getByLabel("I am interested in")
    .selectOption({ value: "BUSINESS" });
  await page.getByRole("checkbox", { name: /I consent/ }).check();
  await page.getByRole("button", { name: "Submit My Interest" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Interest registered/ }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Opens a shared page with a specific session file in a new context. */
async function openWithSession(
  browser: Browser,
  session: string,
  path: string,
): Promise<{ page: Page; status: number | null }> {
  const context = await browser.newContext({ storageState: session });
  const page = await context.newPage();
  const response = await page.goto(path);
  return { page, status: response?.status() ?? null };
}

test.describe.configure({ mode: "serial" });

test.describe("Phase R — referral workflow (E2E)", () => {
  test.describe(() => {
    test.use({ storageState: OWNER_SESSION });

    test("A. Owner creates referral links for Staff A and Staff B", async ({
      page,
    }) => {
      await page.goto("/admin/referrals");
      await expect(
        page.getByRole("heading", { name: "Referral links" }),
      ).toBeVisible();

      const rowA = page.locator("li", { hasText: E2E_STAFF_EMAIL });
      const rowB = page.locator("li", { hasText: E2E_STAFF2_EMAIL });

      await rowA.getByLabel(/Public display name|Rota/).fill("E2E Referrals A");
      await rowA.getByRole("button", { name: /Generate link|Rota/ }).click();
      await expect(
        rowA.getByText("Referral link updated for E2E Colleague One."),
      ).toBeVisible({ timeout: 15_000 });
      await expect(rowA.getByText("Active link")).toBeVisible();

      await rowB.getByLabel(/Public display name|Rota/).fill("E2E Referrals B");
      await rowB.getByRole("button", { name: /Generate link|Rota/ }).click();
      await expect(
        rowB.getByText("Referral link updated for E2E Colleague Two."),
      ).toBeVisible({ timeout: 15_000 });
      await expect(rowB.getByText("Active link")).toBeVisible();

      // Codes are opaque, server-resolved, and do not embed a user id.
      const codeA = await referralCodeByEmail(E2E_STAFF_EMAIL);
      expect(codeA).toHaveLength(22);
      expect(codeA).toMatch(/^[A-Za-z0-9]{22}$/);
      expect(codeA).not.toContain(await staffId(E2E_STAFF_EMAIL));

      // Distinct display names between active staff — the ambiguity guard.
      const rowAText = await rowA.textContent();
      const rowBText = await rowB.textContent();
      expect(rowAText).toContain("E2E Referrals A");
      expect(rowBText).toContain("E2E Referrals B");
    });
  });

  test.describe(() => {
    // Anonymous visitor — no admin session.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("B+C. Visitor opens Staff A's referral link and submits the lead form", async ({
      page,
    }) => {
      await cleanupLead(REFERRAL_PHONE);
      const codeA = await referralCodeByEmail(E2E_STAFF_EMAIL);

      // B. The link opens the public entry page with the form present.
      await page.goto(`/business?ref=${codeA}`);
      await expect(
        page.getByRole("heading", { name: /Build a business/ }),
      ).toBeVisible();
      // No referral-code visible content in page text; the code is a hidden field.
      await expect(
        page.locator('input[type=hidden][name=referralCode]'),
      ).toHaveValue(codeA);

      // C. Successful submission.
      await submitLeadForm(page, REFERRAL_PHONE, "ReferralA");

      const stored = await prisma.lead.findFirst({
        where: { phone: REFERRAL_PHONE },
        select: {
          id: true,
          assignedUserId: true,
          referralMethod: true,
          referredBySnapshot: true,
        },
      });
      expect(stored?.assignedUserId).toBeTruthy();
      expect(stored?.referralMethod).toBe("link");
      expect(stored?.referredBySnapshot).toBe("E2E Referrals A");

      leadUrl = `/admin/leads/${stored?.id ?? ""}`;
    });
  });

  test.describe(() => {
    test.use({ storageState: OWNER_SESSION });

    test("D. Lead is automatically assigned to Staff A", async ({
      page,
      browser,
    }) => {
      const staffAId = await staffId(E2E_STAFF_EMAIL);
      const lead = await prisma.lead.findFirst({
        where: { phone: REFERRAL_PHONE },
        select: { id: true },
      });
      expect(lead?.id).toBeTruthy();
      const assigned = await prisma.lead.findUnique({
        where: { id: lead!.id },
        select: { assignedUserId: true },
      });
      expect(assigned?.assignedUserId).toBe(staffAId);

      // Owner sees the assignment on the lead detail page… (scoped to the
      // definition row to avoid the identical text in the Reassign option).
      await page.goto(`/admin/leads/${lead!.id}`);
      await expect(
        page
          .getByRole("definition")
          .filter({ hasText: `E2E Colleague One (${E2E_STAFF_EMAIL})` }),
      ).toBeVisible();

      // …and Staff A sees the lead in "My Contacts".
      const { page: staffPage } = await openWithSession(
        browser,
        STAFF1_SESSION,
        "/admin/leads",
      );
      await expect(staffPage.getByText(REFERRAL_PHONE).first()).toBeVisible();
      await staffPage.context().close();
    });

    test("E. Staff A receives a privacy-safe notification", async ({
      browser,
    }) => {
      const lead = await prisma.lead.findFirst({
        where: { phone: REFERRAL_PHONE },
        select: { id: true },
      });
      const notification = await prisma.notification.findUnique({
        where: { dedupKey: `lead_assigned:${lead!.id}` },
      });
      expect(notification).not.toBeNull();
      // No client PII in title/body (privacy after reassignment).
      const title = notification?.title ?? "";
      const body = notification?.body ?? "";
      expect(title).not.toContain("ReferralA");
      expect(body).not.toContain("ReferralA");
      expect(body).not.toContain(REFERRAL_PHONE);

      // Staff A sees the notification; Staff B sees nothing yet.
      const a = await openWithSession(
        browser,
        STAFF1_SESSION,
        "/admin/notifications",
      );
      await expect(a.page.getByText("New referral contact").first()).toBeVisible();
      await expect(a.page.getByText("ReferralA")).toHaveCount(0);
      await a.page.context().close();

      const b = await openWithSession(
        browser,
        STAFF2_SESSION,
        "/admin/notifications",
      );
      await expect(b.page.getByText("Nothing yet")).toBeVisible();
      await b.page.context().close();
    });

    test("F. Staff B cannot access Staff A's lead (404)", async ({
      browser,
    }) => {
      const result = await openWithSession(browser, STAFF2_SESSION, leadUrl);
      expect(result.status).toBe(404);
      const bodyText = await result.page.textContent("body");
      expect(bodyText).not.toContain("ReferralA");
      expect(bodyText).not.toContain(REFERRAL_PHONE);
      await result.page.context().close();
    });

    test("G. Owner reassigns the lead to Staff B", async ({ page }) => {
      await page.goto(leadUrl);
      await page
        .locator("select[name=assignedUserId]")
        .selectOption({ label: `${STAFF_B_NAME} (${E2E_STAFF2_EMAIL})` });
      await page.getByRole("button", { name: "Save assignment" }).click();
      await expect(
        page.getByText("Lead assigned to E2E Colleague Two."),
      ).toBeVisible({ timeout: 15_000 });

      const stored = await prisma.lead.findFirst({
        where: { phone: REFERRAL_PHONE },
        select: { assignedUserId: true },
      });
      expect(stored?.assignedUserId).toBe(await staffId(E2E_STAFF2_EMAIL));
    });

    test("H. Original referrer remains Staff A after reassignment", async ({
      page,
    }) => {
      await page.goto(leadUrl);
      // Attribution keeps naming Staff A's referral alongside the current
      // Staff B assignment (scoped to the definition rows for strict mode).
      await expect(page.getByText("E2E Referrals A")).toBeVisible();
      await expect(
        page
          .getByRole("definition")
          .filter({ hasText: `E2E Colleague Two (${E2E_STAFF2_EMAIL})` }),
      ).toBeVisible();
    });

    test("I. Staff A loses access to private lead details after reassignment", async ({
      browser,
    }) => {
      const result = await openWithSession(browser, STAFF1_SESSION, leadUrl);
      expect(result.status).toBe(404);
      const bodyText = await result.page.textContent("body");
      expect(bodyText).not.toContain("ReferralA");
      expect(bodyText).not.toContain(REFERRAL_PHONE);
      await result.page.context().close();
    });

    test("J. Staff B gains access to the reassigned lead", async ({
      browser,
    }) => {
      const result = await openWithSession(browser, STAFF2_SESSION, leadUrl);
      expect(result.status).toBe(200);
      await expect(
        result.page.getByRole("heading", { name: "E2E ReferralA" }),
      ).toBeVisible();
      await expect(
        result.page.getByText(REFERRAL_PHONE).first(),
      ).toBeVisible();
      await expect(result.page.getByText("E2E Referrals A")).toBeVisible();
      await result.page.context().close();
    });

    test("K. Revoked and invalid referrals create UNASSIGNED leads", async ({
      page,
    }) => {
      await cleanupLead(INVALID_REF_PHONE);
      await cleanupLead(REVOKED_REF_PHONE);

      // K1 — an unknown code fails safely to the Owner pool.
      await page.goto("/business?ref=notarealcode0001");
      await submitLeadForm(page, INVALID_REF_PHONE, "BadCode");
      const badCodeLead = await prisma.lead.findFirst({
        where: { phone: INVALID_REF_PHONE },
        select: { assignedUserId: true, referralMethod: true },
      });
      expect(badCodeLead?.assignedUserId).toBeNull();
      expect(badCodeLead?.referralMethod).toBeNull();

      // K2 — the Owner revokes Staff A's link; the old link fails safely too.
      await page.goto("/admin/referrals");
      const rowA = page.locator("li", { hasText: E2E_STAFF_EMAIL });
      await rowA.getByRole("button", { name: "Revoke link" }).click();
      await expect(rowA.getByText("Referral link revoked.")).toBeVisible({
        timeout: 15_000,
      });

      const revokedCode = await referralCodeByEmail(E2E_STAFF_EMAIL);
      await page.goto(`/business?ref=${revokedCode}`);
      await submitLeadForm(page, REVOKED_REF_PHONE, "RevokedCode");
      const revokedLead = await prisma.lead.findFirst({
        where: { phone: REVOKED_REF_PHONE },
        select: { assignedUserId: true, referralMethod: true },
      });
      expect(revokedLead?.assignedUserId).toBeNull();
      expect(revokedLead?.referralMethod).toBeNull();
    });

    test("L. Email composer shows its disabled state without a provider", async ({
      page,
    }) => {
      await page.goto(leadUrl);
      await expect(page.getByText(/Sending is disabled/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Send email" }),
      ).toBeDisabled();
    });

    test("M. Mulberry admin UI works on desktop and mobile viewports", async ({
      page,
    }) => {
      // Desktop: mulberry header + sidebar navigation + content.
      await page.goto("/admin/leads");
      await expect(page.locator("header", { hasText: "NEOLIFE" })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "CRM navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "All Contacts" }),
      ).toBeVisible();

      // Mobile: compact shell renders and remains usable.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/leads");
      await expect(page.locator("header", { hasText: "NEOLIFE" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "All Contacts" }),
      ).toBeVisible();
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.afterAll(async () => {
    await cleanupLead(REFERRAL_PHONE);
    await cleanupLead(INVALID_REF_PHONE);
    await cleanupLead(REVOKED_REF_PHONE);
    await prisma.$disconnect();
  });
});
