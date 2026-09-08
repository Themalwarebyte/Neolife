import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { findActiveLeadByPhone, parseLeadInput, persistLead } from "../src/lib/leads";

/**
 * Integration test against the local development database (docker compose up -d).
 * Verifies the public-to-PostgreSQL lead flow used by the server action.
 */
const testPhone = "+254711000099";

afterAll(async () => {
  await prisma.lead.deleteMany({ where: { phone: testPhone } });
  await prisma.$disconnect();
});

describe("lead persistence (public → PostgreSQL)", () => {
  it("persists a validated lead with consent, timestamp and default status", async () => {
    const parsed = parseLeadInput({
      firstName: "Integration",
      phone: testPhone,
      email: "integration@test.local",
      interestType: "BUSINESS",
      consent: true,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await persistLead(parsed.data);
    expect(created.id).toBeTruthy();

    const row = await prisma.lead.findUnique({ where: { id: created.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("NEW_LEAD");
    expect(row?.consent).toBe(true);
    expect(row?.consentAt).not.toBeNull();
    expect(row?.firstName).toBe("Integration");
    // Attribution fields must remain untouched (Task 1.4 boundary)
    expect(row?.utmSource).toBeNull();
    expect(row?.firstTouchSource).toBeNull();
  });

  it("duplicate-submission guard finds the active lead by phone", async () => {
    const existing = await findActiveLeadByPhone(testPhone);
    expect(existing).not.toBeNull();
  });
});
