import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  generateReferralCode,
  resolveReferralByName,
  resolveReferralCode,
} from "../src/lib/referrals";
import { tryNewNotification } from "../src/lib/notifications";

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
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneA, testPhoneB, testPhoneC] } },
    });
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

  it("system initial assignment + immutable attribution + notification are transactional", async () => {
    const { persistLead } = await import("../src/lib/leads");
    const codeRow = await prisma.referralCode.findUnique({ where: { userId: staffId1 } });

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
        ? { userId: staffId1, code: codeRow.code, method: "link" as const }
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
        events: { select: { type: true, metadata: true } },
      },
    });
    expect(stored?.assignedUserId).toBe(staffId1);
    expect(stored?.referredByUserId).toBe(staffId1);
    expect(stored?.referralMethod).toBe("link");
    expect(stored?.referralCapturedAt).not.toBeNull();
    expect(stored?.events.map((e) => e.type)).toContain("lead_assigned");
    expect(stored?.events.map((e) => e.type)).toContain("lead_captured");

    const notification = await prisma.notification.findUnique({
      where: { dedupKey: `lead_assigned:${lead.id}` },
    });
    expect(notification?.userId).toBe(staffId1);
    expect(notification?.readAt).toBeNull();
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
        ? { userId: staffId2, code: codeRow.code, method: "manual_name" as const, typedName: "Betty B" }
        : null,
    );
    const stored = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { referralMethod: true, referredByName: true, assignedUserId: true },
    });
    expect(stored?.referralMethod).toBe("manual_name");
    expect(stored?.referredByName).toBe("Betty B");
    expect(stored?.assignedUserId).toBe(staffId2);
  });
});
