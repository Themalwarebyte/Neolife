/**
 * Contact Intake Batch C — deterministic, owner-isolated candidate discovery.
 * Matches are suggestions for a human, never proof of identity or Lead creation.
 * Pure functions can be verified without a database or user session.
 */
import type { ContactConsent, ContactMethodInput } from "@/lib/contact-intake";

export type DuplicateSignal = "EMAIL_EXACT" | "PHONE_EXACT" | "NAME_CITY_EXACT";
export const DUPLICATE_SCAN_MAX_CONTACTS = 2000;
export const DUPLICATE_SCAN_MAX_PAIRS = 500;
export const DUPLICATE_SCAN_MAX_SHARED_KEY = 24;

export type CandidateContact = {
  id: string;
  ownerUserId: string | null;
  ownerSnapshot: string;
  firstName: string;
  lastName: string | null;
  city: string | null;
  version: number;
  methods: { type: "PHONE" | "EMAIL"; normalizedValue: string }[];
};
export type DuplicateCandidate = {
  ownerUserId: string;
  ownerSnapshot: string;
  leftContactId: string;
  rightContactId: string;
  leftVersion: number;
  rightVersion: number;
  signals: DuplicateSignal[];
};

function normalizedWords(input: string): string {
  return input.normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
}

export function nameCityKey(contact: Pick<CandidateContact, "firstName" | "lastName" | "city">): string | null {
  const first = normalizedWords(contact.firstName);
  const last = normalizedWords(contact.lastName || "");
  const city = normalizedWords(contact.city || "");
  // Names alone are far too common. Only compare complete name + city.
  return first && last && city ? `${first}|${last}|${city}` : null;
}

/** Throws on an unbounded result rather than silently giving incomplete review. */
export function findDuplicateCandidates(contacts: CandidateContact[]): DuplicateCandidate[] {
  if (contacts.length > DUPLICATE_SCAN_MAX_CONTACTS) throw new Error("TOO_MANY_CONTACTS");
  const byId = new Map(contacts.map(contact => [contact.id, contact]));
  if (byId.size !== contacts.length) throw new Error("DUPLICATE_CONTACT_IDS");
  const buckets = new Map<string, Set<string>>();
  const add = (key: string, id: string) => {
    const current = buckets.get(key) || new Set<string>();
    current.add(id);
    buckets.set(key, current);
  };
  for (const c of contacts) {
    // Missing owners are recoverable by Owner, but never independently matchable.
    if (!c.ownerUserId) continue;
    const name = nameCityKey(c);
    if (name) add(JSON.stringify([c.ownerUserId, "NAME_CITY_EXACT", name]), c.id);
    for (const m of c.methods) {
      if (m.normalizedValue) add(JSON.stringify([c.ownerUserId, m.type === "EMAIL" ? "EMAIL_EXACT" : "PHONE_EXACT", m.normalizedValue]), c.id);
    }
  }
  const pairs = new Map<string, { ids: [string, string]; signals: Set<DuplicateSignal> }>();
  for (const [bucket, ids] of buckets) {
    if (ids.size > DUPLICATE_SCAN_MAX_SHARED_KEY) throw new Error("DENSE_MATCH_KEY");
    if (ids.size < 2) continue;
    const signal = JSON.parse(bucket)[1] as DuplicateSignal;
    const sorted = [...ids].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const id1 = sorted[i], id2 = sorted[j];
        const key = `${id1}|${id2}`;
        const found = pairs.get(key) || { ids: [id1, id2] as [string, string], signals: new Set<DuplicateSignal>() };
        found.signals.add(signal);
        pairs.set(key, found);
        if (pairs.size > DUPLICATE_SCAN_MAX_PAIRS) throw new Error("TOO_MANY_PAIRS");
      }
    }
  }
  return [...pairs.values()].map(({ ids, signals }) => {
    const left = byId.get(ids[0])!;
    const right = byId.get(ids[1])!;
    // Defensive: no issue may ever pair staff-owned records with different owners.
    if (!left.ownerUserId || left.ownerUserId !== right.ownerUserId) throw new Error("CROSS_OWNER_MATCH");
    return {
      ownerUserId: left.ownerUserId, ownerSnapshot: left.ownerSnapshot,
      leftContactId: left.id, rightContactId: right.id,
      leftVersion: left.version, rightVersion: right.version,
      signals: (["EMAIL_EXACT", "PHONE_EXACT", "NAME_CITY_EXACT"] as const).filter(s => signals.has(s)),
    };
  }).sort((a, b) => a.leftContactId.localeCompare(b.leftContactId) || a.rightContactId.localeCompare(b.rightContactId));
}

/** Most restrictive consent wins. Neither merge nor an import can grant consent. */
export function strictestConsent(a: ContactConsent, b: ContactConsent): ContactConsent {
  if (a === "DENIED" || b === "DENIED") return "DENIED";
  return a === "GRANTED" && b === "GRANTED" ? "GRANTED" : "UNKNOWN";
}

export type MergeMethod = Pick<ContactMethodInput, "type" | "value" | "normalizedValue" | "isPrimary">;
/** Preserve the retained contact's methods first, never lose additional numbers. */
export function planAdditionalMethods(retained: MergeMethod[], source: MergeMethod[]): { ok: true; additional: MergeMethod[] } | { ok: false; message: string } {
  const seen = new Set(retained.map(m => `${m.type}:${m.normalizedValue}`));
  const counters = { PHONE: retained.filter(m => m.type === "PHONE").length, EMAIL: retained.filter(m => m.type === "EMAIL").length };
  const additional: MergeMethod[] = [];
  for (const m of source) {
    const key = `${m.type}:${m.normalizedValue}`;
    if (seen.has(key)) continue;
    if (counters[m.type] >= 3) return { ok: false, message: `Keep or edit ${m.type.toLowerCase()} details before merging: the retained contact would exceed three.` };
    additional.push({ type: m.type, value: m.value, normalizedValue: m.normalizedValue, isPrimary: counters[m.type] === 0 });
    seen.add(key);
    counters[m.type]++;
  }
  return { ok: true, additional };
}

/** Review priority is a cue, not an identity probability or automated decision. */
export function duplicateReviewPriority(values: unknown): "Higher-priority" | "Review" | "Contextual" {
  if (!Array.isArray(values)) return "Contextual";
  if (values.includes("EMAIL_EXACT")) return "Higher-priority";
  if (values.includes("PHONE_EXACT")) return "Review";
  return "Contextual";
}

export const DUPLICATE_SIGNAL_LABELS: Record<DuplicateSignal, string> = {
  EMAIL_EXACT: "Matching email address",
  PHONE_EXACT: "Matching phone number (may be shared)",
  NAME_CITY_EXACT: "Matching full name and city",
};

export function displayDuplicateSignals(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((s): s is DuplicateSignal => typeof s === "string" && Object.hasOwn(DUPLICATE_SIGNAL_LABELS, s))
    .map(s => DUPLICATE_SIGNAL_LABELS[s]);
}
