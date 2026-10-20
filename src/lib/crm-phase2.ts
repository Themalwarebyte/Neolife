/**
 * Phase 27 / Phase 2 — pure CRM search and follow-up scheduling utilities.
 * No database, Node-specific, or generated Prisma imports: safe for forms/tests.
 */
import { VALID_LEAD_STATUSES } from "@/lib/leadManagement";

export const CRM_PAGE_SIZE = 25;
export const FOLLOW_UP_PAGE_SIZE = 25;
export const CRM_INTERESTS = ["BUSINESS", "PRODUCT", "BOTH", "UNSURE"] as const;

export type LeadFilters = {
  q: string;
  status: string;
  interest: string;
  assignment: string;
  page: number;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isIn(value: string, choices: readonly string[]): boolean {
  return choices.includes(value);
}

export function parseLeadFilters(
  params: Record<string, string | string[] | undefined>,
  isOwner: boolean,
): LeadFilters {
  const q = first(params.q).trim().slice(0, 100);
  const status = first(params.status).trim();
  const interest = first(params.interest).trim();
  const assignment = first(params.assignment).trim();
  const rawPage = first(params.page);
  // Parse a strictly positive decimal, not JavaScript's permissive parseInt.
  const page = /^[1-9]\d{0,4}$/.test(rawPage) ? Math.min(Number(rawPage), 10000) : 1;
  return {
    q,
    status: isIn(status, VALID_LEAD_STATUSES) ? status : "",
    interest: isIn(interest, CRM_INTERESTS) ? interest : "",
    assignment: isOwner ? assignment.slice(0, 70) : "mine",
    page,
  };
}

export function leadQueryString(
  filters: LeadFilters,
  page: number,
): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.status) p.set("status", filters.status);
  if (filters.interest) p.set("interest", filters.interest);
  if (filters.assignment && filters.assignment !== "all" && filters.assignment !== "mine") {
    p.set("assignment", filters.assignment);
  }
  if (page > 1) p.set("page", String(page));
  const query = p.toString();
  return `/admin/leads${query ? `?${query}` : ""}`;
}

/**
 * UTC timestamp from the browser's `new Date(datetimeLocal).toISOString()`.
 * Empty value represents a historical-style note without a scheduled task.
 * A malformed/past/far-future timestamp is rejected rather than mis-scheduled.
 */
export function parseFollowUpDueAt(
  value: unknown,
  now: Date = new Date(),
): { dueAt: Date | null; valid: boolean } {
  if (value === null || value === undefined || value === "") {
    return { dueAt: null, valid: true };
  }
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return { dueAt: null, valid: false };
  }
  const dueAt = new Date(value);
  const timestamp = dueAt.getTime();
  if (
    !Number.isFinite(timestamp) ||
    timestamp < now.getTime() - 60_000 ||
    timestamp > now.getTime() + 2 * 366 * 86_400_000
  ) {
    return { dueAt: null, valid: false };
  }
  return { dueAt, valid: true };
}

export type FollowUpWindow = "all" | "overdue" | "next7";
export function parseFollowUpWindow(value: unknown): FollowUpWindow {
  return value === "overdue" || value === "next7" ? value : "all";
}

export function followUpLabel(dueAt: Date | null, completedAt: Date | null, now: Date): string {
  if (!dueAt) return "Note";
  if (completedAt) return "Completed";
  if (dueAt.getTime() < now.getTime()) return "Overdue";
  return "Scheduled";
}

export function formatCrmStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

export function percentOf(part: number, total: number): string {
  if (total <= 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}
