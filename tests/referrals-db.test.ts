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
import {
  reserveClientEmailSend,
  finalizeClientEmailReservation,
  classifySendOutcome,
} from "../src/lib/communications";

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
      // Storage stores the NORMALIZED equality key alongside the display
      // name (Task #029, Fix 2) — as the Owner action path does.
      data: {
        userId: staffId1,
        code: code1,
        publicName: "Alice A",
        publicNameNormal: "alice a",
      },
    });
    await prisma.referralCode.create({
      data: {
        userId: staffId2,
        code: code2,
        publicName: "Betty B",
        publicNameNormal: "betty b",
      },
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

  it("equivalent names are structurally impossible among active staff; ambiguous states are inert (Task #029 Fix 2)", async () => {
    const { persistLead } = await import("../src/lib/leads");
    await cleanupLead(testPhoneE);

    // Register the name normally for Staff 1 (same path the Owner action
    // takes: normalized display value + lower-cased equality key).
    await prisma.referralCode.update({
      where: { userId: staffId1 },
      data: {
        publicName: "Shared Alias",
        publicNameNormal: "shared alias",
        isActive: true,
        revokedAt: null,
      },
    });

    // A second Staff member CANNOT register an equivalent active name — not
    // even through direct writes: the unique constraint on publicNameNormal
    // enforces the duplicate-name rule race-safe at the database level (this
    // is exactly the "simultaneous conflicting registrations" scenario).
    await expect(
      prisma.referralCode.update({
        where: { userId: staffId2 },
        data: {
          publicName: "shared alias",
          publicNameNormal: "shared alias",
          isActive: true,
          revokedAt: null,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    // Resolution of the name therefore matches EXACTLY the one registered
    // staff member — case- and whitespace-independently.
    const exact = await resolveReferralByName("Shared Alias");
    expect(exact?.userId).toBe(staffId1);
    expect((await resolveReferralByName("shared  ALIAS"))?.userId).toBe(staffId1);

    // The Owner duplicate-name guard agrees: a genuinely registered name
    // conflicts against OTHER staff (never self), while the name registered
    // only for Staff 1 does not conflict for Staff 2 (their registration was
    // rejected, so no equivalent active name exists for them).
    const conflictForStaff1 = await findActivePublicNameConflict(
      "shared alias",
      staffId1,
    );
    expect(conflictForStaff1).toBeNull();
    const conflictForStaff1OnBetty = await findActivePublicNameConflict(
      "Betty B",
      staffId1,
    );
    expect(conflictForStaff1OnBetty?.userId).toBe(staffId2);

    // A lead typed before any registration stays unassigned (fail-safe pool).
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
      null, // "Nobody Realname" fails resolution — fail-safe to the Owner pool.
    );
    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true },
    });
    expect(stored?.assignedUserId).toBeNull();

    // Restore the distinct approved names (key + display together).
    await prisma.referralCode.update({
      where: { userId: staffId1 },
      data: { publicName: "Alice A", publicNameNormal: "alice a" },
    });
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: { publicName: "Betty B", publicNameNormal: "betty b" },
    });
  });

  it("Owner duplicate-name guard treats captured candidate conflicts case-insensitively and ignores revoked names", async () => {
    // Revoked duplicate does NOT block reuse (it cannot cause ambiguity) —
    // the revoke path clears the normalized key, mirroring the Owner action.
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: {
        publicName: "Revoked Alias",
        publicNameNormal: null,
        revokedAt: new Date(),
        isActive: false,
      },
    });
    const afterRevoke = await findActivePublicNameConflict("Revoked Alias", staffId1);
    expect(afterRevoke).toBeNull();

    // Restore.
    await prisma.referralCode.update({
      where: { userId: staffId2 },
      data: {
        publicName: "Betty B",
        publicNameNormal: "betty b",
        revokedAt: null,
        isActive: true,
      },
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

  it("audit actor integrity: system assignment event has NULL actor, correct target and attribution (Task #029 Fix 1, D-028/D-034)", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const codeRow = await prisma.referralCode.findUnique({ where: { userId: staffId1 } });

    const lead = await persistLead(
      {
        firstName: "Actor",
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
          }          : null,
    );

    const events = await prisma.leadEvent.findMany({
      where: { leadId: lead.id, type: "lead_assigned" },
      select: { userId: true, metadata: true },
    });
    expect(events).toHaveLength(1);
    const systemEvent = events[0]!;
    // D-028: canonical actor is NULL — no authenticated CRM user performed a
    // system referral assignment. The assignee lives ONLY in metadata.to.
    expect(systemEvent.userId).toBeNull();
    expect(systemEvent.metadata).toMatchObject({
      by: "system",
      systemReason: "referral",
      to: staffId1,
      referralCode: codeRow?.code,
    });

    // D-034: assignee + original attribution both remain the referring staff.
    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true, referredByUserId: true },
    });
    expect(stored?.assignedUserId).toBe(staffId1);
    expect(stored?.referredByUserId).toBe(staffId1);
  });

  it("outbound email throttle: reservation blocks repeated sends and hourly blasts (Task #029 Fix 4)", async () => {
    const lead = await prisma.lead.findFirst({
      where: { phone: testPhoneA },
      select: { id: true },
    });
    expect(lead).not.toBeNull();

    // First send is allowed: no recent reservation for this lead.
    const first = await reserveClientEmailSend(lead!.id, staffId1);
    expect(first.allowed).toBe(true);

    // A reservation inserted BEFORE the provider call blocks a second claim —
    // regardless of which sender uses the lead or which status latches later.
    const second = await reserveClientEmailSend(lead!.id, staffId2);
    expect(second.allowed).toBe(false);

    // Per-sender hourly cap (20) blocks even leads with no recent attempt.
    // staffId2 already used 0 slots this hour in this test run.
    const filler = await prisma.emailSendReservation.createMany({
      data: Array.from({ length: 20 }, () => ({
        leadId: lead!.id,
        userId: staffId2,
        status: "accepted" as const,
      })),
    });
    expect(filler.count).toBe(20);
    const capped = await reserveClientEmailSend(lead!.id, staffId2);
    expect(capped.allowed).toBe(false);

    // Conservative counting: "unknown" and "failed" reservations keep
    // counting. Pending "reserved" rows likewise never reopen the limit.
    expect(classifySendOutcome("resend", { ok: false, error: "resend_http_500:oops" })).toBe("unknown");
    expect(classifySendOutcome("resend", { ok: false, error: "resend_http_422:bad" })).toBe("failed");
    expect(classifySendOutcome("resend", { ok: true })).toBe("accepted");
    expect(classifySendOutcome("local", { ok: true })).toBe("simulated");
    expect(classifySendOutcome("local", { ok: false })).toBe("failed");

    // Finalization latches the status independently of the CRM audit trail.
    const latched = await finalizeClientEmailReservation(
      (first as { reservationId: string }).reservationId,
      "accepted",
    );
    expect(latched).toBe(1);
    const row = await prisma.emailSendReservation.findUnique({
      where: { id: (first as { reservationId: string }).reservationId },
      select: { status: true },
    });
    expect(row?.status).toBe("accepted");

    // Cleanup: remove this test's reservations.
    await prisma.emailSendReservation.deleteMany({ where: { leadId: lead!.id } });

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
