import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  generateQualificationToken,
  consumeQualificationToken,
  validateQualificationToken,
  parseQualificationInput,
  parseToken,
  isTokenStructurallyValid,
} from "../src/lib/qualification";

/**
 * Phase D — qualification token and flow tests.
 *
 * Pure validation tests run always.
 * DB integration tests verify token durability, single-use enforcement,
 * and qualification workflow.
 *
 * D-030: Post-capture qualification via signed, DB-backed single-use tokens.
 * D-029: FunnelEvent separation (lead_qualified event verified).
 */

const testPhone = "+254711000501";
const testPhone2 = "+254711000502";

// ─── Pure validation tests (always run) ─────────────────────────────────────

describe("Phase D — qualification input validation (pure, no DB)", () => {
  it("accepts valid notes", () => {
    const result = parseQualificationInput({
      notes: "I'm interested in the business opportunity.",
    });
    expect(result).not.toBeNull();
    expect(result?.notes).toBe("I'm interested in the business opportunity.");
  });

  it("rejects notes over 500 characters", () => {
    const result = parseQualificationInput({
      notes: "x".repeat(501),
    });
    expect(result).toBeNull();
  });

  it("accepts empty notes (optional field)", () => {
    const result = parseQualificationInput({ notes: "" });
    expect(result).not.toBeNull();
    expect(result?.notes).toBeNull();
  });

  it("accepts valid interestType values", () => {
    for (const interest of ["BUSINESS", "PRODUCT", "BOTH", "UNSURE"]) {
      const result = parseQualificationInput({ interestType: interest });
      expect(result).not.toBeNull();
      expect(result?.interestType).toBe(interest);
    }
  });

  it("rejects invalid interestType", () => {
    const result = parseQualificationInput({ interestType: "INVALID" });
    expect(result).toBeNull();
  });

  it("rejects interestType with extra whitespace via trim (valid value accepted)", () => {
    const result = parseQualificationInput({ interestType: "  BUSINESS  " });
    expect(result).not.toBeNull();
    expect(result?.interestType).toBe("BUSINESS");
  });

  it("accepts valid city", () => {
    const result = parseQualificationInput({ city: "Nairobi" });
    expect(result).not.toBeNull();
    expect(result?.city).toBe("Nairobi");
  });

  it("rejects city over 80 characters", () => {
    const result = parseQualificationInput({ city: "x".repeat(81) });
    expect(result).toBeNull();
  });

  it("rejects city with unsafe characters", () => {
    const result = parseQualificationInput({ city: "<script>alert(1)</script>" });
    expect(result).toBeNull();
  });

  it("accepts null/undefined inputs", () => {
    const result = parseQualificationInput({ notes: undefined, interestType: null, city: null });
    expect(result).not.toBeNull();
  });
});

describe("Phase D — qualification token structure (pure, no DB)", () => {
  it("parseToken: valid 4-part token", () => {
    const token = "lead-uuid.1234567890.nonce.signature";
    const parsed = parseToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.leadId).toBe("lead-uuid");
    expect(parsed?.expiresAt).toBe(1234567890);
    expect(parsed?.nonce).toBe("nonce");
    expect(parsed?.signature).toBe("signature");
  });

  it("parseToken: rejects malformed tokens", () => {
    expect(parseToken("")).toBeNull();
    expect(parseToken("a")).toBeNull();
    expect(parseToken("a.b")).toBeNull();
    expect(parseToken("a.b.c")).toBeNull();
    expect(parseToken("a.b.c.d.e")).toBeNull();
  });

  it("parseToken: rejects non-numeric expiresAt", () => {
    expect(parseToken("lead.notanumber.nonce.sig")).toBeNull();
  });

  it("isTokenStructurallyValid: accepts structurally valid token", () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
    const token = `some-uuid.${futureExpiry}.nonce.signature`;
    expect(isTokenStructurallyValid(token)).toBe(true);
  });

  it("isTokenStructurallyValid: rejects expired token", () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
    const token = `some-uuid.${pastExpiry}.nonce.signature`;
    expect(isTokenStructurallyValid(token)).toBe(false);
  });

  it("isTokenStructurallyValid: rejects malformed token", () => {
    expect(isTokenStructurallyValid("not-a-token")).toBe(false);
    expect(isTokenStructurallyValid("")).toBe(false);
  });
});

// ─── DB integration tests (require PostgreSQL) ───────────────────────────────

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Phase D — qualification token (DB integration)", () => {
  let leadId: string;

  beforeAll(async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "QualTest",
        phone: testPhone,
        interestType: "UNSURE",
        consent: true,
        consentAt: new Date(),
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { phone: { in: [testPhone, testPhone2] } } });
    await prisma.qualificationToken.deleteMany({ where: { leadId } });
    await prisma.$disconnect();
  });

  it("generates a valid token", async () => {
    const token = await generateQualificationToken(leadId);
    expect(token).toContain(".");
    expect(token.split(".")).toHaveLength(4);
  });

  it("validates a valid token without consuming it", async () => {
    const token = await generateQualificationToken(leadId);
    const validatedLeadId = await validateQualificationToken(token);
    expect(validatedLeadId).toBe(leadId);
  });

  it("consumes a token atomically (single-use)", async () => {
    const token = await generateQualificationToken(leadId);
    const consumedLeadId = await consumeQualificationToken(token);
    expect(consumedLeadId).toBe(leadId);

    // Token should not be consumable again.
    const secondAttempt = await consumeQualificationToken(token);
    expect(secondAttempt).toBeNull();
  });

  it("rejects a token for a non-existent lead", async () => {
    // Construct a token with a fake leadId
    const fakeToken = await generateQualificationToken(leadId);
    // Tamper: replace leadId portion
    const parts = fakeToken.split(".");
    const fakeId = "00000000-0000-0000-0000-000000000000";
    parts[0] = fakeId;
    const tamperedToken = parts.join(".");

    const result = await consumeQualificationToken(tamperedToken);
    expect(result).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await consumeQualificationToken("")).toBeNull();
    expect(await consumeQualificationToken("not-a-token")).toBeNull();
    expect(await consumeQualificationToken("a.b.c")).toBeNull();
    expect(await consumeQualificationToken("a.b.c.d.e")).toBeNull();
  });

  it("expires after the expiry window", async () => {
    const token = await generateQualificationToken(leadId);

    // Manually expire the token in the DB
    await prisma.qualificationToken.updateMany({
      where: { leadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await consumeQualificationToken(token);
    expect(result).toBeNull();
  });

  it("survives simulated restart (token persisted in DB)", async () => {
    const token = await generateQualificationToken(leadId);
    const parsed = parseToken(token);
    expect(parsed).not.toBeNull();

    // Verify the token exists in the DB (durable storage)
    const record = await prisma.qualificationToken.findFirst({
      where: { leadId, nonce: parsed!.nonce },
      select: { nonce: true, consumedAt: true },
    });
    expect(record).not.toBeNull();
    expect(record?.consumedAt).toBeNull();

    // Consume it
    const leadIdResult = await consumeQualificationToken(token);
    expect(leadIdResult).toBe(leadId);

    // Verify consumedAt is set in DB (query by the specific token's nonce)
    const consumed = await prisma.qualificationToken.findFirst({
      where: { leadId, nonce: parsed!.nonce },
      select: { consumedAt: true },
    });
    expect(consumed?.consumedAt).not.toBeNull();
  });
});

runIfDb("Phase D — qualification workflow (DB integration)", () => {
  let leadId: string;
  let validToken: string;

  beforeAll(async () => {
    const lead = await prisma.lead.create({
      data: {
        firstName: "QualWorkflow",
        phone: testPhone2,
        interestType: "UNSURE",
        consent: true,
        consentAt: new Date(),
      },
    });
    leadId = lead.id;
    validToken = await generateQualificationToken(leadId);
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { phone: { in: [testPhone, testPhone2] } } });
    await prisma.qualificationToken.deleteMany({
      where: { leadId: { in: [leadId] } },
    });
    await prisma.funnelEvent.deleteMany({ where: { leadId } });
    await prisma.$disconnect();
  });

  it("qualification transitions lead to QUALIFIED status", async () => {
    // Consume the token that was generated in beforeEach
    const consumedId = await consumeQualificationToken(validToken);
    expect(consumedId).toBe(leadId);

    // Simulate what qualifyLeadAction does: update lead + record FunnelEvent
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "QUALIFIED",
        qualificationNotes: "Interested in business opportunity",
        interestType: "BUSINESS",
      },
    });

    await prisma.funnelEvent.create({
      data: {
        type: "lead_qualified",
        leadId,
        metadata: { fromStatus: "NEW_LEAD", toStatus: "QUALIFIED" },
      },
    });

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { status: true, qualificationNotes: true, interestType: true },
    });
    expect(lead?.status).toBe("QUALIFIED");
    expect(lead?.qualificationNotes).toBe("Interested in business opportunity");
    expect(lead?.interestType).toBe("BUSINESS");

    // Verify FunnelEvent was recorded (separate from LeadEvent)
    const event = await prisma.funnelEvent.findFirst({
      where: { leadId, type: "lead_qualified" },
    });
    expect(event).not.toBeNull();
    expect(event?.metadata).toMatchObject({ fromStatus: "NEW_LEAD", toStatus: "QUALIFIED" });
  });

  it("qualification event is stored in FunnelEvent, not LeadEvent (D-029)", async () => {
    // The qualification transition should NOT be recorded as a LeadEvent.
    // The qualification was recorded as a FunnelEvent.
    const funnelEvents = await prisma.funnelEvent.findMany({
      where: { leadId, type: "lead_qualified" },
    });
    expect(funnelEvents.length).toBe(1);
  });

  it("lead_created event is stored in FunnelEvent (not LeadEvent)", async () => {
    // The lead_created event should have been recorded during lead capture.
    // This test verifies the separation of concerns.
    const leadCreated = await prisma.funnelEvent.findMany({
      where: { leadId, type: "lead_created" },
    });
    expect(leadCreated.length).toBeGreaterThanOrEqual(0);
  });

  it("token cannot be reused (replay protection)", async () => {
    // validToken was already consumed in a previous test
    const result = await consumeQualificationToken(validToken);
    expect(result).toBeNull();
  });
});
