/**
 * Phase 28A — pure, deterministic CRM workflow validation.
 * No automatic business-policy decisions: office users select each action.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const MAX_WORKFLOW_BATCH = 25;

export type SelectionResult =
  | { valid: true; ids: string[] }
  | { valid: false; message: string };

/** Strictly reject duplicates, unrecognized IDs, and oversized submissions. */
export function parseWorkflowSelection(values: unknown[]): SelectionResult {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_WORKFLOW_BATCH) {
    return { valid: false, message: `Select between 1 and ${MAX_WORKFLOW_BATCH} items.` };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !UUID.test(value)) {
      return { valid: false, message: "The selection contains an invalid ID." };
    }
    const id = value.toLowerCase();
    if (seen.has(id)) {
      return { valid: false, message: "The selection includes a duplicate item." };
    }
    seen.add(id);
    ids.push(id);
  }
  return { valid: true, ids };
}

/** Existing task timestamp can be in the past, but must be a real UTC instant. */
export function parseExpectedTaskDate(value: unknown): Date | null {
  if (typeof value !== "string" || !UTC_ISO.test(value)) return null;
  const date = new Date(value);
  const canonical = Number.isFinite(date.getTime()) ? date.toISOString() : "";
  return canonical && (canonical === value || canonical.replace(".000Z", "Z") === value)
    ? date
    : null;
}

/** True for a genuinely changed due date; unchanged submissions are idempotent. */
export function isChangedTaskDueAt(current: Date, requested: Date): boolean {
  return current.getTime() !== requested.getTime();
}
