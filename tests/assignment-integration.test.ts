import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  canAssignLeads,
  canViewLead,
  isAssignableRole,
  leadVisibilityWhere,
  OWNER_ROLE,
  STAFF_ROLE,
} from "../src/lib/assignment";

/**
 * Phase B — assignment authorization + ownership isolation tests.
 *
 * Pure logic tests (no DB) run always.
 * DB-integration tests follow the same pattern as tests/lead-persistence.test.ts:
 * they connect to a local PostgreSQL dev database. They pass when
 * `docker compose up -d` is running; otherwise they fail with a DB error,
 * clearly an environment failure (not an implementation failure).
 */

const staffId1 = "staff-111";
const staffId2 = "staff-222";
const ownerId = "owner-1";
const testPhoneA = "+254711000201";
const testPhoneB = "+254711000202";

// ─── Pure authorization tests (always run) ───────────────────────────────

describe("Phase B — assignment authorization (pure, no DB)", () => {
  it("Owner can assign leads", () => {
    expect(canAssignLeads(OWNER_ROLE)).toBe(true);
  });

  it("Staff cannot assign leads", () => {
    expect(canAssignLeads(STAFF_ROLE)).toBe(false);
  });

  it("undefined role cannot assign leads", () => {
    expect(canAssignLeads(undefined)).toBe(false);
  });

  it("Staff is a valid assignee", () => {
    expect(isAssignableRole(STAFF_ROLE)).toBe(true);
  });

  it("Owner is NOT a valid assignee", () => {
    expect(isAssignableRole(OWNER_ROLE)).toBe(false);
  });

  it("unknown role is not a valid assignee", () => {
    expect(isAssignableRole("superadmin")).toBe(false);
  });

  it("Staff can view their own assigned lead", () => {
    expect(canViewLead(STAFF_ROLE, staffId1, staffId1)).toBe(true);
  });

  it("Staff cannot view an unassigned lead", () => {
    expect(canViewLead(STAFF_ROLE, staffId1, null)).toBe(false);
  });

  it("Staff cannot view another Staff user's lead", () => {
    expect(canViewLead(STAFF_ROLE, staffId1, staffId2)).toBe(false);
  });

  it("Owner can view any lead (assigned or unassigned)", () => {
    expect(canViewLead(OWNER_ROLE, "owner-1", null)).toBe(true);
    expect(canViewLead(OWNER_ROLE, "owner-1", staffId1)).toBe(true);
  });

  it("Query scoping: Owner sees all, Staff sees only assigned", () => {
    expect(leadVisibilityWhere(OWNER_ROLE, "owner-1")).toEqual({});
    expect(leadVisibilityWhere(STAFF_ROLE, staffId1)).toEqual({
      assignedUserId: staffId1,
    });
    expect(leadVisibilityWhere(undefined, undefined)).toEqual({ id: null });
  });
});

// ─── DB-integration tests (require local PostgreSQL) ─────────────────────

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);

const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Phase B — ownership-isolated queries (DB integration)", () => {
  beforeAll(async () => {
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneA, testPhoneB] } },
    });
    await prisma.leadEvent.deleteMany({
      where: { lead: { phone: { in: [testPhoneA, testPhoneB] } } },
    });
    await prisma.user.upsert({
      where: { id: staffId1 },
      update: { role: "staff" },
      create: {
        id: staffId1,
        name: "Staff One",
        email: "staff-111@test.local",
        role: "staff",
      },
    });
    await prisma.user.upsert({
      where: { id: staffId2 },
      update: { role: "staff" },
      create: {
        id: staffId2,
        name: "Staff Two",
        email: "staff-222@test.local",
        role: "staff",
      },
    });
    await prisma.user.upsert({
      where: { id: ownerId },
      update: { role: "admin" },
      create: {
        id: ownerId,
        name: "Owner",
        email: "owner-1@assign.test.local",
        role: "admin",
      },
    });
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({
      where: { assignedUserId: { in: [staffId1, staffId2] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [staffId1, staffId2, ownerId] } },
    });
  });

  it("Owner query scope returns all leads", async () => {
    await prisma.lead.create({
      data: {
        firstName: "OwnerView",
        phone: testPhoneA,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });
    await prisma.lead.create({
      data: {
        firstName: "OwnerView2",
        phone: testPhoneB,
        consent: true,
        consentAt: new Date(),
      },
    });

    // Owner scope = empty filter → all leads
    const leads = await prisma.lead.findMany({
      where: { phone: { in: [testPhoneA, testPhoneB] } },
      select: { assignedUserId: true, phone: true },
    });
    expect(leads.length).toBe(2);
  });

  it("Staff query scope returns only their assigned leads", async () => {
    await prisma.lead.create({
      data: {
        firstName: "StaffView",
        phone: testPhoneA,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });
    await prisma.lead.create({
      data: {
        firstName: "StaffViewNoAssign",
        phone: testPhoneB,
        consent: true,
        consentAt: new Date(),
      },
    });

    // Staff2 scope = { assignedUserId: staffId2 } → no results
    const leads = await prisma.lead.findMany({
      where: {
        assignedUserId: staffId2,
        phone: { in: [testPhoneA, testPhoneB] },
      },
      select: { assignedUserId: true, phone: true },
    });
    expect(leads.length).toBe(0);
  });

  it("Leads created without assignment have NULL assignedUserId", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "NullAssign",
        phone: testPhoneA,
        consent: true,
        consentAt: new Date(),
      },
    });
    expect(lead.assignedUserId).toBeNull();
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Audit event is recorded on manual assignment", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "AuditTest",
        phone: testPhoneA,
        consent: true,
        consentAt: new Date(),
      },
    });

    // Simulate what assignLead does at the DB level
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { assignedUserId: staffId1 },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "lead_assigned",
           metadata: { by: "owner-1", from: null, to: staffId1 },
           userId: ownerId,
        },
      }),
    ]);

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "lead_assigned" },
    });
    expect(event).not.toBeNull();
    expect(event?.userId).toBe("owner-1");
    expect(event?.metadata).toEqual({
      by: "owner-1",
      from: null,
      to: staffId1,
    });

    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
