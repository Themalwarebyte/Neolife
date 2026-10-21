/**
 * Phase 28B: explainable operational triage, NOT automated qualification.
 * The signals are directly observable CRM facts; no business-eligibility
 * score, automatic contact assignment, status change, or notification.
 */
import type { Prisma } from "@/generated/prisma/client";

export type TriageView = "all" | "overdue" | "review" | "upcoming" | "unassigned";
export type TriageWindowDays = 3 | 7 | 14 | 30;
export type TriageViewer = { id: string; role: string };

const TRIAGE_VIEWS: readonly TriageView[] = ["all", "overdue", "review", "upcoming", "unassigned"];
export const TRIAGE_PAGE_SIZE = 20;
export const TRIAGE_WINDOWS: readonly TriageWindowDays[] = [3, 7, 14, 30];

function first(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export function parseTriageView(value: unknown): TriageView {
  const candidate = first(value);
  return TRIAGE_VIEWS.includes(candidate as TriageView) ? candidate as TriageView : "overdue";
}

export function parseTriageWindow(value: unknown): TriageWindowDays {
  const candidate = first(value);
  return candidate === "3" || candidate === "14" || candidate === "30"
    ? Number(candidate) as TriageWindowDays : 7;
}

export function parseTriagePage(value: unknown): number {
  const candidate = first(value);
  return /^[1-9]\d{0,3}$/.test(candidate) ? Math.min(Number(candidate), 500) : 1;
}

export function triageWindowEnd(now: Date, days: TriageWindowDays): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

/** Every query is constrained by the authenticated Staff assignment before signals are applied. */
export function buildTriageWhere(
  viewer: TriageViewer,
  view: TriageView,
  days: TriageWindowDays,
  now: Date,
): Prisma.LeadWhereInput {
  const scope: Prisma.LeadWhereInput = viewer.role === "admin" ? {} : { assignedUserId: viewer.id };
  const overdue: Prisma.LeadWhereInput = {
    followUps: { some: { completedAt: null, dueAt: { lt: now } } },
  };
  const review: Prisma.LeadWhereInput = {
    status: "QUALIFIED",
    events: { none: { type: "qualification_reviewed" } },
  };
  const upcoming: Prisma.LeadWhereInput = {
    followUps: { some: { completedAt: null, dueAt: { gte: now, lte: triageWindowEnd(now, days) } } },
  };
  const unassigned: Prisma.LeadWhereInput = { assignedUserId: null };
  const signal: Prisma.LeadWhereInput = view === "overdue" ? overdue
    : view === "review" ? review
      : view === "upcoming" ? upcoming
        : view === "unassigned" ? unassigned
          : { OR: viewer.role === "admin" ? [overdue, review, upcoming, unassigned] : [overdue, review, upcoming] };
  return { AND: [scope, signal] };
}

export type TriageEvidence = {
  status: string;
  assignedUserId: string | null;
  hasQualificationReview: boolean;
  overdueAt: Date | null;
  upcomingAt: Date | null;
};

export type TriageReason = "overdue" | "review" | "unassigned" | "upcoming";

/** Reasons are factual and may overlap; the order is presentation only, not a business score. */
export function explainTriage(evidence: TriageEvidence, now: Date): {
  reasons: TriageReason[];
  suggestedAction: string;
} {
  const reasons: TriageReason[] = [];
  if (evidence.overdueAt && evidence.overdueAt.getTime() < now.getTime()) reasons.push("overdue");
  if (evidence.status === "QUALIFIED" && !evidence.hasQualificationReview) reasons.push("review");
  if (evidence.assignedUserId === null) reasons.push("unassigned");
  if (evidence.upcomingAt && evidence.upcomingAt.getTime() >= now.getTime()) reasons.push("upcoming");
  const suggestedAction = reasons.includes("overdue") ? "Open the overdue follow-up"
    : reasons.includes("review") ? "Review the qualification answers"
      : reasons.includes("unassigned") ? "Owner: assign a Staff member"
        : reasons.includes("upcoming") ? "Prepare for the scheduled follow-up"
          : "Review the contact record";
  return { reasons, suggestedAction };
}

/** Counts overlap except `all`, which counts unique contacts needing attention. */
export type TriageTotals = Record<TriageView, number>;

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Aggregate-only export, with no names, emails, phone numbers, IDs, or free-text fields. */
export function buildTriageCsv(totals: TriageTotals, days: TriageWindowDays, at: Date): string {
  const rows: Array<Array<string | number>> = [
    ["Report", "NEOLIFE operational attention"],
    ["Generated UTC", at.toISOString()],
    ["Upcoming window (days)", days],
    [],
    ["Signal", "Contacts"],
    ["Unique contacts requiring attention", totals.all],
    ["Open overdue follow-up", totals.overdue],
    ["Qualified, awaiting office review", totals.review],
    ["Scheduled follow-up due in selected window", totals.upcoming],
    ["Unassigned contacts (Owner only)", totals.unassigned],
    [],
    ["Definitions", "Counts describe current CRM records, not automatic qualification or eligibility decisions."],
    ["Definitions", "Signals overlap: one contact may appear in multiple categories."],
  ];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
