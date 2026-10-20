import { describe, expect, it } from "vitest";
import {
  crmAnalyticsRangeStart,
  parseCrmAnalyticsRange,
  parseCrmPage,
  parseQualificationQueueView,
  qualificationReviewState,
} from "../src/lib/qualification-review";

describe("qualification review and CRM analytics helpers", () => {
  it("defaults invalid qualification views to needs-review", () => {
    expect(parseQualificationQueueView(undefined)).toBe("needs-review");
    expect(parseQualificationQueueView("unknown")).toBe("needs-review");
    expect(parseQualificationQueueView(["reviewed", "all"])).toBe("reviewed");
    expect(parseQualificationQueueView("all")).toBe("all");
  });

  it("parses only bounded positive decimal page values", () => {
    expect(parseCrmPage("2")).toBe(2);
    expect(parseCrmPage("0")).toBe(1);
    expect(parseCrmPage("-2")).toBe(1);
    expect(parseCrmPage("1e3")).toBe(1);
    expect(parseCrmPage("9999")).toBe(500);
  });

  it("uses supported analytics windows and defaults invalid values to 30 days", () => {
    expect(parseCrmAnalyticsRange("7d")).toBe("7d");
    expect(parseCrmAnalyticsRange("90d")).toBe("90d");
    expect(parseCrmAnalyticsRange("365d")).toBe("365d");
    expect(parseCrmAnalyticsRange("1y")).toBe("30d");
  });

  it("calculates a deterministic UTC range start", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(crmAnalyticsRangeStart("7d", now).toISOString()).toBe("2026-10-13T12:00:00.000Z");
    expect(crmAnalyticsRangeStart("30d", now).toISOString()).toBe("2026-09-20T12:00:00.000Z");
  });

  it("reports review state from the persisted review marker", () => {
    expect(qualificationReviewState(false)).toBe("needs-review");
    expect(qualificationReviewState(true)).toBe("reviewed");
  });
});
