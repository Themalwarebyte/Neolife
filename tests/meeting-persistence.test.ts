import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";

/**
 * Integration test against the local development database (docker compose up -d).
 * Verifies the office-pipeline meeting flow used by Task 1.8 server actions.
 */
const phone = "+254711000097";

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

async function createLead() {
  return prisma.lead.create({
    data: {
      firstName: "Meeting",
      phone,
      interestType: "BUSINESS",
      consent: true,
      consentAt: new Date(),
    },
  });
}

runIfDb("meeting persistence (office pipeline)", () => {
  beforeAll(async () => {
    await prisma.lead.deleteMany({ where: { phone } });
  });

  afterAll(async () => {
    const lead = await prisma.lead.findFirst({ where: { phone } });
    if (lead) await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.$disconnect();
  });

  it("schedules a meeting with default SCHEDULED status", async () => {
    const lead = await createLead();
    const meeting = await prisma.meeting.create({
      data: { leadId: lead.id, scheduledAt: new Date(Date.now() + 86_400_000) },
    });
    expect(meeting.status).toBe("SCHEDULED");
  });

  it("updates meeting status, outcome and notes", async () => {
    const lead = await prisma.lead.findFirst({ where: { phone } });
    const meeting = await prisma.meeting.findFirst({ where: { leadId: lead!.id } });
    const updated = await prisma.meeting.update({
      where: { id: meeting!.id },
      data: { status: "ATTENDED", outcome: "Proceeded to registration", notes: "Met in office" },
    });
    expect(updated.status).toBe("ATTENDED");
    expect(updated.outcome).toBe("Proceeded to registration");
    expect(updated.notes).toBe("Met in office");
  });

  it("records meeting events on the lead", async () => {
    const lead = await prisma.lead.findFirst({ where: { phone } });
    const event = await prisma.leadEvent.create({
      data: { leadId: lead!.id, type: "meeting_scheduled", metadata: { scheduledAt: new Date().toISOString() } },
    });
    expect(event.type).toBe("meeting_scheduled");
  });
});
