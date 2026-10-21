import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  assignUnassignedLeadsBulk,
  completeFollowUpsBulk,
  rescheduleFollowUp,
} from "@/app/admin/(protected)/actions";

const { actor } = vi.hoisted(() => ({ actor: { current: null as null | { id: string; role: string } } }));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => {
    if (!actor.current) throw new Error("UNAUTHENTICATED");
    return actor.current;
  },
  requireAdmin: async () => {
    if (actor.current?.role !== "admin") throw new Error("FORBIDDEN");
    return actor.current;
  },
}));
vi.mock("@/lib/notificationsEmail", () => ({
  notificationRecipientEmail: () => null,
  tryRecordAssignmentNotification: async () => undefined,
  trySendLeadAlertEmail: async () => undefined,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const runIfDb = process.env.DATABASE_URL ? describe : describe.skip;
const owner = { id: "Phase28OwnerAAAAAAAAAAAAAAAAAAA", role: "admin" };
const staffA = { id: "Phase28StaffAAAAAAAAAAAAAAAAAAA", role: "staff" };
const staffB = { id: "Phase28StaffBBBBBBBBBBBBBBBBBBB", role: "staff" };
const inactive = { id: "Phase28StaffInactiveAAAAAAAAA", role: "staff" };
const identities = [owner, staffA, staffB, inactive];
const phones = ["+254711882801", "+254711882802", "+254711882803", "+254711882804"];
let unassignedA = "";
let unassignedB = "";
let assignedA = "";
let assignedB = "";
let followUpA = "";
let followUpB = "";
let otherStaffTask = "";
let noteId = "";
let rescheduledTask = "";
const originalDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
const laterDate = new Date(Date.now() + 5 * 86_400_000).toISOString();

function formData(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach(item => data.append(key, item));
    else data.set(key, value);
  }
  return data;
}

runIfDb("Phase 28 CRM workflow actions (isolated synthetic leads)", () => {
  beforeAll(async () => {
    const stale = await prisma.lead.findMany({
      where: { phone: { in: phones } }, select: { id: true },
    });
    if (stale.length) {
      const ids = stale.map(item => item.id);
      await prisma.leadEvent.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: identities.map(item => item.id) } } });
    for (const identity of identities) {
      await prisma.user.create({ data: {
        ...identity,
        name: identity.id,
        email: `${identity.id.toLowerCase()}@test.local`,
        isActive: identity.id !== inactive.id,
      } });
    }
    const created = [];
    for (let i = 0; i < phones.length; i++) {
      created.push(await prisma.lead.create({ data: {
        firstName: `Phase28Test${i}`, phone: phones[i], consent: true,
        assignedUserId: i === 2 ? staffA.id : i === 3 ? staffB.id : null,
        referredBySnapshot: i === 0 ? "Synthetic referrer" : null,
      } }));
    }
    [unassignedA, unassignedB, assignedA, assignedB] = created.map(item => item.id);
    for (const [leadId, note] of [[assignedA, "test task A"], [assignedA, "test task B"], [assignedB, "test task other"]]) {
      const row = await prisma.followUp.create({ data: { leadId, note, dueAt: new Date(originalDate) } });
      if (note === "test task A") followUpA = row.id;
      else if (note === "test task B") followUpB = row.id;
      else otherStaffTask = row.id;
    }
    noteId = (await prisma.followUp.create({ data: { leadId: assignedA, note: "historical note" } })).id;
    rescheduledTask = (await prisma.followUp.create({ data: {
      leadId: assignedA, note: "reschedule me", dueAt: new Date(originalDate),
    } })).id;
  });
  afterAll(async () => {
    const ids = [unassignedA, unassignedB, assignedA, assignedB].filter(Boolean);
    if (ids.length) {
      await prisma.leadEvent.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: identities.map(item => item.id) } } });
  });

  it("requires an Owner for bulk assignment", async () => {
    actor.current = staffA;
    await expect(assignUnassignedLeadsBulk(null, formData({
      leadIds: [unassignedA], targetUserId: staffA.id,
    }))).rejects.toThrow("FORBIDDEN");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: unassignedA } })).assignedUserId).toBeNull();
  });
  it("rejects inactive assignees without changing leads", async () => {
    actor.current = owner;
    const result = await assignUnassignedLeadsBulk(null, formData({ leadIds: [unassignedA], targetUserId: inactive.id }));
    expect(result.status).toBe("error");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: unassignedA } })).assignedUserId).toBeNull();
  });
  it("refuses to overwrite assigned contacts or partially apply a bulk action", async () => {
    actor.current = owner;
    const result = await assignUnassignedLeadsBulk(null, formData({ leadIds: [unassignedA, assignedB], targetUserId: staffA.id }));
    expect(result.status).toBe("error");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: unassignedA } })).assignedUserId).toBeNull();
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: assignedB } })).assignedUserId).toBe(staffB.id);
  });
  it("assigns selected unassigned contacts with one audit each, preserving referral attribution", async () => {
    actor.current = owner;
    const result = await assignUnassignedLeadsBulk(null, formData({ leadIds: [unassignedA, unassignedB], targetUserId: staffA.id }));
    expect(result.status).toBe("success");
    const updated = await prisma.lead.findMany({ where: { id: { in: [unassignedA, unassignedB] } } });
    expect(updated.every(item => item.assignedUserId === staffA.id)).toBe(true);
    expect(updated.find(item => item.id === unassignedA)?.referredBySnapshot).toBe("Synthetic referrer");
    expect(await prisma.leadEvent.count({ where: {
      leadId: { in: [unassignedA, unassignedB] }, type: "lead_assigned", userId: owner.id,
    } })).toBe(2);
  });
  it("rejects a repeated assignment without duplicate audit rows", async () => {
    actor.current = owner;
    const result = await assignUnassignedLeadsBulk(null, formData({ leadIds: [unassignedA, unassignedB], targetUserId: staffA.id }));
    expect(result.status).toBe("error");
    expect(await prisma.leadEvent.count({ where: {
      leadId: { in: [unassignedA, unassignedB] }, type: "lead_assigned", userId: owner.id,
    } })).toBe(2);
  });
  it("blocks cross-Staff bulk task completion atomically", async () => {
    actor.current = staffA;
    const result = await completeFollowUpsBulk(null, formData({ followUpIds: [followUpA, otherStaffTask] }));
    expect(result.status).toBe("error");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: followUpA } })).completedAt).toBeNull();
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: otherStaffTask } })).completedAt).toBeNull();
  });
  it("never treats a plain CRM note as a scheduled task", async () => {
    actor.current = staffA;
    const result = await completeFollowUpsBulk(null, formData({ followUpIds: [followUpA, noteId] }));
    expect(result.status).toBe("error");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: followUpA } })).completedAt).toBeNull();
  });
  it("reschedules a task with optimistic concurrency and an audit event", async () => {
    actor.current = staffB;
    expect((await rescheduleFollowUp(null, formData({
      followUpId: rescheduledTask, expectedDueAt: originalDate, dueAtIso: laterDate,
    }))).status).toBe("error");
    actor.current = staffA;
    expect((await rescheduleFollowUp(null, formData({
      followUpId: rescheduledTask, expectedDueAt: originalDate, dueAtIso: laterDate,
    }))).status).toBe("success");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: rescheduledTask } })).dueAt?.toISOString()).toBe(laterDate);
    expect(await prisma.leadEvent.count({ where: { leadId: assignedA, type: "follow_up_rescheduled", userId: staffA.id } })).toBe(1);
    expect((await rescheduleFollowUp(null, formData({
      followUpId: rescheduledTask, expectedDueAt: originalDate, dueAtIso: new Date(Date.now() + 8 * 86_400_000).toISOString(),
    }))).status).toBe("error");
    expect(await prisma.leadEvent.count({ where: { leadId: assignedA, type: "follow_up_rescheduled", userId: staffA.id } })).toBe(1);
  });
  it("completes selected tasks once and records exactly two completion events", async () => {
    actor.current = staffA;
    expect((await completeFollowUpsBulk(null, formData({ followUpIds: [followUpA, followUpB] }))).status).toBe("success");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: followUpA } })).completedAt).toBeTruthy();
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: followUpB } })).completedAt).toBeTruthy();
    expect(await prisma.leadEvent.count({ where: { leadId: assignedA, type: "follow_up_completed", userId: staffA.id } })).toBe(2);
    expect((await completeFollowUpsBulk(null, formData({ followUpIds: [followUpA, followUpB] }))).status).toBe("success");
    expect(await prisma.leadEvent.count({ where: { leadId: assignedA, type: "follow_up_completed", userId: staffA.id } })).toBe(2);
  });
});
