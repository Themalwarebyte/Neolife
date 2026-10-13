import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  findActivePublicNameConflict,
  generateReferralCode,
  normalizePublicName,
  resolveReferralByName,
  resolveReferralCode,
} from "../src/lib/referrals";
import { tryNewNotification } from "../src/lib/notifications";
import { checkClientEmailPermission } from "../src/lib/communications";

/**
 * D-034 — DB-backed referral, auto-assignment and notification tests.
 * Follow the suite convention: skipped unless DATABASE_URL points at a
 * reachable local PostgreSQL (see tests/assignment-integration.test.ts).
 */

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

const staffId1 = "refstaff-111";
const staffId2 = "refstaff-222";
const ownerId = "refowner-1";
const testPhoneA = "+254721000301";
const testPhoneB = "+254721000302";
const testPhoneC = "+254721000303";
const testPhoneD = "+254721000304"; // forced-notification-failure scenario
const testPhoneE = "+254721000305"; // duplicate public-name scenario

/** Cleans every track created by this suite for one phone. */
async function cleanupLead(phone: string) {
  await prisma.leadEvent.deleteMany({
    where: { lead: { phone } },
  });
  await prisma.notification.deleteMany({
    where: { lead: { phone } },
  });
  await prisma.lead.deleteMany({ where: { phone } });
}

runIfDb("D-034 — referral resolution + auto assignment (DB)", () => {
  beforeAll(async () => {
    await prisma.notification.deleteMany({
      where: { user: { id: { in: [staffId1, staffId2] } } },
    });
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneA, testPhoneB, testPhoneC] } },
    });
    await prisma.referralCode.deleteMany({
      where: { userId: { in: [staffId1, staffId2] } },
    });
    await prisma.leadEvent.deleteMany({
      where: { lead: { phone: { in: [testPhoneA, testPhoneB, testPhoneC] } } },
    });
    await prisma.user.upsert({
      where: { id: staffId1 },
      update: { role: "staff", isActive: true },
      create: { id: staffId1, name: "Ref Staff One", email: "refstaff-111@test.local", role: "staff" },
    });
    await prisma.user.upsert({
      where: { id: staffId2 },
      update: { role: "staff", isActive: true },
      create: { id: staffId2, name: "Ref Staff Two", email: "refstaff-222@test.local", role: "staff" },
    });
    await prisma.user.upsert({
      where: { id: ownerId },
      update: { role: "admin" },
      create: { id: ownerId, name: "Ref Owner", email: "refowner-1@test.local", role: "admin" },
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { user: { id: { in: [staffId1, staffId2] } } },
    });
    await cleanupLead(testPhoneA);
    await cleanupLead(testPhoneB);
    await cleanupLead(testPhoneC);
    await cleanupLead(testPhoneD);
    await cleanupLead(testPhoneE);
    await prisma.referralCode.deleteMany({
      where: { userId: { in: [staffId1, staffId2] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [staffId1, staffId2, ownerId] } },
    });
  });

  it("two staff accounts get distinct referral URLs", async () => {
    const code1 = generateReferralCode();
    const code2 = generateReferralCode();
    await prisma.referralCode.create({
      data: { userId: staffId1, code: code1, publicName: "Alice A" },
    });
    await prisma.referralCode.create({
      data: { userId: staffId2, code: code2, publicName: "Betty B" },
    });

    const r1 = await resolveReferralCode(code1);
    const r2 = await resolveReferralCode(code2);
    expect(r1?.userId).toBe(staffId1);
    expect(r2?.userId).toBe(staffId2);
    expect(r1?.code).not.toBe(r2?.code);
  });

  it("each referral code identifies its own referring Staff member", async () => {
    const record = await prisma.referralCode.findUnique({
      where: { userId: staffId1 },
    });
    expect(record).not.toBeNull();
    const resolved = await resolveReferralCode(record!.code);
    expect(resolved?.userId).toBe(staffId1);
    expect(resolved?.publicName).toBe("Alice A");
  });

  it("invalid / unknown / revoked / inactive referrals fail safely to null", async () => {
    expect(await resolveReferralCode("bogus-code-99")).toBeNull(); // unknown
    expect(await resolveReferralCode("bad chars!!")).toBeNull(); // structural junk

    const existing = await prisma.referralCode.findUnique({ where: { userId: staffId1 } });
    const code = existing?.code ?? generateReferralCode();
    await prisma.referralCode.upsert({
      where: { userId: staffId1 },
      update: { code, revokedAt: new Date(), isActive: false },
      create: {
        userId: staffId1,
        code,
        publicName: "Alice A",
        revokedAt: new Date(),
        isActive: false,
      },
    });
    expect(await resolveReferralCode(code)).toBeNull(); // revoked

    await prisma.referralCode.update({
      where: { userId: staffId1 },
      data: { revokedAt: null, isActive: true },
    });
    await prisma.user.update({ where: { id: staffId1 }, data: { isActive: false } });
    expect(await resolveReferralCode(code)).toBeNull(); // inactive staff
    await prisma.user.update({ where: { id: staffId1 }, data: { isActive: true } });
  });

  it("manual fallback resolves an approved public name, only for active staff", async () => {
    const hit = await resolveReferralByName("Betty B");
    expect(hit?.userId).toBe(staffId2);

    expect(await resolveReferralByName("Nobody Realname")).toBeNull();
    expect(await resolveReferralByName("")).toBeNull();

    await prisma.user.update({ where: { id: staffId2 }, data: { isActive: false } });
    expect(await resolveReferralByName("Betty B")).toBeNull();
    await prisma.user.update({ where: { id: staffId2 }, data: { isActive: true } });
  });

  it("successful referral capture persists lead + snapshot + assignment + audit + notification (atomic core)", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const codeRow = await prisma.referralCode.findUnique({ where: { userId: staffId1 } });
    await cleanupLead(testPhoneA);

    const lead = await persistLead(
      {
        firstName: "Referral",
        lastName: undefined,
        phone: testPhoneA,
        email: undefined,
        city: undefined,
        interestType: "BUSINESS",
        consent: true,
      },
      {},
      codeRow
        ? {
            userId: staffId1,
            code: codeRow.code,
            method: "link" as const,
            publicReferrerName: codeRow.publicName,
          }
        : null,
    );

    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: {
        assignedUserId: true,
        referredByUserId: true,
        referralCode: true,
        referralMethod: true,
        referredBySnapshot: true,
        referralCapturedAt: true,
        events: { select: { type: true } },
      },
    });
    expect(stored?.assignedUserId).toBe(staffId1);
    expect(stored?.referredByUserId).toBe(staffId1);
    expect(stored?.referralMethod).toBe("link");
    expect(stored?.referralCapturedAt).not.toBeNull();
    // Task #027 Fix 5 — creation-time APPROVED public referrer snapshot.
    expect(stored?.referredBySnapshot).toBe(codeRow?.publicName);
    expect(stored?.events.map((e) => e.type)).toContain("lead_assigned");
    expect(stored?.events.map((e) => e.type)).toContain("lead_captured");

    const notification = await prisma.notification.findUnique({
      where: { dedupKey: `lead_assigned:${lead.id}` },
    });
    expect(notification?.userId).toBe(staffId1);
    expect(notification?.readAt).toBeNull();
  });

  it("FORCED notification failure: lead + assignment + attribution + audit events persist, capture succeeds, notification stays absent (Task #027)", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const codeRow = await prisma.referralCode.findUnique({ where: { userId: staffId1 } });
    await cleanupLead(testPhoneD);

    // Fail the notification insert — proving it is OUTSIDE the transaction:
    // if it still ran inside, the whole lead write would roll back.
    // NOTE: vi.spyOn + mockRestore is unreliable on Prisma delegate methods
    // (it breaks them permanently in this runtime), so the failure is forced
    // with a manual one-shot stub whose ORIGINAL function reference is
    // restored by reference in a finally block.
    const delegate = prisma.notification as unknown as {
      create: (args: unknown) => unknown;
    };
    const originalCreate = delegate.create;
    delegate.create = () =>
      Promise.reject(new Error("forced notification failure"));

    try {
      const lead = await persistLead(
        {
          firstName: "Failable",
          lastName: undefined,
          phone: testPhoneD,
          email: undefined,
          city: undefined,
          interestType: "BUSINESS",
          consent: true,
        },
        {},
        codeRow
          ? {
              userId: staffId1,
              code: codeRow.code,
              method: "link" as const,
              publicReferrerName: codeRow.publicName,
            }
          : null,
      );
      const stored = await prisma.lead.findUnique({
        where: { id: lead.id },
        select: {
          assignedUserId: true,
          referredByUserId: true,
          referralCode: true,
          referralMethod: true,
          referralCapturedAt: true,
          events: { select: { type: true } },
        },
      });
      expect(stored?.assignedUserId).toBe(staffId1);
      expect(stored?.referredByUserId).toBe(staffId1);
      expect(stored?.referralCode).toBe(codeRow?.code);
      expect(stored?.referralMethod).toBe("link");
      expect(stored?.referralCapturedAt).not.toBeNull();
      expect(stored?.events.map((e) => e.type)).toContain("lead_assigned");
      expect(stored?.events.map((e) => e.type)).toContain("lead_captured");

      // No unauthorized / partial notification row after the forced failure.
      const notifications = await prisma.notification.count({
        where: { leadId: lead.id },
      });
      expect(notifications).toBe(0);
    } finally {
      delegate.create = originalCreate;
    }
  });

  it("notifications carry NO client personal information (privacy after reassignment, Task #027)", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const codeRow = await prisma.referralCode.findUnique({ where: { userId: staffId1 } });

    const lead = await persistLead(
      {
        firstName: "Privacy",
        lastName: "SurnameX",
        phone: testPhoneD,
        email: undefined,
        city: undefined,
        interestType: "BUSINESS",
        consent: true,
      },
      {},
      codeRow
        ? {
            userId: staffId1,
            code: codeRow.code,
            method: "link" as const,
            publicReferrerName: codeRow.publicName,
          }
        : null,
    );

    const notification = await prisma.notification.findUnique({
      where: { dedupKey: `lead_assigned:${lead.id}` },
    });
    expect(notification?.userId).toBe(staffId1);
    expect(notification?.readAt).toBeNull();
    // The body must not expose the client's name, phone or email.
    const body = notification?.body ?? "";
    expect(body).not.toContain("Privacy");
    expect(body).not.toContain("SurnameX");
    expect(body).not.toContain(testPhoneD);
    expect(body).toContain("referral link");
  });

  it("Owner reassignment changes current ownership only — original referral attribution is immutable", async () => {
    const lead = await prisma.lead.findFirst({
      where: { phone: testPhoneA },
      select: { id: true, referralCode: true, referredByUserId: true, referralCapturedAt: true },
    });
    expect(lead).not.toBeNull();

    await prisma.lead.update({
      where: { id: lead!.id },
      data: { assignedUserId: staffId2 },
    });

    const after = await prisma.lead.findUnique({
      where: { id: lead!.id },
      select: { assignedUserId: true, referredByUserId: true, referralCode: true, referralCapturedAt: true },
    });
    expect(after?.assignedUserId).toBe(staffId2); // ownership moved
    expect(after?.referredByUserId).toBe(lead!.referredByUserId); // attribution did NOT
    expect(after?.referralCode).toBe(lead!.referralCode);
    expect(after?.referralCapturedAt).toEqual(lead!.referralCapturedAt);
  });

  it("notification dedupKey prevents duplicate notifications on retry", async () => {
    const lead = await prisma.lead.findFirst({
      where: { phone: testPhoneA },
      select: { id: true },
    });
    const dedupKey = `lead_assigned:${lead!.id}`;

    const first = await tryNewNotification({
      userId: staffId1,
      leadId: lead!.id,
      type: "lead_assigned",
      title: "New referral contact",
      dedupKey,
    });
    expect(first).toBe(false); // already exists from the transactional insert

    const count = await prisma.notification.count({ where: { dedupKey } });
    expect(count).toBe(1);
  });

  it("captures without a referral stay unassigned in the Owner pool", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const lead = await persistLead(
      {
        firstName: "Organic",
        lastName: undefined,
        phone: testPhoneB,
        email: undefined,
        city: undefined,
        interestType: "PRODUCT",
        consent: true,
      },
      {},
      null,
    );
    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true, referredByUserId: true, referralMethod: true },
    });
    expect(stored?.assignedUserId).toBeNull();
    expect(stored?.referredByUserId).toBeNull();
    expect(stored?.referralMethod).toBeNull();
  });

  it("ambiguous public names are REJECTED, never silently matched (Task #027)", async () => {
    const { persistLead } = await import("../src/lib/leads");
    await cleanupLead(testPhoneE);

    // Both staff members expose the SAME approved public name.
    await prisma.referralCode.update({
      where: { userId: staffId1 },
      data: { publicName: "Shared Alias", isActive: true, revokedAt: null },
    });
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: { publicName: "shared alias", isActive: true, revokedAt: null },
    });

    // Ambiguous resolution returns null under both exact and case-insensitive
    // spellings — never first-match.
    expect(await resolveReferralByName("Shared Alias")).toBeNull();
    expect(await resolveReferralByName("shared alias")).toBeNull();

    // A lead captured with the ambiguous name therefore stays unassigned.
    const lead = await persistLead(
      {
        firstName: "Ambiguous",
        lastName: undefined,
        phone: testPhoneE,
        email: undefined,
        city: undefined,
        interestType: "BOTH",
        consent: true,
      },
      {},
      null,
    );
    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true },
    });
    expect(stored?.assignedUserId).toBeNull();

    // Owner duplicate-name guard agrees: a conflict is flagged against BOTH
    // staff users, and each user's own name is not a self-conflict.
    const conflictForStaff1 = await findActivePublicNameConflict(
      "Shared Alias",
      staffId1,
    );
    expect(conflictForStaff1).not.toBeNull();
    expect(conflictForStaff1?.userId).toBe(staffId2);

    // Restore the distinct approved names.
    await prisma.referralCode.update({
      where: { userId: staffId1 },
      data: { publicName: "Alice A" },
    });
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: { publicName: "Betty B" },
    });
  });

  it("Owner duplicate-name guard treats captured candidate conflicts case-insensitively and ignores revoked names", async () => {
    // Revoked duplicate does NOT block reuse (it cannot cause ambiguity).
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: { publicName: "Revoked Alias", revokedAt: new Date(), isActive: false },
    });
    const afterRevoke = await findActivePublicNameConflict("Revoked Alias", staffId1);
    expect(afterRevoke).toBeNull();

    // Restore.
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: { publicName: "Betty B", revokedAt: null, isActive: true },
    });
    const active = await findActivePublicNameConflict("betty b", staffId1);
    expect(active?.userId).toBe(staffId2);
    // Own name is never a self-conflict.
    const selfCheck = await findActivePublicNameConflict("Alice A", staffId1);
    expect(selfCheck).toBeNull();
  });

  it("manual referral names normalize consistently before matching", async () => {
    const resolved = await resolveReferralByName("  Betty      B  ");
    expect(resolved?.userId).toBe(staffId2);
    expect(normalizePublicName("  a   b c ")).toBe("a b c");
    expect(normalizePublicName("a".repeat(61))).toBeNull();
    expect(normalizePublicName("   ")).toBeNull();
  });

  it("outbound email throttle blocks repeated sends and hourly blasts (Task #027)", async () => {
    const lead = await prisma.lead.findFirst({
      where: { phone: testPhoneA },
      select: { id: true },
    });
    expect(lead).not.toBeNull();

    // First send is allowed: no recent email attempt for this lead.
    expect(await checkClientEmailPermission(lead!.id, staffId1)).toEqual({ allowed: true });

    // Record an email attempt NOW → per-lead interval blocks a second send,
    // regardless of which user sends.
    await prisma.leadEvent.create({
      data: {
        leadId: lead!.id,
        type: "communication",
        metadata: { channel: "email", providerStatus: "resend:accepted" },
        userId: staffId1,
      },
    });
    const blocked = await checkClientEmailPermission(lead!.id, staffId2);
    expect(blocked.allowed).toBe(false);

    // Per-sender hourly cap (20) blocks even leads with no recent attempt.
    await prisma.leadEvent.createMany({
      data: Array.from({ length: 20 }, () => ({
        leadId: lead!.id,
        type: "communication" as const,
        metadata: { channel: "email", providerStatus: "resend:accepted" },
        userId: staffId2,
        createdAt: new Date(),
      })),
    });
    const capped = await checkClientEmailPermission(lead!.id, staffId2);
    expect(capped.allowed).toBe(false);

    await prisma.leadEvent.deleteMany({
      where: { leadId: lead!.id, type: "communication" },
    });
  });

  it("manual_name attribution records the typed name", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const codeRow = await prisma.referralCode.findUnique({ where: { userId: staffId2 } });

    const lead = await persistLead(
      {
        firstName: "Manual",
        lastName: undefined,
        phone: testPhoneC,
        email: undefined,
        city: undefined,
        interestType: "BOTH",
        consent: true,
      },
      {},
      codeRow
        ? {
            userId: staffId2,
            code: codeRow.code,
            method: "manual_name" as const,
            typedName: "Betty B",
            publicReferrerName: codeRow.publicName,
          }
        : null,
    );
    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: {
        referralMethod: true,
        referredByName: true,
        referredBySnapshot: true,
        assignedUserId: true,
      },
    });
    expect(stored?.referralMethod).toBe("manual_name");
    // Self-reported spelling (referredByName) is distinct from the APPROVED
    // snapshot (referredBySnapshot) — Task #027 requires the distinction.
    expect(stored?.referredByName).toBe("Betty B");
    expect(stored?.referredBySnapshot).toBe(codeRow?.publicName);
    expect(stored?.assignedUserId).toBe(staffId2);
  });
});
