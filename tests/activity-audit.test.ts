import { describe, expect, it } from "vitest";
import { parseActivityAuditFilters } from "../src/lib/activity-audit";

describe("Owner activity audit filters", () => {
  it("accepts a valid user/action/outcome/date filter", () => {
    expect(parseActivityAuditFilters({ actor: "user-123", action: "CONTACT_TRANSFER_DECISION", outcome: "SUCCESS", from: "2026-10-01", to: "2026-10-25", page: "2" })).toEqual({ actorId: "user-123", action: "CONTACT_TRANSFER_DECISION", outcome: "SUCCESS", from: "2026-10-01", to: "2026-10-25", page: 2 });
  });
  it("rejects malformed action, date, outcome and account control characters", () => {
    expect(parseActivityAuditFilters({ actor: "user\n123", action: "<script>", outcome: "ROOT", from: "2026-02-31", to: "bad" })).toEqual({ actorId: "", action: "", outcome: "", from: "", to: "", page: 1 });
  });
  it("clears an inverted date range and clamps page input", () => {
    expect(parseActivityAuditFilters({ from: "2026-10-25", to: "2026-10-01", page: "999999999" })).toMatchObject({ from: "", to: "", page: 100000 });
  });
  it("handles duplicate query values and invalid page values safely", () => {
    expect(parseActivityAuditFilters({ actor: ["x", "y"], action: ["CONTACT_ARCHIVED", "OTHER"], page: "-1" })).toEqual({ actorId: "", action: "", outcome: "", from: "", to: "", page: 1 });
  });
});
