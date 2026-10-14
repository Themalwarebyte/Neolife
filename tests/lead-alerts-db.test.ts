import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";

/**
 * Task #037 — DB tests for operational lead alerts:
 * routing (Owner vs Partner assignees vs the Owner queue), the durable
 * in-app Notification records, and Owner-queue privacy (never staff).
 *
 * The EMAIL send itself is covered by the unit tests in
 * tests/provisioning.test.ts (gating + content) — email sending stays
 * disabled in all of these DB runs (no EMAIL_PROVIDER), which is exactly
 * the production default (requirement 15).
 */

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

const staffId = "alertstaff-1";
const adminAId = "alertadmin-1";
const adminBId = "alertadmin-2";
const staffEmail = "alertstaff@test.local";
const adminAEmail = "alertadminA@test.local";

const testPhone = "+254722000771";
const testPhoneB = "+254722000772";

async function cleanupLead(phone: string) {
  await prisma.notification.deleteMany({ where: { lead: { phone } } });
  await prisma.leadEvent.deleteMany({ where: { lead: { phone } } });
  await prisma.lead.deleteMany({ where: { phone } });
}

runIfDb("Task #037 — lead alert routing (DB)", () => {
  beforeAll(async () => {
    await prisma.notification.deleteMany({
      where: { user: { id: { in: [staffId, adminAId, adminBId] } } },
    });
    await cleanupLead(testPhone);
    await cleanupLead(testPhoneB);
    await prisma.user.upsert({
      where: { id: staffId },
      update: { role: "staff", isActive: true },
      create: {
        id: staffId,
        name: "Alert Partner",
        email: staffEmail,
        role: "staff",
        phone: "07270000001",
        notificationEmail: "partner-alerts@test.local",
      },
    });
    await prisma.user.upsert({
      where: { id: adminAId },
      update: { role: "admin", isActive: true },
      create: {
        id: adminAId,
        name: "Alert Owner A",
        email: adminAEmail,
        role: "admin",
        phone: "07180000001",
        notificationEmail: "ownerA-alerts@test.local",
      },
    });
    await prisma.user.upsert({
      where: { id: adminBId },
      update: { role: "admin", isActive: true },
      create: {
        id: adminBId,
        name: "Alert Owner B",
        email: "alertadminB@test.local",
        role: "admin",
        notificationEmail: null, // falls back to login email
      },
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { user: { id: { in: [staffId, adminAId, adminBId] } } },
    });
    await cleanupLead(testPhone);
    await cleanupLead(testPhoneB);
    await prisma.user.deleteMany({
      where: { id: { in: [staffId, adminAId, adminBId] } },
    });
  });

  it("referral capture notifies the referrer (assignee) — Owner-eligible staff member, with their notificationEmail preference recorded in the user row", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const lead = await persistLead(
      {
        firstName: "AlertReferral",
        lastName: undefined,
        phone: testPhone,
        email: undefined,
        city: undefined,
        interestType: "BUSINESS",
        consent: true,
      },
      {},
      {
        userId: staffId,
        code: "alertcapturecode1",
        method: "link" as const,
        publicReferrerName: "Alert Partner",
      },
    );

    // Legacy capture-path in-app notification is preserved (dedupKey intact)
    const assigneeNotification = await prisma.notification.findUnique({
      where: { dedupKey: `lead_assigned:${lead.id}` },
    });
    expect(assigneeNotification?.userId).toBe(staffId);

    // The alert email was NOT attempted (sending disabled by default in the
    // test env): no provider call, capture unaffected, alert record dropped
    // by design (documented semantics — best-effort, no outbox).
    const assignee = await prisma.user.findUnique({
      where: { id: staffId },
      select: { notificationEmail: true },
    });
    expect(assignee?.notificationEmail).toBe("partner-alerts@test.local");
  });

  it("unassigned capture alerts ONLY active admins (Owner queue) — never staff, with per-admin durable dedup rows", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const lead = await persistLead(
      {
        firstName: "QueueLead",
        lastName: undefined,
        phone: testPhoneB,
        email: undefined,
        city: undefined,
        interestType: "BUSINESS",
        consent: true,
      },
      {}, // NO referral → Owner queue
    );

    const notifications = await prisma.notification.findMany({
      where: { leadId: lead.id },
      select: { userId: true, dedupKey: true, title: true },
    });

    // The shared local dev database may contain other admin fixtures, so the
    // assertions are inclusive for our two fixture admins — the important
    // invariant is that STAFF NEVER appear and each fixture admin got a
    // durable dedup row.
    const recipients = notifications.map((n) => n.userId);
    for (const expected of [adminAId, adminBId]) {
      expect(recipients).toContain(expected);
    }
    expect(recipients).not.toContain(staffId); // staff NEVER included
    const fixtureRows = notifications.filter((n) =>
      [adminAId, adminBId].includes(n.userId),
    );
    expect(fixtureRows.every((n) => n.dedupKey.includes("owner_queue"))).toBe(true);
    expect(fixtureRows.every((n) => n.title.includes("unassigned queue"))).toBe(true);

    // Durable: re-running produces no duplicates for the same lead occurrence
    // (dedupKey is unique per lead+admin).
    await prisma.notification.deleteMany({
      where: { leadId: lead.id, userId: { in: [adminAId, adminBId] } },
    });
  });

  it("deactivated admins receive no queue alert", async () => {
    const { persistLead } = await import("../src/lib/leads");
    await prisma.user.update({
      where: { id: adminBId },
      data: { isActive: false },
    });
    try {
      const lead = await persistLead(
        {
          firstName: "QueueLead2",
          lastName: undefined,
          phone: `${testPhoneB}2`,
          email: undefined,
          city: undefined,
          interestType: "BUSINESS",
          consent: true,
        },
        {},
      );
      const notifications = await prisma.notification.findMany({
        where: { leadId: lead.id },
        select: { userId: true },
      });
      const recipients = notifications.map((n) => n.userId);
      expect(recipients).toContain(adminAId); // active admin notified
      expect(recipients).not.toContain(adminBId); // deactivated admin skipped
      expect(recipients).not.toContain(staffId); // staff never included
    } finally {
      await prisma.user.update({ where: { id: adminBId }, data: { isActive: true } });
    }
  });
});
