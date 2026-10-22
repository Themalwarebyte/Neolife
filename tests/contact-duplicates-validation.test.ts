import { describe, expect, it } from "vitest";
import {
  findDuplicateCandidates, nameCityKey, planAdditionalMethods, strictestConsent,
  DUPLICATE_SCAN_MAX_CONTACTS,
  type CandidateContact,
} from "../src/lib/contact-duplicates";

const person = (id: string, owner = "staff-a", overrides: Partial<CandidateContact> = {}): CandidateContact => ({
  id, ownerUserId: owner, ownerSnapshot: owner, firstName: "Alice", lastName: "Sample",
  city: "Nairobi", version: 1, methods: [], ...overrides,
});

describe("Batch C matching — deterministic and private", () => {
  it("matches the exact normalized email once", () => {
    const result = findDuplicateCandidates([
      person("a", "staff-a", { methods: [{ type: "EMAIL", normalizedValue: "alice@example.org" }] }),
      person("b", "staff-a", { methods: [{ type: "EMAIL", normalizedValue: "alice@example.org" }] }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ leftContactId: "a", rightContactId: "b", signals: ["EMAIL_EXACT", "NAME_CITY_EXACT"] });
  });
  it("never pairs contacts owned by different staff even with the same phone", () => {
    expect(findDuplicateCandidates([
      person("a", "staff-a", { methods: [{ type: "PHONE", normalizedValue: "+254712345678" }] }),
      person("b", "staff-b", { methods: [{ type: "PHONE", normalizedValue: "+254712345678" }] }),
    ])).toHaveLength(0);
  });
  it("uses exact full name plus city as a low-confidence signal, not name alone", () => {
    expect(nameCityKey(person("a", "staff-a", { lastName: "", city: "Nairobi" }))).toBeNull();
    expect(nameCityKey(person("a", "staff-a", { lastName: "Sample", city: null }))).toBeNull();
    expect(findDuplicateCandidates([
      person("a", "staff-a", { methods: [] }),
      person("b", "staff-a", { city: "Kisumu", methods: [] }),
    ])).toHaveLength(0);
  });
  it("normalizes case and punctuation without any silent merge", () => {
    expect(nameCityKey(person("a", "staff-a", { firstName: "  Jo-Anne  ", city: "NAIROBI" })))
      .toEqual(nameCityKey(person("b", "staff-a", { firstName: "jo anne", city: "nairobi" })));
  });
  it("rejects scans above capacity rather than writing partial findings", () => {
    const list = Array.from({ length: DUPLICATE_SCAN_MAX_CONTACTS + 1 }, (_, i) => person(String(i)));
    expect(() => findDuplicateCandidates(list)).toThrow("TOO_MANY_CONTACTS");
  });
  it("rejects huge shared-key groups and cannot form an unbounded cross-product", () => {
    const list = Array.from({ length: 25 }, (_, i) => person(String(i), "a", { methods: [{ type: "PHONE", normalizedValue: "+254712345678" }] }));
    expect(() => findDuplicateCandidates(list)).toThrow("DENSE_MATCH_KEY");
  });
  it("refuses duplicate IDs in the scanner input", () => {
    expect(() => findDuplicateCandidates([person("same"), person("same")])).toThrow("DUPLICATE_CONTACT_IDS");
  });
});

describe("Batch C safety invariants", () => {
  it("DENIED overrides GRANTED and UNKNOWN", () => {
    expect(strictestConsent("GRANTED", "DENIED")).toBe("DENIED");
    expect(strictestConsent("UNKNOWN", "GRANTED")).toBe("UNKNOWN");
    expect(strictestConsent("GRANTED", "GRANTED")).toBe("GRANTED");
  });
  it("retains existing phone and only adds new ones without inventing a primary", () => {
    const plan = planAdditionalMethods(
      [{ type: "PHONE", value: "0712345678", normalizedValue: "+254712345678", isPrimary: true }],
      [{ type: "PHONE", value: "+254712345678", normalizedValue: "+254712345678", isPrimary: true },
       { type: "PHONE", value: "0733456789", normalizedValue: "+254733456789", isPrimary: false }],
    );
    expect(plan).toMatchObject({ ok: true, additional: [{ normalizedValue: "+254733456789", isPrimary: false }] });
  });
  it("rejects a merge that exceeds the existing three-per-method limit", () => {
    const retained = [1, 2, 3].map(n => ({ type: "EMAIL" as const, value: `${n}@example.org`, normalizedValue: `${n}@example.org`, isPrimary: n === 1 }));
    expect(planAdditionalMethods(retained, [{ type: "EMAIL", value: "4@example.org", normalizedValue: "4@example.org", isPrimary: false }]).ok).toBe(false);
  });
});
