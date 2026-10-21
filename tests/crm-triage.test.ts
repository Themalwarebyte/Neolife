import { describe, expect, it } from "vitest";
import {
  buildTriageCsv,
  buildTriageWhere,
  explainTriage,
  parseTriagePage,
  parseTriageView,
  parseTriageWindow,
  triageWindowEnd,
} from "@/lib/crm-triage";

const now = new Date("2026-10-21T12:00:00.000Z");
const plusHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

describe("Phase 28B explainable operational triage", () => {
  it("parses only whitelisted filters, including array query values", () => {
    expect(parseTriageView("review")).toBe("review");
    expect(parseTriageView(["upcoming", "all"])).toBe("upcoming");
    expect(parseTriageView("../../admin/users")).toBe("overdue");
    expect(parseTriageWindow("3")).toBe(3);
    expect(parseTriageWindow("14")).toBe(14);
    expect(parseTriageWindow("30")).toBe(30);
    expect(parseTriageWindow("999999")).toBe(7);
    expect(parseTriageWindow(["14", "7"])).toBe(14);
    expect(parseTriagePage("30")).toBe(30);
    expect(parseTriagePage("9999")).toBe(500);
    expect(parseTriagePage("0")).toBe(1);
    expect(parseTriagePage("1e4")).toBe(1);
  });
  it("computes exact boundaries for upcoming task windows", () => {
    expect(triageWindowEnd(now, 3).toISOString()).toBe("2026-10-24T12:00:00.000Z");
    expect(triageWindowEnd(now, 30).toISOString()).toBe("2026-11-20T12:00:00.000Z");
  });
  it("always scopes Staff selection before evaluating any signal", () => {
    const owner = buildTriageWhere({ id: "owner", role: "admin" }, "all", 7, now);
    const staff = buildTriageWhere({ id: "staff-A", role: "staff" }, "all", 7, now);
    expect(JSON.stringify(owner)).not.toContain("staff-A");
    expect(JSON.stringify(staff)).toContain('"assignedUserId":"staff-A"');
    expect(JSON.stringify(staff)).not.toContain('"assignedUserId":null');
  });
  it("never gives a Staff member an unscoped unassigned-lead query", () => {
    const query = buildTriageWhere({ id: "staff-A", role: "staff" }, "unassigned", 7, now);
    expect(query).toEqual({ AND: [{ assignedUserId: "staff-A" }, { assignedUserId: null }] });
  });
  it("only includes incomplete scheduled tasks in the query", () => {
    const overdue = buildTriageWhere({ id: "staff-A", role: "staff" }, "overdue", 7, now);
    expect(JSON.stringify(overdue)).toContain('"completedAt":null');
    expect(JSON.stringify(overdue)).toContain('"lt":"2026-10-21T12:00:00.000Z"');
  });
  it("never guesses commercial eligibility from interests or customer values", () => {
    expect(explainTriage({ status: "QUALIFIED", assignedUserId: "staff-A", hasQualificationReview: false, overdueAt: null, upcomingAt: null }, now))
      .toEqual({ reasons: ["review"], suggestedAction: "Review the qualification answers" });
    expect(explainTriage({ status: "CONVERTED", assignedUserId: "staff-A", hasQualificationReview: false, overdueAt: null, upcomingAt: null }, now))
      .toEqual({ reasons: [], suggestedAction: "Review the contact record" });
  });
  it("presents overlapping operational signals without rewriting a status", () => {
    const result = explainTriage({
      status: "QUALIFIED", assignedUserId: null, hasQualificationReview: false,
      overdueAt: plusHours(-2), upcomingAt: plusHours(3),
    }, now);
    expect(result.reasons).toEqual(["overdue", "review", "unassigned", "upcoming"]);
    expect(result.suggestedAction).toBe("Open the overdue follow-up");
  });
  it("ignores completed/nonoverdue signals supplied with a nonpast date", () => {
    const result = explainTriage({
      status: "CONTACTED", assignedUserId: "staff-A", hasQualificationReview: true,
      overdueAt: plusHours(1), upcomingAt: plusHours(-1),
    }, now);
    expect(result.reasons).toEqual([]);
  });
  it("exports role-scoped aggregate totals without any lead-level PII", () => {
    const csv = buildTriageCsv({ all: 4, overdue: 2, review: 3, upcoming: 2, unassigned: 1 }, 14, now);
    expect(csv.startsWith('"Report","NEOLIFE operational attention"\r\n')).toBe(true);
    expect(csv).toContain('"Unique contacts requiring attention","4"');
    expect(csv).toContain('"Upcoming window (days)","14"');
    expect(csv).toContain("Signals overlap");
    expect(csv).not.toContain("firstName");
    expect(csv).not.toContain("email");
    expect(csv).not.toContain("phone");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
