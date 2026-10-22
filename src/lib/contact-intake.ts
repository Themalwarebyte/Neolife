/**
 * Contact Intake Batch A. Pure validation and permission predicates shared by
 * the server actions, pages and tests. This domain is intentionally separate
 * from Lead/LeadStatus and never creates an office sales pipeline record.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { isValidOfficeEmail, normalizeOfficeEmail } from "@/lib/office-form-validation";

export type ContactConsent = "UNKNOWN" | "GRANTED" | "DENIED";
export type ContactMethodType = "PHONE" | "EMAIL";
export type ContactMethodInput = {
  type: ContactMethodType;
  value: string;
  normalizedValue: string;
  isPrimary: boolean;
};
export type ManualContactInput = {
  firstName: string;
  lastName: string | null;
  city: string | null;
  sourceDetail: string | null;
  notes: string | null;
  consentEvidence: string | null;
  consentStatus: ContactConsent;
  doNotContact: boolean;
  methods: ContactMethodInput[];
};
export type ContactInputResult =
  | { ok: true; value: ManualContactInput }
  | { ok: false; message: string };

function readField(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  if (values.length > 1) return null;
  return values.length === 0 ? "" : typeof values[0] === "string" ? values[0] : null;
}
function safeText(input: string, max: number): string | null {
  const normalized = input.trim().replace(/\s+/g, " ");
  // eslint-disable-next-line no-control-regex -- Intentionally reject ASCII control characters.
  if (normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}
function safeMultiline(input: string, max: number): string | null {
  const normalized = input.trim().replace(/\r\n?/g, "\n");
  // eslint-disable-next-line no-control-regex -- Preserve line feeds and tabs while rejecting other controls.
  if (normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

/** Kenyan national numbers (07/01) or explicit international +country numbers. */
export function normalizeContactPhone(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 40 || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  try {
    const parsed = parsePhoneNumberFromString(raw, { defaultCountry: "KE", extract: false });
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

function parseMethods(form: FormData):
  | { ok: true; methods: ContactMethodInput[] }
  | { ok: false; message: string } {
  const phones = form.getAll("phones");
  const emails = form.getAll("emails");
  if (phones.length > 3 || emails.length > 3 || phones.some(v => typeof v !== "string") || emails.some(v => typeof v !== "string")) {
    return { ok: false, message: "Provide no more than three phone numbers and three email addresses." };
  }
  const methods: ContactMethodInput[] = [];
  for (const [type, values] of [["PHONE", phones], ["EMAIL", emails]] as const) {
    let primary = true;
    const seen = new Set<string>();
    for (const item of values) {
      const value = (item as string).trim();
      if (!value) continue;
      const normalizedValue = type === "PHONE" ? normalizeContactPhone(value) :
        (isValidOfficeEmail(value) && !/[\r\n<>]/.test(value) ? normalizeOfficeEmail(value) : null);
      if (!normalizedValue) return {
        ok: false,
        message: type === "PHONE" ? "Enter a valid Kenya national or +international phone number." : "Enter a valid email address.",
      };
      if (seen.has(normalizedValue)) return { ok: false, message: `The same ${type.toLowerCase()} was entered twice.` };
      seen.add(normalizedValue);
      methods.push({ type, value, normalizedValue, isPrimary: primary });
      primary = false;
    }
  }
  if (methods.length === 0) return { ok: false, message: "Enter at least one phone number or email address." };
  return { ok: true, methods };
}

export function parseManualContactData(form: FormData): ContactInputResult {
  const required = ["firstName", "lastName", "city", "sourceDetail", "notes", "consentStatus", "consentEvidence"] as const;
  const values: Record<string, string> = {};
  for (const key of required) {
    const raw = readField(form, key);
    if (raw === null) return { ok: false, message: `Invalid ${key} field.` };
    values[key] = raw;
  }
  const firstName = safeText(values.firstName, 80);
  const lastName = safeText(values.lastName, 80);
  const city = safeText(values.city, 100);
  const sourceDetail = safeText(values.sourceDetail, 160);
  const notes = safeMultiline(values.notes, 4000);
  const consentEvidence = safeText(values.consentEvidence, 200);
  if (!firstName || lastName === null || city === null || sourceDetail === null || notes === null || consentEvidence === null) {
    return { ok: false, message: "Check the name, city, source and notes lengths and characters." };
  }
  if (!["UNKNOWN", "GRANTED", "DENIED"].includes(values.consentStatus)) {
    return { ok: false, message: "Select a valid consent status." };
  }
  if (values.consentStatus === "GRANTED" && (!consentEvidence || consentEvidence.length < 10)) {
    return { ok: false, message: "Record how and when permission was granted (at least 10 characters)." };
  }
  const dncEntries = form.getAll("doNotContact");
  if (dncEntries.length > 1 || dncEntries.some(v => typeof v !== "string" || v !== "on")) {
    return { ok: false, message: "Invalid Do Not Contact selection." };
  }
  const methods = parseMethods(form);
  if (!methods.ok) return methods;
  return {
    ok: true,
    value: {
      firstName,
      lastName: lastName || null,
      city: city || null,
      sourceDetail: sourceDetail || null,
      notes: notes || null,
      consentEvidence: values.consentStatus === "UNKNOWN" ? null : consentEvidence || null,
      consentStatus: values.consentStatus as ContactConsent,
      doNotContact: dncEntries.length === 1,
      methods: methods.methods,
    },
  };
}

export function contactListScope(role: string, userId: string, requestedAll: boolean): { ownerUserId?: string } {
  // Staff and future promoter roles can NEVER escalate via a URL query.
  return role === "admin" && requestedAll ? {} : { ownerUserId: userId };
}
export function contactRecordScope(role: string, userId: string): { ownerUserId?: string } {
  return role === "admin" ? {} : { ownerUserId: userId };
}
export function isContactUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function parseContactVersion(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? date : null;
}

/** Required gate for any future contact communication workflow. DNC wins. */
export function contactMayBeContacted(contact: { consentStatus: ContactConsent; doNotContact: boolean }): boolean {
  return contact.consentStatus === "GRANTED" && !contact.doNotContact;
}
