/**
 * Task 1.7 — lead status + follow-up validation (pure, testable).
 * Deliberately simple: membership in the approved enum only. No workflow engine.
 *
 * NOTE: statuses are declared here (not imported from the generated Prisma
 * client) so this module stays client-safe — the generated client is Node-only
 * and must never be bundled into a client component.
 */

export const VALID_LEAD_STATUSES = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "REGISTERED",
  "MEETING_SCHEDULED",
  "MEETING_ATTENDED",
  "FOLLOW_UP",
  "CONVERTED",
  "NOT_INTERESTED",
  "DISQUALIFIED",
] as const;

const MAX_FOLLOW_UP_LENGTH = 2000;

/** Validates a requested status change; returns the status or null. */
export function parseStatusChange(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (VALID_LEAD_STATUSES as readonly string[]).includes(trimmed)
    ? trimmed
    : null;
}

/** Validates a follow-up note; returns the trimmed note or null. */
export function parseFollowUpNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_FOLLOW_UP_LENGTH) return null;
  return trimmed;
}
