import { expect, test, type Browser, type Page } from "@playwright/test";
import { prisma } from "../src/server/db/prisma";
import { E2E_STAFF_EMAIL } from "./seed-e2e-users";

/**
 * Task #037 — two-user roles, Owner referral link, Owner-queue notification
 * privacy and external-email-disabled behavior (E2E).
 *
 * Scenarios:
 *   1. Owner generates his OWN personal referral link (referral eligibility
 *      extended to the active Owner); the row displays the "Owner" chip.
 *   2. A visitor captures a lead through the Owner's link → the lead is
 *      auto-assigned to the Owner and the ORIGINAL REFERRER is the Owner.
 *   3. The users page shows the "Partner" display label for Staff accounts
 *      (staff authorization stays `staff` — the label is display only).
 *   4. Unassigned capture → the Owner sees the "unassigned queue"
 *      notification; Staff never get one (D-027 privacy).
 *   5. Staff/anon cannot access Owner-only referral/user management pages.
 *   6. The client-email composer reports its disabled state and cannot send
 *      without a configured provider (requirement 15).
 *
 * Uses the existing local fixture + standalone-server workflow
 * (session files from e2e/global-setup.ts; seeding guarded by
 * E2E_SEED_USERS=1 + loopback DATABASE_URL — never production).
 */

const OWNER_SESSION = "test-results/owner-session.json";
const STAFF1_SESSION = "test-results/staff1-session.json";

// Unique per run so re-runs never hit the duplicate-phone path.
const OWNER_REF_PHONE = `+254736${Date.now().toString().slice(-6).padStart(6, "0")}`;
const QUEUE_PHONE = `+254737${Date.now().toString().slice(-6).padStart(6, "0")}`;

async function ownerUserId(): Promise<string> {
  const owner = await prisma.user.findUnique({
    where: { email: "office@test.local" },
    select: { id: true },
  });
  if (!owner) throw new Error("[e2e] missing owner fixture office@test.local");
  return owner.id;
}

async function cleanupLead(phone: string) {
  await prisma.notification.deleteMany({ where: { lead: { phone } } });
  await prisma.leadEvent.deleteMany({ where: { lead: { phone } } });
  await prisma.lead.deleteMany({ where: { phone } });
}

/** Opens a page with a stored session; or anonymous when session is null. */
async function openWithSession(
  browser: Browser,
  session: string | null,
  path: string,
): Promise<Page> {
  const context =
    session === null
      ? await browser.newContext()
      : await browser.newContext({ storageState: session });
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

test.describe.configure({ mode: "serial" });

test.describe("Task #037 — two-user roles and notifications (E2E)", () => {
  test.describe(() => {
    test.use({ storageState: OWNER_SESSION });

    test("1. Owner generates his own referral link (Owner row with role chip)", async ({
      page,
    }) => {
      await page.goto("/admin/referrals");
      const ownerRow = page.locator("li", { hasText: "office@test.local" });

      // Task #037: the Owner account appears among referral-eligible users.
      await expect(ownerRow).toBeVisible();
      await expect(ownerRow.getByText("Owner", { exact: true })).toBeVisible();

      await ownerRow
        .getByLabel(/Public display name|Rotate link/)
        .fill("E2E Referrals Owner");
      await ownerRow
        .getByRole("button", { name: /Generate link|Rotate link/ })
        .click();
      await expect(
        ownerRow.getByText(/Referral link updated/),
      ).toBeVisible({ timeout: 15_000 });

      // The link-holder really is the OWNER account, active and unrevoked.
      const holder = await prisma.referralCode.findUnique({
        where: { userId: await ownerUserId() },
        select: { code: true, isActive: true, revokedAt: true },
      });
      expect(holder?.code).toMatch(/^[A-Za-z0-9_-]{17,64}$/);
      expect(holder?.isActive).toBe(true);
      expect(holder?.revokedAt).toBeNull();
    });

    test("2. Lead captured via the Owner's link is assigned to the Owner with immutable Owner attribution", async ({
      page,
    }) => {
      const holder = await prisma.referralCode.findUnique({
        where: { userId: await ownerUserId() },
        select: { code: true },
      });
      expect(holder?.code).toBeTruthy();

      await page.goto(`/business?ref=${holder?.code}`);
      await page.getByLabel("First name").fill("E2E");
      await page.getByLabel("Phone").fill(OWNER_REF_PHONE);
      await page
        .getByLabel("I am interested in")
        .selectOption({ value: "BUSINESS" });
      await page.getByRole("checkbox", { name: /I consent/ }).check();
      await page.getByRole("button", { name: "Submit My Interest" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: /Interest registered/ }),
      ).toBeVisible({ timeout: 15_000 });

      const lead = await prisma.lead.findFirst({
        where: { phone: OWNER_REF_PHONE },
        select: {
          id: true,
          assignedUserId: true,
          referredByUserId: true,
          referralMethod: true,
          referredBySnapshot: true,
        },
      });
      const ownerId = await ownerUserId();
      expect(lead?.id).toBeTruthy();
      expect(lead?.assignedUserId).toBe(ownerId); // routed into the Owner's flow
      expect(lead?.referredByUserId).toBe(ownerId); // original referrer = Owner
      expect(lead?.referralMethod).toBe("link");
      expect(lead?.referredBySnapshot).toBe("E2E Referrals Owner");
    });

    test("3. Users page shows the Partner display label for Staff accounts", async ({
      page,
    }) => {
      await page.goto("/admin/users");
      const staffRow = page.locator("tr", { hasText: E2E_STAFF_EMAIL });
      await expect(staffRow).toBeVisible();
      // Display label only — the underlying authorization role is unchanged.
      await expect(staffRow.getByText("Partner", { exact: true })).toBeVisible();
    });
  });

  test("4. Unassigned capture: Owner sees the queue notification, Staff never does", async ({
    browser,
  }) => {
    // Anonymous visitor — no referral → the unassigned Owner queue.
    const visitorPage = await openWithSession(browser, null, "/business");
    await visitorPage.getByLabel("First name").fill("E2E");
    await visitorPage.getByLabel("Phone").fill(QUEUE_PHONE);
    await visitorPage
      .getByLabel("I am interested in")
      .selectOption({ value: "BUSINESS" });
    await visitorPage.getByRole("checkbox", { name: /I consent/ }).check();
    await visitorPage.getByRole("button", { name: "Submit My Interest" }).click();
    await expect(
      visitorPage.getByRole("status").filter({ hasText: /Interest registered/ }),
    ).toBeVisible({ timeout: 15_000 });
    await visitorPage.context().close();

    const queueLead = await prisma.lead.findFirst({
      where: { phone: QUEUE_PHONE },
      select: { id: true },
    });
    const queueLeadId = queueLead?.id ?? "";
    expect(queueLeadId).toBeTruthy();

    // OWNER: the durable queue notification is present in the CRM.
    const ownerPage = await openWithSession(browser, OWNER_SESSION, "/admin/notifications");
    await expect(
      ownerPage.getByText(/New lead in the unassigned queue/).first(),
    ).toBeVisible({ timeout: 15_000 });
    await ownerPage.context().close();

    // Data-level guarantee: NO queue notification row exists for the staff
    // user (authorization-scoped verification, D-027).
    const staffNotifications = await prisma.notification.findMany({
      where: { user: { email: E2E_STAFF_EMAIL }, leadId: queueLeadId },
      select: { id: true },
    });
    expect(staffNotifications).toHaveLength(0);
  });

  test("5. Owner-only pages reject anonymous and Staff access", async ({
    browser,
  }) => {
    // Anonymous → redirected to login.
    const anonPage = await openWithSession(browser, null, "/admin/referrals");
    expect(anonPage.url()).toContain("/admin/login");
    await anonPage.context().close();

    // Staff → requireAdmin() redirects away from referral/user management.
    const staffReferrals = await openWithSession(
      browser,
      STAFF1_SESSION,
      "/admin/referrals",
    );
    expect(staffReferrals.url()).not.toContain("/admin/referrals");
    await staffReferrals.context().close();

    const staffUsers = await openWithSession(browser, STAFF1_SESSION, "/admin/users");
    expect(staffUsers.url()).not.toContain("/admin/users");
    await staffUsers.context().close();
  });

  test("6. Client-email composer reports its disabled state (requirement 15)", async ({
    browser,
  }) => {
    const queueLead = await prisma.lead.findFirst({
      where: { phone: QUEUE_PHONE },
      select: { id: true },
    });
    const ownerDetail = await openWithSession(
      browser,
      OWNER_SESSION,
      `/admin/leads/${queueLead?.id}`,
    );

    // Task #027 already covers this banner; re-asserted here as the Task
    // #037 delivery-state check: without a configured provider, sending is
    // visibly disabled and the send button cannot fire.
    await expect(
      ownerDetail.getByText(
        /Sending is disabled: the email provider is not configured yet/,
      ),
    ).toBeVisible();
    await expect(ownerDetail.getByRole("button", { name: "Send email" })).toBeDisabled();
    await ownerDetail.context().close();
  });

  test.afterAll(async () => {
    await cleanupLead(OWNER_REF_PHONE);
    await cleanupLead(QUEUE_PHONE);
  });
});
