import { isContactUuid } from "@/lib/contact-intake";

export type ContactBulkAction = "ARCHIVE" | "RESTORE" | "MOVE_TO_POOL" | "SEND_TO_USER";

export function parseContactIds(form: FormData, limit = 100): string[] | null {
  const values = form.getAll("contactIds");
  if (values.length < 1 || values.length > limit || values.some(value => typeof value !== "string" || !isContactUuid(value))) return null;
  const ids = values as string[];
  return new Set(ids).size === ids.length ? ids : null;
}

export function parseContactBulkAction(value: unknown): ContactBulkAction | null {
  return value === "ARCHIVE" || value === "RESTORE" || value === "MOVE_TO_POOL" || value === "SEND_TO_USER" ? value : null;
}

export function isFourDigitExportPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

export function boundedImportValues(form: FormData, count: number): string[] | null {
  if (!Number.isSafeInteger(count) || count < 1 || count > 28) return null;
  const values: string[] = [];
  for (let index = 0; index < count; index++) {
    const entries = form.getAll(`value_${index}`);
    if (entries.length !== 1 || typeof entries[0] !== "string") return null;
    const value = entries[0];
    // eslint-disable-next-line no-control-regex -- Spreadsheet text rejects NUL and non-printing controls.
    if (value.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
    values.push(value);
  }
  return values;
}
