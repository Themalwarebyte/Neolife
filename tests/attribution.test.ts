import { describe, expect, it } from "vitest";
import {
  deserializeAttribution,
  parseAttribution,
  parseAttributionFromSearchParams,
  resolveFirstTouch,
  serializeAttribution,
} from "../src/lib/attribution";

describe("parseAttribution (untrusted input constrained)", () => {
  it("returns null when no UTM parameters exist (nothing invented)", () => {
    expect(parseAttribution({})).toBeNull();
    expect(
      parseAttribution({ source: "", medium: "", campaign: "" }),
    ).toBeNull();
  });

  it("captures valid UTM parameters", () => {
    const result = parseAttribution({
      source: "facebook",
      medium: "paid_social",
      campaign: "launch",
      content: "creative_a",
      term: "business opportunity",
    });
    expect(result).toEqual({
      source: "facebook",
      medium: "paid_social",
      campaign: "launch",
      content: "creative_a",
      term: "business opportunity",
    });
  });

  it("parses from URLSearchParams", () => {
    const params = new URLSearchParams(
      "?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch",
    );
    expect(parseAttributionFromSearchParams(params)).toEqual({
      source: "facebook",
      medium: "paid_social",
      campaign: "launch",
    });
  });

  it("rejects malformed values (unsafe characters dropped)", () => {
    const result = parseAttribution({
      source: "<script>alert(1)</script>",
      campaign: "ok_campaign",
    });
    expect(result).not.toBeNull();
    expect(result?.source).toBeUndefined();
    expect(result?.campaign).toBe("ok_campaign");
  });

  it("safely constrains oversized values (trimmed to a safe maximum)", () => {
    const result = parseAttribution({
      campaign: "x".repeat(500),
    });
    expect(result?.campaign).toHaveLength(120);
  });

  it("drops values with newline/control characters (log-injection safe)", () => {
    const result = parseAttribution({
      source: "facebook\n2026-evil",
      medium: "paid_social",
    });
    expect(result?.source).toBeUndefined();
    expect(result?.medium).toBe("paid_social");
  });

  it("validates landing page paths only", () => {
    expect(
      parseAttribution({ landingPage: "/campaign/launch" })?.landingPage,
    ).toBe("/campaign/launch");
    expect(parseAttribution({ landingPage: "https://evil.example" })).toBeNull();
    expect(parseAttribution({ landingPage: "/ok path/x" })?.landingPage).toBe(
      "/ok path/x",
    );
  });
});

describe("resolveFirstTouch (first-touch preserved)", () => {
  const first = { source: "facebook", campaign: "launch" };
  const later = { source: "tiktok", campaign: "retarget" };

  it("uses incoming when no first-touch exists", () => {
    expect(resolveFirstTouch(null, later)).toEqual(later);
  });

  it("NEVER overwrites an existing first-touch attribution", () => {
    expect(resolveFirstTouch(first, later)).toEqual(first);
  });

  it("keeps first-touch even when later visit is identical-shape but different", () => {
    const stored = resolveFirstTouch(null, first);
    const afterSecondVisit = resolveFirstTouch(stored, later);
    expect(afterSecondVisit).toEqual(first);
  });

  it("keeps first-touch landing page information", () => {
    const withPage = { ...first, landingPage: "/campaign/launch" };
    const laterWithPage = { ...later, landingPage: "/campaign/retarget" };
    expect(resolveFirstTouch(withPage, laterWithPage)).toEqual(withPage);
  });
});

describe("serialize/deserialize (never trusts storage)", () => {
  it("round-trips valid attribution", () => {
    const attribution = { source: "facebook", campaign: "launch" };
    expect(
      deserializeAttribution(serializeAttribution(attribution)),
    ).toEqual(attribution);
  });

  it("returns null for corrupt storage content", () => {
    expect(deserializeAttribution("not-json{")).toBeNull();
    expect(deserializeAttribution('{"evil":"<script>"}')).toBeNull();
    expect(deserializeAttribution(null)).toBeNull();
  });
});
