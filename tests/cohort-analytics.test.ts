import { describe, expect, it } from "vitest";
import {
  buildCohortAnalytics,
  buildCohortCsv,
  formatCohortRate,
  sanitizeCsvText,
  type CohortEvent,
  type CohortLead,
} from "../src/lib/cohort-analytics";

const leads: CohortLead[] = [
  { id: "a", firstTouchSource: "facebook", utmCampaign: "october", status: "QUALIFIED" },
  { id: "b", firstTouchSource: "facebook", utmCampaign: "october", status: "CONVERTED" },
  { id: "c", firstTouchSource: null, utmCampaign: null, status: "NEW_LEAD" },
  { id: "d", firstTouchSource: "google", utmCampaign: "search", status: "CONVERTED" },
];

describe("Phase 27C cohort analytics", () => {
  it("counts unique lead progression events rather than duplicate event rows", () => {
    const events: CohortEvent[] = [
      { leadId: "a", type: "lead_qualified" },
      { leadId: "a", type: "lead_qualified" },
      { leadId: "b", type: "lead_qualified" },
      { leadId: "b", type: "registration_complete" },
      { leadId: "b", type: "registration_complete" },
      { leadId: "outside-cohort", type: "lead_qualified" },
      { leadId: null, type: "registration_complete" },
      { leadId: "a", type: "unknown_event" },
    ];
    const result = buildCohortAnalytics(leads, events, []);
    expect(result.overall.leadsCaptured).toBe(4);
    expect(result.overall.qualifiedLeads).toBe(2);
    expect(result.overall.qualifiedRate).toBe(50);
    expect(result.overall.productInterestLeads).toBe(1);
    expect(result.overall.productInterestRate).toBe(25);
    expect(result.overall.currentlyConverted).toBe(2);
    expect(result.overall.convertedRate).toBe(50);
  });

  it("groups source and campaign independently and labels missing attribution", () => {
    const result = buildCohortAnalytics(leads, [], []);
    expect(result.sourceRows).toHaveLength(3);
    expect(result.sourceRows[0]).toMatchObject({ source: "facebook", campaign: "october", leadsCaptured: 2 });
    expect(result.sourceRows.some((row) => row.source === "Direct / unknown" && row.campaign === "No campaign captured")).toBe(true);
  });

  it("calculates follow-up completion for scheduled tasks only supplied by the server query", () => {
    const result = buildCohortAnalytics(leads, [], [
      { completedAt: new Date("2026-10-20T10:00:00.000Z") },
      { completedAt: null },
      { completedAt: null },
    ]);
    expect(result.followUps).toEqual({ scheduledDuringWindow: 3, completedScheduledTasks: 1, completionRate: 33.3 });
  });

  it("is zero-safe for empty cohorts and empty follow-up sets", () => {
    const result = buildCohortAnalytics([], [], []);
    expect(result.overall).toEqual({
      leadsCaptured: 0,
      qualifiedLeads: 0,
      productInterestLeads: 0,
      currentlyConverted: 0,
      qualifiedRate: 0,
      productInterestRate: 0,
      convertedRate: 0,
    });
    expect(result.followUps.completionRate).toBe(0);
    expect(formatCohortRate(0)).toBe("0.0%");
  });

  it("sanitizes spreadsheet formula prefixes and preserves CSV quotes", () => {
    expect(sanitizeCsvText("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvText("  @SUM(A1:A2)")).toBe("'  @SUM(A1:A2)");
    expect(sanitizeCsvText("\u0000\t=1+1")).toBe("'\u0000\t=1+1");
    expect(sanitizeCsvText("ordinary source")).toBe("ordinary source");
    const result = buildCohortAnalytics([
      { id: "x", firstTouchSource: "=cmd,with \"quotes\"", utmCampaign: "safe", status: "NEW_LEAD" },
    ], [], []);
    const csv = buildCohortCsv(result, "30d", new Date("2026-10-20T12:00:00.000Z"));
    expect(csv).toContain("\"'=cmd,with \"\"quotes\"\"\"");
    expect(csv).toContain("NEOLIFE CRM cohort progression");
    expect(csv).not.toContain("phone");
    expect(csv).not.toContain("email");
  });
});
