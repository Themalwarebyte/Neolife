import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { markQualificationReviewed } from "../src/app/admin/(protected)/actions";

const { caller } = vi.hoisted(() => ({ caller: { current: null as null | { id: string; role: string } } }));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => {
    if (!caller.current) throw new Error("UNAUTHENTICATED");
    return caller.current;
  },
  requireAdmin: async () => { throw new Error("FORBIDDEN"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const runIfDb = process.env.DATABASE_URL ? describe : describe.skip;
const staffA = { id: "Phase27BStaffAAAAAAAAAAAAAAAA", role: "staff" };
const staffB = { id: "Phase27BStaffBBBBBBBBBBBBBBBB", role: "staff" };
const owner = { id: "Phase27BOwnerAAAAAAAAAAAAAAAAA", role: "admin" };
const phones = ["+254711999921", "+254711999922", "+254711999923", "+254711999924"];
let qualifiedA = "";
let qualifiedB = "";
let qualifiedC = "";
let newLead = "";

function form(values: Record<string, string>): FormData {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

runIfDb("qualification review action authorization and audit", () => {
  beforeAll(async () => {
    const oldLeads = await prisma.lead.findMany({ where: { phone: { in: phones } }, select: { id: true } });
    const oldIds = oldLeads.map((lead) => lead.id);
    if (oldIds.length) {
      await prisma.leadEvent.deleteMany({ where: { leadId: { in: oldIds } } });
      await prisma.funnelEvent.deleteMany({ where: { leadId: { in: oldIds } } });
      await prisma.lead.deleteMany({ where: { id: { in: oldIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [staffA.id, staffB.id, owner.id] } } });
    await prisma.user.createMany({ data: [
      { id: staffA.id, name: "Phase27B Staff A", email: "phase27b-staff-a@test.local", role: "staff" },
      { id: staffB.id, name: "Phase27B Staff B", email: "phase27b-staff-b@test.local", role: "staff" },
      { id: owner.id, name: "Phase27B Owner", email: "phase27b-owner@test.local", role: "admin" },
    ] });
    const a = await prisma.lead.create({ data: { firstName: "Review A", phone: phones[0], consent: true, status: "QUALIFIED", assignedUserId: staffA.id, qualificationNotes: "Interested in a meeting" } });
    const b = await prisma.lead.create({ data: { firstName: "Review B", phone: phones[1], consent: true, status: "QUALIFIED", assignedUserId: staffB.id } });
    const c = await prisma.lead.create({ data: { firstName: "Review C", phone: phones[2], consent: true, status: "QUALIFIED", assignedUserId: staffA.id } });
    const d = await prisma.lead.create({ data: { firstName: "Review New", phone: phones[3], consent: true, status: "NEW_LEAD", assignedUserId: staffA.id } });
    qualifiedA = a.id;
    qualifiedB = b.id;
    qualifiedC = c.id;
    newLead = d.id;
  });

  afterAll(async () => {
    const rows = await prisma.lead.findMany({ where: { phone: { in: phones } }, select: { id: true } });
    const ids = rows.map((lead) => lead.id);
    if (ids.length) {
      await prisma.leadEvent.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.funnelEvent.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [staffA.id, staffB.id, owner.id] } } });
  });

  beforeEach(() => { caller.current = null; });

  it("allows staff to review their assigned qualified lead and records the actor", async () => {
    caller.current = staffA;
    const result = await markQualificationReviewed(null, form({ id: qualifiedA }));
    expect(result.status).toBe("success");
    const event = await prisma.leadEvent.findFirstOrThrow({ where: { leadId: qualifiedA, type: "qualification_reviewed" } });
    expect(event.userId).toBe(staffA.id);
    expect(event.metadata).toEqual({ source: "qualification_queue" });
  });

  it("is idempotent when the same qualification is marked reviewed twice", async () => {
    caller.current = staffA;
    expect((await markQualificationReviewed(null, form({ id: qualifiedC }))).status).toBe("success");
    expect((await markQualificationReviewed(null, form({ id: qualifiedC }))).status).toBe("success");
    expect(await prisma.leadEvent.count({ where: { leadId: qualifiedC, type: "qualification_reviewed" } })).toBe(1);
  });

  it("prevents staff from reviewing another staff member's lead", async () => {
    caller.current = staffA;
    expect((await markQualificationReviewed(null, form({ id: qualifiedB }))).status).toBe("error");
    expect(await prisma.leadEvent.count({ where: { leadId: qualifiedB, type: "qualification_reviewed" } })).toBe(0);
  });

  it("refuses to mark an unqualified lead as reviewed", async () => {
    caller.current = staffA;
    expect((await markQualificationReviewed(null, form({ id: newLead }))).status).toBe("error");
    expect(await prisma.leadEvent.count({ where: { leadId: newLead, type: "qualification_reviewed" } })).toBe(0);
  });

  it("allows the Owner to review a qualified lead across assignment boundaries", async () => {
    caller.current = owner;
    expect((await markQualificationReviewed(null, form({ id: qualifiedB }))).status).toBe("success");
    expect(await prisma.leadEvent.count({ where: { leadId: qualifiedB, type: "qualification_reviewed", userId: owner.id } })).toBe(1);
  });
});
