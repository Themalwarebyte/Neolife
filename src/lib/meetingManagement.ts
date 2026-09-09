/**
 * Task 1.8 — meeting (office pipeline) validation helpers.
 * Pure and client-safe (no Prisma/generated-client import).
 */

export const VALID_MEETING_STATUSES = [
  "SCHEDULED",
  "ATTENDED",
  "NO_SHOW",
  "CANCELLED",
  "RESCHEDULED",
] as const;

const MAX_TEXT = 500;

/** Validates a requested meeting status; returns the status or null. */
export function parseMeetingStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (VALID_MEETING_STATUSES as readonly string[]).includes(trimmed)
    ? trimmed
    : null;
}

/** Validates a datetime input; returns a Date or null. */
export function parseScheduledAt(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Validates optional free-text (outcome/notes).
 * Returns undefined for empty (leave unset), null for invalid (too long).
 */
export function parseOptionalText(
  value: unknown,
  max = MAX_TEXT,
): string | undefined | null {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > max) return null;
  return trimmed;
}
