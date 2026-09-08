import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  findActiveLeadByPhone,
  parseAttributionPayload,
  parseLeadInput,
  persistLead,
} from "../src/lib/leads";

/**
 * Integration test against the local development database (docker compose up -d).
 * Verifies the public-to-PostgreSQL lead flow used by the server action,
 * including Task 1.4 first-party attribution.
 */
const testPhone = "+254711000099";
const testPhoneAttributed = "+254711000098";

afterAll(async () => {
  await prisma.lead.deleteMany({
    where: { phone: { in: [testPhone, testPhoneAttributed] } },
  });
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
    // Without attribution parameters, nothing is invented:
    expect(row?.utmSource).toBeNull();
    expect(row?.utmCampaign).toBeNull();
    expect(row?.firstTouchSource).toBeNull();
  });

  it("persists validated first-touch attribution onto the lead record", async () => {
    const parsed = parseLeadInput({
      firstName: "Attributed",
      phone: testPhoneAttributed,
      interestType: "BOTH",
      consent: true,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const attribution = parseAttributionPayload({
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "launch",
      utmContent: "creative_a",
      landingPage: "/campaign/launch",
    });

    const created = await persistLead(parsed.data, attribution);
    const row = await prisma.lead.findUnique({ where: { id: created.id } });
    expect(row?.utmSource).toBe("facebook");
    expect(row?.utmMedium).toBe("paid_social");
    expect(row?.utmCampaign).toBe("launch");
    expect(row?.utmContent).toBe("creative_a");
    expect(row?.landingPage).toBe("/campaign/launch");
    expect(row?.firstTouchSource).toBe("facebook");
  });

  it("drops unsafe attribution instead of persisting it", async () => {
    const unsafe = parseAttributionPayload({
      utmSource: "<script>alert(1)</script>",
      utmCampaign: "safe_campaign",
    });
    expect(unsafe.source).toBeUndefined();
    expect(unsafe.campaign).toBe("safe_campaign");
    expect(unsafe.firstTouchSource).toBeUndefined();
  });

  it("duplicate-submission guard finds the active lead by phone", async () => {
    const existing = await findActiveLeadByPhone(testPhone);
    expect(existing).not.toBeNull();
  });
});
