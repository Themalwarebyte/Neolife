/** Browser-safe import field names and mapping rules. */
import type { ManualContactInput } from "@/lib/contact-intake";
export const IMPORT_FIELDS = [
  "fullName", "firstName", "lastName", "city", "phone1", "phone2", "phone3",
  "email1", "email2", "email3", "sourceDetail", "notes", "consentStatus",
  "consentEvidence", "doNotContact",
] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
export type ImportMapping = Record<ImportField, number | null>;
export type UploadedSheet = {
  headers: string[];
  rows: { rowNumber: number; values: string[] }[];
  fileSha256: string;
  fileType: "CSV" | "XLSX";
};
export type ParsedImportRow = { ok: true; value: ManualContactInput } | { ok: false; message: string };

const headerAliases: Record<ImportField, string[]> = {
  fullName: ["fullname", "contactname", "name", "customername"],
  firstName: ["firstname", "givenname", "forename", "fname"],
  lastName: ["lastname", "surname", "familyname", "lname"],
  city: ["city", "town", "location"],
  phone1: ["phone", "phone1", "phonenumber", "mobile", "mobile1", "telephone", "tel", "cell"],
  phone2: ["phone2", "alternatephone", "alternativephone", "mobile2", "secondphone", "otherphone"],
  phone3: ["phone3", "mobile3", "thirdphone"],
  email1: ["email", "email1", "emailaddress", "mail"],
  email2: ["email2", "alternateemail", "alternativeemail", "secondaryemail"],
  email3: ["email3", "thirdemail"],
  sourceDetail: ["source", "sourcedetail", "leadsource", "contactsource"],
  notes: ["notes", "note", "comments", "remark", "remarks"],
  consentStatus: ["consent", "consentstatus", "permission", "optin"],
  consentEvidence: ["consentevidence", "permissionevidence", "consentproof"],
  doNotContact: ["donotcontact", "dnc", "optout", "unsubscribe"],
};

export function emptyMapping(): ImportMapping {
  return Object.fromEntries(IMPORT_FIELDS.map(k => [k, null])) as ImportMapping;
}
export function guessMapping(headers: string[]): ImportMapping {
  const mapping = emptyMapping();
  const used = new Set<number>();
  headers.forEach((raw, i) => {
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const key of IMPORT_FIELDS) {
      if (mapping[key] === null && !used.has(i) && headerAliases[key].includes(normalized)) {
        mapping[key] = i;
        used.add(i);
        break;
      }
    }
  });
  return mapping;
}
export function readMapping(form: FormData, columns: number): { ok: true; mapping: ImportMapping } | { ok: false; message: string } {
  const mapping = emptyMapping();
  const seen = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const entries = form.getAll(`map_${field}`);
    if (entries.length !== 1 || typeof entries[0] !== "string") return { ok: false, message: `Invalid mapping for ${field}.` };
    const raw = entries[0];
    if (raw === "") continue;
    if (!/^\d+$/.test(raw)) return { ok: false, message: `Invalid column for ${field}.` };
    const index = Number(raw);
    if (!Number.isSafeInteger(index) || index >= columns || seen.has(index)) return { ok: false, message: "Each import column may be mapped only once." };
    seen.add(index);
    mapping[field] = index;
  }
  if (mapping.firstName === null && mapping.fullName === null) return { ok: false, message: "Map either First name or Full name." };
  if (![mapping.phone1, mapping.phone2, mapping.phone3, mapping.email1, mapping.email2, mapping.email3].some(v => v !== null)) {
    return { ok: false, message: "Map at least one phone or email column." };
  }
  return { ok: true, mapping };
}
