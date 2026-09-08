/**
 * Task 1.2 data-layer smoke test (local dev only).
 * Creates, reads, updates, and cleans up MVP records to verify the data layer.
 * Run: $env:DATABASE_URL='...'; pnpm exec tsx scripts/smoke.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`SMOKE TEST FAILED: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main(): Promise<void> {
  // 1. Create a lead with attribution + consent record/timestamp
  const lead = await prisma.lead.create({
    data: {
      firstName: "Smoke",
      lastName: "Test",
      phone: "+254700000000",
      email: "smoke@test.local",
      city: "Nairobi",
      interestType: "BUSINESS",
      consent: true,
      consentAt: new Date(),
      utmSource: "meta",
      utmMedium: "cpc",
      utmCampaign: "mvp_test",
      utmContent: "creative_a",
      utmTerm: "business_opportunity",
      landingPage: "/business",
      firstTouchSource: "meta",
    },
  });
  assert(Boolean(lead.id), "lead created");
  assert(lead.status === "NEW_LEAD", "lead defaults to NEW_LEAD");

  // 2. Funnel event (first-party)
  const event = await prisma.leadEvent.create({
    data: {
      leadId: lead.id,
      type: "lead_created",
      metadata: { test: true },
    },
  });
  assert(Boolean(event.id), "lead event created");

  // 3. Office pipeline: meeting request -> scheduled
  const meeting = await prisma.meeting.create({
    data: {
      leadId: lead.id,
      scheduledAt: new Date(Date.now() + 86_400_000),
      notes: "Smoke test meeting",
    },
  });
  assert(meeting.status === "SCHEDULED", "meeting defaults to SCHEDULED");

  // 4. Follow-up note
  const followUp = await prisma.followUp.create({
    data: { leadId: lead.id, note: "Smoke test follow-up" },
  });
  assert(Boolean(followUp.id), "follow-up created");

  // 5. Update lead through the lifecycle + record attendance/outcome
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "QUALIFIED" },
  });
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "ATTENDED", outcome: "Interested — proceed to registration" },
  });
  const updated = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: { meetings: true, followUps: true, events: true },
  });
  assert(updated?.status === "QUALIFIED", "lead status updated to QUALIFIED");
  assert(updated?.meetings[0]?.status === "ATTENDED", "meeting updated to ATTENDED");
  assert((updated?.followUps.length ?? 0) === 1, "follow-up readable via relation");
  assert((updated?.events.length ?? 0) === 1, "event readable via relation");

  // 6. Query by attribution (CRM campaign view simulation)
  const campaignLeads = await prisma.lead.count({
    where: { utmCampaign: "mvp_test" },
  });
  assert(campaignLeads >= 1, "leads queryable by utmCampaign");

  // 7. Cleanup (meeting/follow-up cascade; event set-null)
  await prisma.lead.delete({ where: { id: lead.id } });
  const remainingLeads = await prisma.lead.count({
    where: { utmCampaign: "mvp_test" },
  });
  assert(remainingLeads === 0, "lead deleted (cleanup)");

  console.log("SMOKE TEST: ALL PASS");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
