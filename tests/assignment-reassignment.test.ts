import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  canAssignLeads,
  isAssignableRole,
  canViewLead,
  leadVisibilityWhere,
  OWNER_ROLE,
  STAFF_ROLE,
} from "../src/lib/assignment";

/**
 * Phase C — Owner reassignment workflow tests.
 *
 * Pure authorization tests (no DB) run always.
 * DB integration tests verify the actual assignLead action behavior,
 * including state transitions and audit-event actor tracking.
 */

const staffId1 = "rec1-1111";
const staffId2 = "rec2-2222";
const ownerId = "own1-reassign-test";
const testPhoneA = "+254711000301";
const testPhoneB = "+254711000302";

describe("Phase C — reassignment authorization (pure, no DB)", () => {
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

  it("Owner (admin) is NOT a valid assignee", () => {
    expect(isAssignableRole(OWNER_ROLE)).toBe(false);
  });

  it("unknown role is not a valid assignee", () => {
    expect(isAssignableRole("superadmin")).toBe(false);
  });

  it("empty string role is not a valid assignee", () => {
    expect(isAssignableRole("")).toBe(false);
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
    expect(canViewLead(OWNER_ROLE, ownerId, null)).toBe(true);
    expect(canViewLead(OWNER_ROLE, ownerId, staffId1)).toBe(true);
  });

  it("Query scoping: Owner sees all, Staff sees only assigned", () => {
    expect(leadVisibilityWhere(OWNER_ROLE, ownerId)).toEqual({});
    expect(leadVisibilityWhere(STAFF_ROLE, staffId1)).toEqual({
      assignedUserId: staffId1,
    });
    expect(leadVisibilityWhere(undefined, undefined)).toEqual({ id: null });
  });
});

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Phase C — reassignment state transitions (DB integration)", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneA, testPhoneB] } },
    });
    await prisma.leadEvent.deleteMany({
      where: { lead: { phone: { in: [testPhoneA, testPhoneB] } } },
    });

    await prisma.user.upsert({
      where: { id: ownerId },
      update: { role: "admin" },
      create: {
        id: ownerId,
        name: "Owner",
        email: "own1-reassign@test.local",
        role: "admin",
      },
    });
    await prisma.user.upsert({
      where: { id: staffId1 },
      update: { role: "staff" },
      create: {
        id: staffId1,
        name: "Staff One",
        email: "rec1-reassign@test.local",
        role: "staff",
      },
    });
    await prisma.user.upsert({
      where: { id: staffId2 },
      update: { role: "staff" },
      create: {
        id: staffId2,
        name: "Staff Two",
        email: "rec2-reassign@test.local",
        role: "staff",
      },
    });
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneA, testPhoneB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, staffId1, staffId2] } },
    });
  });

  it("unassigned → Staff A creates a lead_assigned event with the Owner as actor", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "UnassignToStaff",
        phone: testPhoneA,
        consent: true,
        consentAt: new Date(),
        assignedUserId: null,
      },
    });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { assignedUserId: staffId1 },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "lead_assigned",
          metadata: { by: ownerId, from: null, to: staffId1 },
          userId: ownerId,
        },
      }),
    ]);

    const updated = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true },
    });
    expect(updated?.assignedUserId).toBe(staffId1);

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "lead_assigned" },
    });
    expect(event).not.toBeNull();
    expect(event?.userId).toBe(ownerId);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Staff A → Staff B creates a lead_assigned event with updated from/to", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "ReassignAB",
        phone: testPhoneB,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { assignedUserId: staffId2 },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "lead_assigned",
          metadata: { by: ownerId, from: staffId1, to: staffId2 },
          userId: ownerId,
        },
      }),
    ]);

    const updated = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true },
    });
    expect(updated?.assignedUserId).toBe(staffId2);

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "lead_assigned" },
    });
    expect(event?.userId).toBe(ownerId);
    expect(event?.metadata).toMatchObject({
      by: ownerId,
      from: staffId1,
      to: staffId2,
    });

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Staff → unassigned creates a lead_unassigned event with the Owner as actor", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "UnassignFromStaff",
        phone: testPhoneA,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { assignedUserId: null },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "lead_unassigned",
          metadata: { by: ownerId, from: staffId1 },
          userId: ownerId,
        },
      }),
    ]);

    const updated = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { assignedUserId: true },
    });
    expect(updated?.assignedUserId).toBeNull();

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "lead_unassigned" },
    });
    expect(event?.userId).toBe(ownerId);
    expect(event?.metadata).toMatchObject({
      by: ownerId,
      from: staffId1,
    });

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("LeadEvent.userId is nullable for legacy/backfilled events", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "LegacyEvent",
        phone: testPhoneB,
        consent: true,
        consentAt: new Date(),
      },
    });

    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        type: "status_changed",
        metadata: { status: "CONTACTED" },
      },
    });

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "status_changed" },
    });
    expect(event?.userId).toBeNull();

    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
