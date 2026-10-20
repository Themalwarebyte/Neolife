/** Pure helpers for qualification triage and bounded CRM analytics windows. */
export type QualificationQueueView = "needs-review" | "reviewed" | "all";
export type CrmAnalyticsRange = "7d" | "30d" | "90d" | "365d";

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export function parseQualificationQueueView(value: unknown): QualificationQueueView {
  const candidate = firstString(value).trim();
  return candidate === "reviewed" || candidate === "all" ? candidate : "needs-review";
}

export function parseCrmPage(value: unknown): number {
  const candidate = firstString(value).trim();
  if (!/^[1-9]\d{0,3}$/.test(candidate)) return 1;
  return Math.min(Number(candidate), 500);
}

export function parseCrmAnalyticsRange(value: unknown): CrmAnalyticsRange {
  const candidate = firstString(value).trim();
  return candidate === "7d" || candidate === "90d" || candidate === "365d"
    ? candidate
    : "30d";
}

export function crmAnalyticsRangeStart(
  range: CrmAnalyticsRange,
  now: Date = new Date(),
): Date {
  const days: Record<CrmAnalyticsRange, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
  };
  return new Date(now.getTime() - days[range] * 24 * 60 * 60 * 1000);
}

export function qualificationReviewState(hasReviewEvent: boolean): "reviewed" | "needs-review" {
  return hasReviewEvent ? "reviewed" : "needs-review";
}
