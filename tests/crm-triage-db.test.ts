import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { buildTriageWhere } from "@/lib/crm-triage";
import { loadTriageQueue, loadTriageTotals } from "@/lib/crm-triage-server";

const runIfDb = process.env.DATABASE_URL ? describe : describe.skip;
const suffix = randomBytes(4).toString("hex");
const staffA = `phase28b-a-${suffix}`;
const staffB = `phase28b-b-${suffix}`;
const owner = { id: `phase28b-owner-${suffix}`, role: "admin" };
const numbers = Array.from({ length: 6 }, (_, i) => `+254701${String(parseInt(suffix.slice(0, 5), 16) % 100000).padStart(5, "0")}${i}`);
const now = new Date();
const offsetDays = (days: number) => new Date(now.getTime() + days * 86_400_000);
const ids: string[] = [];

runIfDb("Phase 28B real database triage scoping", () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: staffA, name: "Synthetic Triage Staff A", email: `${staffA}@test.local`, role: "staff" },
      { id: staffB, name: "Synthetic Triage Staff B", email: `${staffB}@test.local`, role: "staff" },
    ] });
    const specs = [
      { status: "QUALIFIED" as const, assignedUserId: staffA },
      { status: "QUALIFIED" as const, assignedUserId: staffA },
      { status: "CONTACTED" as const, assignedUserId: staffB },
      { status: "NEW_LEAD" as const, assignedUserId: null },
      { status: "CONTACTED" as const, assignedUserId: staffA },
      { status: "CONTACTED" as const, assignedUserId: staffA },
    ];
    for (let i = 0; i < specs.length; i++) {
      const created = await prisma.lead.create({ data: {
        firstName: `Phase28BTriage${i}`, phone: numbers[i], consent: true, ...specs[i],
      }, select: { id: true } });
      ids.push(created.id);
    }
    await prisma.leadEvent.create({ data: { leadId: ids[1], type: "qualification_reviewed", userId: staffA } });
    await prisma.followUp.createMany({ data: [
      { leadId: ids[0], note: "Overdue and future", dueAt: offsetDays(-2) },
      { leadId: ids[0], note: "Also future", dueAt: offsetDays(2) },
      { leadId: ids[2], note: "Other Staff", dueAt: offsetDays(2) },
      { leadId: ids[4], note: "Already completed", dueAt: offsetDays(-2), completedAt: now },
      { leadId: ids[5], note: "Outside seven, inside fourteen", dueAt: offsetDays(10) },
    ] });
  });
  afterAll(async () => {
    if (ids.length) {
      // LeadEvent uses ON DELETE SET NULL: remove only synthetic events first,
      // otherwise the test would leave orphaned audit rows behind.
      await prisma.leadEvent.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [staffA, staffB] } } });
  });

  it("keeps other Staff contacts, Owner-only unassigned leads and completed tasks out of Staff A queue", async () => {
    const viewer = { id: staffA, role: "staff" };
    const result = await loadTriageQueue(viewer, "all", 7, 1, now);
    expect(result.leads.map(row => row.id)).toEqual([ids[0]]);
    expect(result.totals).toEqual({ all: 1, overdue: 1, review: 1, upcoming: 1, unassigned: 0 });
    expect(result.leads[0].reasons).toEqual(["overdue", "review", "upcoming"]);
    expect(result.leads[0].overdueAt?.toISOString()).toBe(offsetDays(-2).toISOString());
    expect(result.leads[0].upcomingAt?.toISOString()).toBe(offsetDays(2).toISOString());
  });
  it("does not reveal unassigned contacts to Staff through forced URL filters", async () => {
    const result = await loadTriageQueue({ id: staffA, role: "staff" }, "unassigned", 7, 1, now);
    expect(result.total).toBe(0);
    expect(result.leads).toEqual([]);
  });
  it("supports adjustable reporting windows without changing any database row", async () => {
    const view = { id: staffA, role: "staff" };
    expect((await loadTriageTotals(view, 7, now)).all).toBe(1);
    const fourteen = await loadTriageQueue(view, "upcoming", 14, 1, now);
    expect(new Set(fourteen.leads.map(row => row.id))).toEqual(new Set([ids[0], ids[5]]));
    expect(fourteen.totals.upcoming).toBe(2);
  });
  it("Owner gets the synthetic unassigned contact and Staff B retains their own only", async () => {
    const staffBResult = await loadTriageQueue({ id: staffB, role: "staff" }, "all", 7, 1, now);
    expect(staffBResult.leads.map(row => row.id)).toEqual([ids[2]]);
    const scopedOwner = await prisma.lead.findMany({ where: {
      AND: [buildTriageWhere(owner, "all", 7, now), { id: { in: ids } }],
    }, select: { id: true } });
    expect(new Set(scopedOwner.map(row => row.id))).toEqual(new Set([ids[0], ids[2], ids[3]]));
    const ownerTotals = await loadTriageTotals(owner, 7, now);
    expect(ownerTotals.unassigned).toBeGreaterThanOrEqual(1);
  });
});
