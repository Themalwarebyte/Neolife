/** Batch D: pure contact-queue and follow-up policy. Never conflates Contacts with Leads. */
import { contactMayBeContacted, type ContactConsent } from "@/lib/contact-intake";

export type QueueDecision = "APPROVE" | "REJECT";
export type TaskKind = "INTERNAL" | "CALL" | "EMAIL";
export type TaskAction = "COMPLETE" | "CANCEL" | "RESCHEDULE";
export const CONTACT_EXPORT_LIMIT = 1000;

export function exactlyOne(form: FormData, key: string): string | null {
  const values = form.getAll(key);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}
export function validVersion(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,8}$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
export function reviewReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim().replace(/\s+/g, " ");
  // eslint-disable-next-line no-control-regex -- Audit explanations must not contain control characters.
  return reason.length >= 10 && reason.length <= 300 && !/[\u0000-\u001f\u007f]/.test(reason) ? reason : null;
}
export function followUpNote(value: unknown, min = 10, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().replace(/\r\n?/g, "\n");
  // eslint-disable-next-line no-control-regex -- Multiline notes retain LF and tab only.
  if (note.length < min || note.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) return null;
  return note;
}
export function taskKind(value: unknown): TaskKind | null {
  return value === "INTERNAL" || value === "CALL" || value === "EMAIL" ? value : null;
}
export function taskAction(value: unknown): TaskAction | null {
  return value === "COMPLETE" || value === "CANCEL" || value === "RESCHEDULE" ? value : null;
}
/** Accept only ISO-8601 UTC values from the browser; no timezone reinterpretation. */
export function followUpDue(value: unknown, now = new Date()): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) return null;
  const delta = date.getTime() - now.getTime();
  return delta >= 60_000 && delta <= 366 * 86_400_000 ? date : null;
}
export function mayScheduleOutreach(contact: {
  state: string; consentStatus: ContactConsent; doNotContact: boolean;
  consentEvidence: string | null; consentUpdatedAt: Date | null;
}): boolean {
  return contact.state === "MAIN" && contactMayBeContacted(contact) &&
    !!contact.consentUpdatedAt && !!contact.consentEvidence && contact.consentEvidence.trim().length >= 10;
}

/** A CSV value must not become an Excel/LibreOffice formula, even with whitespace. */
export function contactCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function csvRows(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return "\uFEFF" + rows.map(columns => columns.map(contactCsvCell).join(",")).join("\r\n") + "\r\n";
}
