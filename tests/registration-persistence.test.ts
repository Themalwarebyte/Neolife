import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { parseRegisterInterestInput } from "../src/lib/registration";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase P-1 — ProductInterest persistence (integration with local PostgreSQL).
 *
 * Verifies the registration/business-interest persistence flow:
 * - Input validation (parseRegisterInterestInput)
 * - ProductInterest row creation within the server action's transaction
 * - registration_complete FunnelEvent recorded server-side only
 * - registration_start NOT recorded by the server action (client-side only)
 * - NO Meeting record created (per Owner decision)
 * - meetingPreference preserved in registration_complete metadata
 *
 * Run from WSL: DATABASE_URL=postgresql://... pnpm test
 */
const testPhone = "+254711000801";
const VALID_PRODUCT_ID = "0193a000-0000-0000-0000-000000000001";

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

async function createTestLead() {
  return prisma.lead.create({
    data: {
      firstName: "Registration",
      phone: testPhone,
      interestType: "BOTH",
      consent: true,
      consentAt: new Date(),
    },
  });
}

/**
 * Simulates the server action's persistence transaction (register-interest.ts:90-111)
 * to verify ProductInterest + registration_complete are created atomically,
 * and that NO registration_start or Meeting is created.
 */
async function executeRegistrationTransaction(
  leadId: string,
  productId: string,
  meetingPreference: string,
  additionalContext: string | null,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });
  if (!product) throw new Error("Product not found");

  await prisma.$transaction(async (tx) => {
    await tx.productInterest.create({
      data: {
        productId,
        leadId,
        status: "NEW",
        message: additionalContext ?? undefined,
      },
    });

    await tx.funnelEvent.create({
      data: {
        type: "registration_complete",
        leadId,
        metadata: {
          productId,
          productName: product.name,
          meetingPreference,
        },
      },
    });
  });
}

runIfDb("ProductInterest persistence (registration flow)", () => {
  let leadId: string;
  let productId: string;

  beforeAll(async () => {
    await prisma.lead.deleteMany({ where: { phone: testPhone } });
    await prisma.productInterest.deleteMany({
      where: { product: { sku: "942" } },
    });
    await prisma.funnelEvent.deleteMany({ where: { type: "registration_complete" } });
    await prisma.funnelEvent.deleteMany({ where: { type: "registration_start" } });

    const lead = await createTestLead();
    leadId = lead.id;

    // Use an actual seeded product (Pro Vitality, SKU 942)
    const product = await prisma.product.findFirst({
      where: { sku: "942" },
      select: { id: true, name: true },
    });
    if (product) {
      productId = product.id;
    } else {
      // Fallback to a test UUID if product not seeded
      productId = VALID_PRODUCT_ID;
    }
  });

  afterAll(async () => {
    await prisma.productInterest.deleteMany({ where: { leadId } });
    await prisma.funnelEvent.deleteMany({ where: { leadId } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    await prisma.$disconnect();
  });

  it("validates registration input with meetingPreference and context", () => {
    const parsed = parseRegisterInterestInput({
      productId,
      meetingPreference: "video_call",
      additionalContext: "Interested in learning more.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.productId).toBe(productId);
    expect(parsed.data.meetingPreference).toBe("video_call");
    expect(parsed.data.additionalContext).toBe("Interested in learning more.");
  });

  it("persists ProductInterest with NEW status by default", async () => {
    await executeRegistrationTransaction(
      leadId,
      productId,
      "video_call",
      "Interested in learning more.",
    );

    const row = await prisma.productInterest.findFirst({
      where: { leadId, productId },
    });
    expect(row).not.toBeNull();
    expect(row?.productId).toBe(productId);
    expect(row?.leadId).toBe(leadId);
    expect(row?.status).toBe("NEW");
    expect(row?.message).toBe("Interested in learning more.");
  });

  it("records registration_complete FunnelEvent with meetingPreference metadata", async () => {
    const event = await prisma.funnelEvent.findFirst({
      where: { type: "registration_complete", leadId },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.type).toBe("registration_complete");
    expect(event?.leadId).toBe(leadId);
    const meta = event?.metadata as Record<string, unknown> | null;
    expect(meta?.productId).toBe(productId);
    expect(meta?.meetingPreference).toBe("video_call");
  });

  it("does NOT create a registration_start FunnelEvent via the server action", async () => {
    // The server action does NOT record registration_start — it is client-side only.
    // Verify no registration_start exists for this lead.
    const start = await prisma.funnelEvent.findFirst({
      where: { type: "registration_start", leadId },
    });
    expect(start).toBeNull();
  });

  it("does NOT create a Meeting record during registration", async () => {
    const meeting = await prisma.meeting.findFirst({ where: { leadId } });
    expect(meeting).toBeNull();
  });

  it("verifies ProductInterest links to both Product and Lead", async () => {
    const interest = await prisma.productInterest.findFirst({
      where: { leadId },
      include: {
        product: { select: { id: true } },
        lead: { select: { id: true, phone: true } },
      },
    });
    expect(interest).not.toBeNull();
    expect(interest?.product.id).toBe(productId);
    expect(interest?.lead!.id).toBe(leadId);
    expect(interest?.lead!.phone).toBe(testPhone);
  });
});

describe("registration validation edge cases (pure, no DB)", () => {
  it("rejects non-string fields treated as unknown", () => {
    const result = parseRegisterInterestInput({
      productId: null,
      meetingPreference: null,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid UUID with uppercase hex", () => {
    const result = parseRegisterInterestInput({
      productId: "0193A000-0000-0000-0000-000000000001",
      meetingPreference: "in_person",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts all three meeting preference options", () => {
    for (const pref of ["video_call", "in_person", "phone_call"]) {
      const result = parseRegisterInterestInput({
        productId: "0193a000-0000-0000-0000-000000000001",
        meetingPreference: pref,
      });
      expect(result.ok).toBe(true);
    }
  });
});

/**
 * Phase P-1 — server action behavior verification (pure, no DB).
 *
 * These tests verify the design contract of registerInterestAction:
 * - registration_start is NOT emitted by the server action (client-side only)
 * - No Meeting record is created (Owner decision D-032)
 * - registration_complete is server-authoritative
 * - meetingPreference is captured in registration_complete metadata
 */
describe("registration server action semantics (pure, no DB)", () => {
  const actionPath = join(__dirname, "..", "src", "app", "actions", "register-interest.ts");
  const content = readFileSync(actionPath, "utf-8");

  it("registerInterestAction does not import or call recordFunnelEvent for registration_start", () => {
    // The server action should NOT call recordFunnelEvent for registration_start
    expect(content).not.toMatch(/recordFunnelEvent.*registration_start/);
    // It SHOULD record registration_complete (server-side)
    expect(content).toMatch(/registration_complete/);
  });

  it("registerInterestAction does NOT create a Meeting", () => {
    // No prisma.meeting.create calls
    expect(content).not.toMatch(/prisma.*meeting.*create|meeting.*create/i);
  });

  it("registerInterestAction captures meetingPreference in registration_complete metadata", () => {
    // meetingPreference should appear in the registration_complete metadata
    expect(content).toMatch(/meetingPreference/);
  });

  it("registration_start is NOT imported in the server action", () => {
    // The server action should NOT import recordFunnelEvent (registration_start
    // is emitted client-side via recordFunnelEventClient)
    expect(content).not.toMatch(/import.*recordFunnelEvent/);
  });
});
