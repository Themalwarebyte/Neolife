import { describe, expect, it } from "vitest";
import {
  parseRegisterInterestInput,
  MEETING_PREFERENCE_OPTIONS,
} from "../src/lib/registration";

const VALID_PRODUCT_ID = "0193a000-0000-0000-0000-000000000001";

/**
 * Phase P-1 — registration / business-interest validation (pure, no DB).
 *
 * Validates the client-supplied input for the optional post-capture
 * registration-interest step (D-026 capture flow).
 */

describe("Phase P-1 — registration input validation (pure, no DB)", () => {
  it("accepts valid input with all fields", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "video_call",
      additionalContext: "I'd like to know about the business model.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.productId).toBe(VALID_PRODUCT_ID);
    expect(result.data.meetingPreference).toBe("video_call");
    expect(result.data.additionalContext).toBe(
      "I'd like to know about the business model.",
    );
  });

  it("accepts valid input with only required fields (no context)", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "in_person",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.productId).toBe(VALID_PRODUCT_ID);
    expect(result.data.meetingPreference).toBe("in_person");
    expect(result.data.additionalContext).toBeNull();
  });

  it("accepts empty additionalContext (optional field)", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "phone_call",
      additionalContext: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.additionalContext).toBeNull();
  });

  it("accepts whitespace-only additionalContext (treated as empty)", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "video_call",
      additionalContext: "   ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.additionalContext).toBeNull();
  });

  it("trims leading/trailing whitespace from additionalContext", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "video_call",
      additionalContext: "  Some context here  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.additionalContext).toBe("Some context here");
  });

  it("rejects missing productId", () => {
    const result = parseRegisterInterestInput({
      productId: undefined,
      meetingPreference: "video_call",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.productId).toBeTruthy();
  });

  it("rejects non-UUID productId", () => {
    const result = parseRegisterInterestInput({
      productId: "not-a-uuid",
      meetingPreference: "video_call",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.productId).toBeTruthy();
  });

  it("rejects empty-string productId", () => {
    const result = parseRegisterInterestInput({
      productId: "",
      meetingPreference: "video_call",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.productId).toBeTruthy();
  });

  it("rejects productId with extra whitespace (no valid UUID)", () => {
    const result = parseRegisterInterestInput({
      productId: " ",
      meetingPreference: "video_call",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.productId).toBeTruthy();
  });

  it("rejects invalid meetingPreference", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "carrier_pigeon",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.meetingPreference).toBeTruthy();
  });

  it("rejects missing meetingPreference", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: undefined,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.meetingPreference).toBeTruthy();
  });

  it("accepts all valid meeting preference options", () => {
    for (const pref of MEETING_PREFERENCE_OPTIONS) {
      const result = parseRegisterInterestInput({
        productId: VALID_PRODUCT_ID,
        meetingPreference: pref,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.data.meetingPreference).toBe(pref);
    }
  });

  it("rejects additionalContext over 1000 characters", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "video_call",
      additionalContext: "x".repeat(1001),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.additionalContext).toBeDefined();
  });

  it("accepts additionalContext exactly 1000 characters", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: "video_call",
      additionalContext: "x".repeat(1000),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects non-string productId", () => {
    const result = parseRegisterInterestInput({
      productId: 12345,
      meetingPreference: "video_call",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.productId).toBeTruthy();
  });

  it("rejects non-string meetingPreference", () => {
    const result = parseRegisterInterestInput({
      productId: VALID_PRODUCT_ID,
      meetingPreference: 12345,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.meetingPreference).toBeTruthy();
  });
});
