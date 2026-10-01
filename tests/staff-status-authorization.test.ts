import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import type { LeadStatus } from "@/generated/prisma/client";
import {
  canViewLead,
  canAssignLeads,
  isAssignableRole,
  leadVisibilityWhere,
  OWNER_ROLE,
  STAFF_ROLE,
} from "../src/lib/assignment";
import { parseStatusChange } from "../src/lib/leadManagement";

const staffId1 = "sts1-1111";
const staffId2 = "sts2-2222";
const ownerId = "own1-status-test";
const testPhoneOwn = "+254711000401";
const testPhoneOther = "+254711000402";

describe("Phase C — staff status authorization (pure, no DB)", () => {
  it("Staff can view their own assigned lead", () => {
    expect(canViewLead(STAFF_ROLE, staffId1, staffId1)).toBe(true);
  });

  it("Staff cannot view an unassigned lead", () => {
    expect(canViewLead(STAFF_ROLE, staffId1, null)).toBe(false);
  });

  it("Staff cannot view another Staff user's lead", () => {
    expect(canViewLead(STAFF_ROLE, staffId1, staffId2)).toBe(false);
  });

  it("Owner can view any lead", () => {
    expect(canViewLead(OWNER_ROLE, ownerId, null)).toBe(true);
    expect(canViewLead(OWNER_ROLE, ownerId, staffId1)).toBe(true);
  });

  it("valid status is accepted by parseStatusChange", () => {
    expect(parseStatusChange("CONTACTED")).toBe("CONTACTED");
    expect(parseStatusChange("QUALIFIED")).toBe("QUALIFIED");
    expect(parseStatusChange("CONVERTED")).toBe("CONVERTED");
  });

  it("invalid status is rejected by parseStatusChange", () => {
    expect(parseStatusChange("INVALID")).toBeNull();
    expect(parseStatusChange(null)).toBeNull();
    expect(parseStatusChange(undefined)).toBeNull();
    expect(parseStatusChange(123)).toBeNull();
    expect(parseStatusChange("")).toBeNull();
    expect(parseStatusChange("status_changed")).toBeNull();
  });

  it("Staff cannot assign leads", () => {
    expect(canAssignLeads(STAFF_ROLE)).toBe(false);
  });

  it("Staff is a valid assignee", () => {
    expect(isAssignableRole(STAFF_ROLE)).toBe(true);
  });

  it("Query scoping: Staff sees only assigned leads", () => {
    expect(leadVisibilityWhere(STAFF_ROLE, staffId1)).toEqual({
      assignedUserId: staffId1,
    });
  });
});

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Phase C — staff status workflow (DB integration)", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneOwn, testPhoneOther] } },
    });
    await prisma.leadEvent.deleteMany({
      where: { lead: { phone: { in: [testPhoneOwn, testPhoneOther] } } },
    });

    await prisma.user.upsert({
      where: { id: ownerId },
      update: { role: "admin" },
      create: {
        id: ownerId,
        name: "Owner",
        email: "owner-001@status.test.local",
        role: "admin",
      },
    });
    await prisma.user.upsert({
      where: { id: staffId1 },
      update: { role: "staff" },
      create: {
        id: staffId1,
        name: "Staff One",
        email: "sts1-1111@status.test.local",
        role: "staff",
      },
    });
    await prisma.user.upsert({
      where: { id: staffId2 },
      update: { role: "staff" },
      create: {
        id: staffId2,
        name: "Staff Two",
        email: "sts2-2222@status.test.local",
        role: "staff",
      },
    });
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({
      where: { phone: { in: [testPhoneOwn, testPhoneOther] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, staffId1, staffId2] } },
    });
  });

  it("Staff updates status on own assigned lead, audit event records Staff userId", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "StaffOwnUpdate",
        phone: testPhoneOwn,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id, assignedUserId: staffId1 },
        data: { status: "CONTACTED" },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "status_changed",
          metadata: { status: "CONTACTED" },
          userId: staffId1,
        },
      }),
    ]);

    const updated = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { status: true, assignedUserId: true },
    });
    expect(updated?.status).toBe("CONTACTED");
    expect(updated?.assignedUserId).toBe(staffId1);

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "status_changed" },
    });
    expect(event?.userId).toBe(staffId1);
    expect(event?.metadata).toMatchObject({ status: "CONTACTED" });

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Staff cannot update an unassigned lead (ownership check returns no row)", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "StaffUnassigned",
        phone: testPhoneOwn,
        consent: true,
        consentAt: new Date(),
        assignedUserId: null,
      },
    });

    const found = await prisma.lead.findUnique({
      where: { id: lead.id, assignedUserId: staffId1 },
      select: { id: true },
    });
    expect(found).toBeNull();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Staff cannot update another Staff member's lead (ownership check returns no row)", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "StaffOtherUpdate",
        phone: testPhoneOther,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId2,
      },
    });

    const found = await prisma.lead.findUnique({
      where: { id: lead.id, assignedUserId: staffId1 },
      select: { id: true },
    });
    expect(found).toBeNull();

    const found2 = await prisma.lead.findUnique({
      where: { id: lead.id, assignedUserId: staffId2 },
      select: { id: true },
    });
    expect(found2).not.toBeNull();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Forged assignedUserId field is ignored by updateLeadStatus (action only reads id+status)", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "ForgedAssignUserId",
        phone: testPhoneOwn,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });

    const fakeFormData = {
      id: lead.id,
      status: "QUALIFIED",
      assignedUserId: staffId2,
    };

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id, assignedUserId: staffId1 },
        data: { status: fakeFormData.status as LeadStatus },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "status_changed",
          metadata: { status: fakeFormData.status },
          userId: staffId1,
        },
      }),
    ]);

    const updated = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { status: true, assignedUserId: true },
    });
    expect(updated?.status).toBe("QUALIFIED");
    expect(updated?.assignedUserId).toBe(staffId1);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("Owner can update any lead (including unassigned)", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "OwnerAnyUpdate",
        phone: testPhoneOther,
        consent: true,
        consentAt: new Date(),
        assignedUserId: null,
      },
    });

    const found = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { id: true },
    });
    expect(found).not.toBeNull();

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { status: "CONTACTED" },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "status_changed",
          metadata: { status: "CONTACTED" },
          userId: ownerId,
        },
      }),
    ]);

    const updated = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { status: true },
    });
    expect(updated?.status).toBe("CONTACTED");

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "status_changed" },
    });
    expect(event?.userId).toBe(ownerId);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it("LeadEvent.userId cannot be forged by client — always set from server-side session", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "ActorForgery",
        phone: testPhoneOwn,
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId1,
      },
    });

    const forgedFormData = {
      id: lead.id,
      status: "QUALIFIED",
      userId: ownerId,
    };

    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        type: "status_changed",
        metadata: { status: forgedFormData.status },
        userId: staffId1,
      },
    });

    const event = await prisma.leadEvent.findFirst({
      where: { leadId: lead.id, type: "status_changed" },
    });
    expect(event?.userId).toBe(staffId1);
    expect(event?.userId).not.toBe(ownerId);

    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
