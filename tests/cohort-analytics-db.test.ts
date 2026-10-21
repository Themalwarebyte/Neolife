import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { loadCohortAnalytics } from "../src/lib/cohort-analytics-server";

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;
const staffA = "cohortstaff00000000000000000001";
const staffB = "cohortstaff00000000000000000002";
const phones = ["+254711002731", "+254711002732"];

async function cleanupFixtures() {
  await prisma.followUp.deleteMany({ where: { lead: { phone: { in: phones } } } });
  await prisma.funnelEvent.deleteMany({ where: { lead: { phone: { in: phones } } } });
  await prisma.lead.deleteMany({ where: { phone: { in: phones } } });
}

runIfDb("Phase 27C cohort analytics database scope", () => {
  let now = new Date();
  let since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    await cleanupFixtures();
    await prisma.user.upsert({
      where: { id: staffA },
      update: { role: "staff", isActive: true },
      create: { id: staffA, name: "Cohort Staff A", email: "cohort-staff-a@test.local", role: "staff" },
    });
    await prisma.user.upsert({
      where: { id: staffB },
      update: { role: "staff", isActive: true },
      create: { id: staffB, name: "Cohort Staff B", email: "cohort-staff-b@test.local", role: "staff" },
    });

    const leadA = await prisma.lead.create({
      data: {
        firstName: "CohortA", phone: phones[0], consent: true, assignedUserId: staffA,
        status: "QUALIFIED", firstTouchSource: "phase27c-test", utmCampaign: "cohort-scope-test",
      },
      select: { id: true },
    });
    const leadB = await prisma.lead.create({
      data: {
        firstName: "CohortB", phone: phones[1], consent: true, assignedUserId: staffB,
        status: "CONVERTED", firstTouchSource: "phase27c-test", utmCampaign: "cohort-scope-test",
      },
      select: { id: true },
    });

    await prisma.funnelEvent.createMany({
      data: [
        { leadId: leadA.id, type: "lead_qualified" },
        { leadId: leadB.id, type: "lead_qualified" },
        { leadId: leadB.id, type: "registration_complete" },
      ],
    });
    await prisma.followUp.createMany({
      data: [
        { leadId: leadA.id, note: "Phase 27C test task A", dueAt: new Date(Date.now() + 60_000), completedAt: new Date() },
        { leadId: leadB.id, note: "Phase 27C test task B", dueAt: new Date(Date.now() + 60_000) },
      ],
    });
    now = new Date();
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  });

  afterAll(async () => {
    await cleanupFixtures();
    await prisma.user.deleteMany({ where: { id: { in: [staffA, staffB] } } });
  });

  it("limits staff cohort and follow-up data to their assigned leads while Owner scope includes both", async () => {
    const staffSummary = await loadCohortAnalytics({ id: staffA, role: "staff" }, "30d", since, now);
    expect(staffSummary.overall.leadsCaptured).toBe(1);
    expect(staffSummary.overall.qualifiedLeads).toBe(1);
    expect(staffSummary.overall.productInterestLeads).toBe(0);
    expect(staffSummary.followUps.scheduledDuringWindow).toBe(1);
    expect(staffSummary.followUps.completedScheduledTasks).toBe(1);

    // The Owner sees all database leads, not just this test's two records.
    // Assert our uniquely labelled fixture cohort instead of assuming a blank test database.
    const ownerSummary = await loadCohortAnalytics({ id: "owner-cohort-test", role: "admin" }, "30d", since, now);
    const fixtureCohort = ownerSummary.sourceRows.find(
      (row) => row.source === "phase27c-test" && row.campaign === "cohort-scope-test",
    );
    expect(fixtureCohort).toMatchObject({
      leadsCaptured: 2,
      qualifiedLeads: 2,
      productInterestLeads: 1,
      currentlyConverted: 1,
    });
    expect(ownerSummary.overall.leadsCaptured).toBeGreaterThanOrEqual(2);
    expect(ownerSummary.overall.qualifiedLeads).toBeGreaterThanOrEqual(2);
    expect(ownerSummary.overall.productInterestLeads).toBeGreaterThanOrEqual(1);
    expect(ownerSummary.followUps.scheduledDuringWindow).toBeGreaterThanOrEqual(2);
    expect(ownerSummary.followUps.completedScheduledTasks).toBeGreaterThanOrEqual(1);

    // A different Staff user must see only the lead assigned to that user.
    const otherStaffSummary = await loadCohortAnalytics({ id: staffB, role: "staff" }, "30d", since, now);
    expect(otherStaffSummary.overall.leadsCaptured).toBe(1);
    expect(otherStaffSummary.overall.qualifiedLeads).toBe(1);
    expect(otherStaffSummary.overall.productInterestLeads).toBe(1);
    expect(otherStaffSummary.overall.currentlyConverted).toBe(1);
    expect(otherStaffSummary.followUps.scheduledDuringWindow).toBe(1);
    expect(otherStaffSummary.followUps.completedScheduledTasks).toBe(0);
  });
});
