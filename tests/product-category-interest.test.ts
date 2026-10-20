import { describe, expect, it } from "vitest";
import {
  PRODUCT_INTEREST_CATEGORIES,
  parseRegisterInterestInput,
} from "../src/lib/registration";

const input = {
  categorySlug: "nutritionals",
  meetingPreference: "video_call",
  additionalContext: "Please explain the range.",
};

describe("prospect category-only interest validation", () => {
  it("uses the four official categories and the unsure option", () => {
    expect(PRODUCT_INTEREST_CATEGORIES.map((c) => c.slug)).toEqual([
      "nutritionals",
      "weight-management",
      "personal-care",
      "home-care",
      "not-sure-yet",
    ]);
  });

  it("accepts a category without inventing a productId", () => {
    const result = parseRegisterInterestInput(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.categorySlug).toBe("nutritionals");
      expect(result.data.productId).toBe("");
      expect(result.data.meetingPreference).toBe("video_call");
    }
  });

  it("permits prospects who do not know which category they need", () => {
    const result = parseRegisterInterestInput({ ...input, categorySlug: "not-sure-yet" });
    expect(result.ok).toBe(true);
  });

  it("rejects forged or missing categories", () => {
    const bad = parseRegisterInterestInput({ ...input, categorySlug: "invented-category" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors.categorySlug).toBeTruthy();
    const missing = parseRegisterInterestInput({ ...input, categorySlug: "" });
    expect(missing.ok).toBe(false);
  });

  it("preserves the legacy product-specific parser for existing data paths", () => {
    const result = parseRegisterInterestInput({
      productId: "0193a000-0000-0000-0000-000000000001",
      meetingPreference: "in_person",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.productId).toBe("0193a000-0000-0000-0000-000000000001");
      expect(result.data.categorySlug).toBeNull();
    }
  });
});
