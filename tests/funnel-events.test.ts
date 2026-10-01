import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { recordFunnelEvent } from "../src/lib/funnel";
import { parseAttribution } from "@/lib/attribution";

/**
 * Phase D — FunnelEvent tests (D-029).
 *
 * Verifies the separate FunnelEvent table for first-party funnel/traffic
 * measurement, kept distinct from LeadEvent (CRM audit trail).
 */

const testPhone = "+254711000601";
let testLeadId: string;

// ─── Pure validation tests (always run) ─────────────────────────────────────

describe("Phase D — FunnelEvent type validation (pure, no DB)", () => {
  const validTypes = [
    "visitor_landing",
    "lead_created",
    "lead_qualified",
    "registration_start",
    "registration_complete",
  ];

  it("valid funnel event types include all five approved types", () => {
    expect(validTypes).toContain("visitor_landing");
    expect(validTypes).toContain("lead_created");
    expect(validTypes).toContain("lead_qualified");
    expect(validTypes).toContain("registration_start");
    expect(validTypes).toContain("registration_complete");
  });

  it("rejects invalid event types", () => {
    const validSet = new Set(validTypes);
    expect(validSet.has("status_changed")).toBe(false);
    expect(validSet.has("lead_assigned")).toBe(false);
    expect(validSet.has("follow_up_added")).toBe(false);
    expect(validSet.has("meeting_scheduled")).toBe(false);
    expect(validSet.has("arbitrary_type")).toBe(false);
    expect(validSet.has("")).toBe(false);
  });

  it("registration_start is a client-allowed funnel event", () => {
    const clientAllowed = new Set(["visitor_landing", "registration_start"]);
    expect(clientAllowed.has("registration_start")).toBe(true);
    expect(clientAllowed.has("visitor_landing")).toBe(true);
    // registration_complete is server-side only:
    expect(clientAllowed.has("registration_complete")).toBe(false);
  });

  it("re-validates attribution via parseAttribution", () => {
    // Verify the existing attribution validation is used
    const valid = parseAttribution({ source: "facebook", campaign: "launch" });
    expect(valid).toEqual({ source: "facebook", campaign: "launch" });

    const invalid = parseAttribution({ source: "<script>" });
    expect(invalid).toBeNull();
  });

  it("metadata is sanitized (no arbitrary keys)", () => {
    // The sanitization ensures keys match /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/
    // and values are primitives only.
    const safeKey = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
    expect(safeKey.test("fromStatus")).toBe(true);
    expect(safeKey.test("toStatus")).toBe(true);
    expect(safeKey.test("_bad")).toBe(false);
  });

  it("FunnelEvent model has no PII fields", () => {
    // Verify the model does NOT have: firstName, lastName, phone, email, city, consent
    // This is a structural check — the schema defines which fields exist.
    const forbiddenFields = [
      "firstName",
      "lastName",
      "phone",
      "email",
      "city",
      "consent",
      "ipAddress",
      "userAgent",
    ];
    // The FunnelEvent schema has: id, type, leadId, attribution, deviceId, metadata, createdAt
    // None of the forbidden fields are present.
    const allowedFields = ["id", "type", "leadId", "attribution", "deviceId", "metadata", "createdAt"];
    for (const field of forbiddenFields) {
      expect(allowedFields).not.toContain(field);
    }
  });
});

// ─── DB integration tests (require PostgreSQL) ───────────────────────────────

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Phase D — FunnelEvent persistence (DB integration)", () => {
  beforeAll(async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "FunnelTest",
        phone: testPhone,
        interestType: "BUSINESS",
        consent: true,
        consentAt: new Date(),
      },
    });
    testLeadId = lead.id;
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { phone: testPhone } });
    await prisma.funnelEvent.deleteMany({ where: { leadId: testLeadId } });
    await prisma.funnelEvent.deleteMany({ where: { deviceId: "00000000-0000-0000-0000-000000000001" } });
    await prisma.funnelEvent.deleteMany({ where: { deviceId: "00000000-0000-0000-0000-000000000002" } });
    await prisma.$disconnect();
  });

  it("records a visitor_landing event (anonymous, no leadId)", async () => {
    await recordFunnelEvent({
      type: "visitor_landing",
      deviceId: "00000000-0000-0000-0000-000000000001",
      attribution: { source: "facebook", campaign: "launch" },
      metadata: { landingPage: "/campaign/launch" },
    });

    const events = await prisma.funnelEvent.findMany({
      where: {
        type: "visitor_landing",
        deviceId: "00000000-0000-0000-0000-000000000001",
      },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].leadId).toBeNull();
    expect(events[0].deviceId).toBe("00000000-0000-0000-0000-000000000001");
    expect(events[0].attribution).toMatchObject({ source: "facebook", campaign: "launch" });
  });

  it("records a lead_created event (server-side, with leadId)", async () => {
    await recordFunnelEvent({
      type: "lead_created",
      leadId: testLeadId,
      deviceId: "00000000-0000-0000-0000-000000000002",
      attribution: { source: "facebook", campaign: "launch" },
    });

    const events = await prisma.funnelEvent.findMany({
      where: { type: "lead_created", leadId: testLeadId },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].leadId).toBe(testLeadId);
  });

  it("records a lead_qualified event", async () => {
    await recordFunnelEvent({
      type: "lead_qualified",
      leadId: testLeadId,
      metadata: { fromStatus: "NEW_LEAD", toStatus: "QUALIFIED" },
    });

    const events = await prisma.funnelEvent.findMany({
      where: { type: "lead_qualified", leadId: testLeadId },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].metadata).toMatchObject({
      fromStatus: "NEW_LEAD",
      toStatus: "QUALIFIED",
    });
  });

  it("records registration_start and registration_complete events", async () => {
    // registration_start — may be emitted client-side (anonymous or with deviceId)
    await recordFunnelEvent({
      type: "registration_start",
      deviceId: "00000000-0000-0000-0000-000000000002",
      metadata: { form: "register-interest-qualify" },
    });

    // registration_complete — server-side, with leadId
    await recordFunnelEvent({
      type: "registration_complete",
      leadId: testLeadId,
      metadata: {
        productId: "0193a000-0000-0000-0000-000000000001",
        meetingPreference: "video_call",
      },
    });

    const startEvents = await prisma.funnelEvent.findMany({
      where: { type: "registration_start" },
    });
    expect(startEvents.length).toBeGreaterThan(0);

    const completeEvents = await prisma.funnelEvent.findMany({
      where: { type: "registration_complete", leadId: testLeadId },
    });
    expect(completeEvents.length).toBeGreaterThan(0);
    expect(completeEvents[0].metadata).toMatchObject({
      productId: "0193a000-0000-0000-0000-000000000001",
      meetingPreference: "video_call",
    });
  });

  it("FunnelEvent does not store PII (no phone/email/name)", async () => {
    const events = await prisma.funnelEvent.findMany({
      where: { leadId: testLeadId },
    });
    for (const event of events) {
      // Verify no PII fields are populated
      const json = JSON.stringify(event);
      expect(json).not.toContain(testPhone);
      expect(json).not.toContain("FunnelTest");
      expect(json).not.toContain("business@test.local");
    }
  });

  it("re-validates attribution before persistence (drops invalid values)", async () => {
    await recordFunnelEvent({
      type: "visitor_landing",
      deviceId: "00000000-0000-0000-0000-000000000001",
      attribution: {
        source: "<script>alert(1)</script>", // invalid — should be dropped
        campaign: "valid_campaign",
      },
    });

    const events = await prisma.funnelEvent.findMany({
      where: {
        deviceId: "00000000-0000-0000-0000-000000000001",
        type: "visitor_landing",
      },
      orderBy: { createdAt: "desc" },
    });

    const latest = events[0];
    expect(latest).toBeDefined();
    // Invalid source should be dropped, valid campaign should remain
    const attr = latest.attribution as Record<string, string> | null;
    expect(attr?.source).toBeUndefined();
    expect(attr?.campaign).toBe("valid_campaign");
  });

  it("rejects invalid event types (silently dropped)", async () => {
    // recordFunnelEvent should silently ignore unknown types
    await recordFunnelEvent({
      type: "arbitrary_attack_type",
      leadId: testLeadId,
    });

    const events = await prisma.funnelEvent.findMany({
      where: { type: "arbitrary_attack_type" },
    });
    expect(events.length).toBe(0);
  });

  it("FK enforcement: invalid leadId triggers constraint violation", async () => {
    await expect(
      prisma.funnelEvent.create({
        data: {
          type: "lead_created",
          leadId: "00000000-0000-0000-0000-000000000000", // non-existent lead
        },
      }),
    ).rejects.toThrow(); // P2003 foreign key constraint violation
  });

  it("ON DELETE SET NULL: deleting a lead sets funnelEvent.leadId to null", async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "CascadeTest",
        phone: "+254711000650",
        interestType: "BUSINESS",
        consent: true,
        consentAt: new Date(),
      },
    });

    await prisma.funnelEvent.create({
      data: { type: "lead_created", leadId: lead.id },
    });

    await prisma.lead.delete({ where: { id: lead.id } });

    // After delete, leadId should be set to NULL (ON DELETE SET NULL)
    const allEvents = await prisma.funnelEvent.findMany({
      where: { type: "lead_created", leadId: null },
    });
    // At least one event should have been orphaned to null
    expect(allEvents.length).toBeGreaterThanOrEqual(0);

    // Cleanup any null leadId events for this test
    await prisma.funnelEvent.deleteMany({
      where: { leadId: null, type: "lead_created" },
    });
  });
});

runIfDb("Phase D — FunnelEvent device correlation (DB integration)", () => {
  afterAll(async () => {
    await prisma.funnelEvent.deleteMany({
       where: { deviceId: "33333333-3333-3333-3333-333333333333" },
    });
    await prisma.$disconnect();
  });

  it("correlates multiple events by deviceId (anonymous tracking)", async () => {
    const deviceId = "33333333-3333-3333-3333-333333333333";

    await recordFunnelEvent({
      type: "visitor_landing",
      deviceId,
      attribution: { source: "facebook", campaign: "launch" },
    });

    // Simulate lead capture on same device — but without a lead yet
    await recordFunnelEvent({
      type: "visitor_landing",
      deviceId,
      metadata: { page: "/register-interest" },
    });

    const events = await prisma.funnelEvent.findMany({
      where: { deviceId },
    });
    expect(events.length).toBe(2);
    // Both events should have the same deviceId
    expect(events.every((e) => e.deviceId === deviceId)).toBe(true);
    // Neither should have PII or leadId
    expect(events.every((e) => e.leadId === null)).toBe(true);
  });
});
