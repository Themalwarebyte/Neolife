import { describe, expect, it } from "vitest";
import {
  contactMayBeContacted,
  contactListScope,
  contactRecordScope,
  isContactUuid,
  normalizeContactPhone,
  parseContactVersion,
  parseManualContactData,
} from "../src/lib/contact-intake";

function makeForm(values: {
  firstName?: string; lastName?: string; city?: string; sourceDetail?: string;
  notes?: string; consentStatus?: string; consentEvidence?: string; phones?: string[]; emails?: string[]; doNotContact?: boolean;
} = {}): FormData {
  const fd = new FormData();
  fd.set("firstName", values.firstName ?? "Njeri");
  fd.set("lastName", values.lastName ?? "Kamau");
  fd.set("city", values.city ?? "Nairobi");
  fd.set("sourceDetail", values.sourceDetail ?? "A referral");
  fd.set("notes", values.notes ?? "No outbound messaging authorized");
  fd.set("consentStatus", values.consentStatus ?? "UNKNOWN");
  fd.set("consentEvidence", values.consentEvidence ?? "");
  for (const value of values.phones ?? ["0712345678"]) fd.append("phones", value);
  for (const value of values.emails ?? ["Njeri@Example.com"]) fd.append("emails", value);
  if (values.doNotContact) fd.set("doNotContact", "on");
  return fd;
}

describe("Batch A — private contact intake validation", () => {
  it("normalizes Kenya national and +country phones to E.164", () => {
    expect(normalizeContactPhone("0712345678")).toBe("+254712345678");
    expect(normalizeContactPhone("+254 712 345 678")).toBe("+254712345678");
    expect(normalizeContactPhone("+44 7911 123456")).toBe("+447911123456");
  });
  it("rejects malformed phone numbers and extensions", () => {
    for (const input of ["07123", "+254712345678 ext. 123", "0712345678; rm -rf", "++254712345678", "abc"]) {
      expect(normalizeContactPhone(input)).toBeNull();
    }
  });
  it("keeps multiple independent methods and consent defaults without implicit lead status", () => {
    const parsed = parseManualContactData(makeForm({
      phones: ["0712345678", "+254733456789"],
      emails: ["Njeri@Example.com", "njeri.work@example.org"],
    }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.consentStatus).toBe("UNKNOWN");
    expect(parsed.value.doNotContact).toBe(false);
    expect(parsed.value.methods).toHaveLength(4);
    expect(parsed.value.methods[0]).toMatchObject({ type: "PHONE", normalizedValue: "+254712345678", isPrimary: true });
    expect(parsed.value.methods[1].isPrimary).toBe(false);
    expect(parsed.value.methods[2]).toMatchObject({ type: "EMAIL", normalizedValue: "njeri@example.com", isPrimary: true });
    expect(Object.keys(parsed.value)).not.toContain("status");
  });
  it("accepts email-only manual contacts", () => {
    const parsed = parseManualContactData(makeForm({ phones: [] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.methods).toHaveLength(1);
  });
  it("rejects contacts without any reachable method", () => {
    expect(parseManualContactData(makeForm({ phones: [], emails: [] })).ok).toBe(false);
  });
  it("rejects duplicate phones even with differently formatted inputs", () => {
    const parsed = parseManualContactData(makeForm({ phones: ["0712345678", "+254 712 345 678"] }));
    expect(parsed.ok).toBe(false);
  });
  it("rejects duplicate normalized emails", () => {
    expect(parseManualContactData(makeForm({ emails: ["NJERI@EXAMPLE.COM", "njeri@example.com"] })).ok).toBe(false);
  });
  it("rejects oversized/extra-method submissions", () => {
    const parsed = parseManualContactData(makeForm({ phones: Array(4).fill("0712345678") }));
    expect(parsed.ok).toBe(false);
    expect(parseManualContactData(makeForm({ firstName: "x".repeat(81) })).ok).toBe(false);
    expect(parseManualContactData(makeForm({ notes: "x".repeat(4001) })).ok).toBe(false);
  });
  it("rejects forged consent states and malformed DNC selectors", () => {
    expect(parseManualContactData(makeForm({ consentStatus: "AUTO_SEND" })).ok).toBe(false);
    const fd = makeForm();
    fd.set("doNotContact", "false");
    expect(parseManualContactData(fd).ok).toBe(false);
  });
  it("requires recorded permission provenance before marking consent granted", () => {
    expect(parseManualContactData(makeForm({ consentStatus: "GRANTED" })).ok).toBe(false);
    expect(parseManualContactData(makeForm({ consentStatus: "GRANTED", consentEvidence: "Asked and accepted by phone" })).ok).toBe(true);
  });
  it("preserves a DNC restriction even if the user records granted consent", () => {
    const parsed = parseManualContactData(makeForm({ consentStatus: "GRANTED", consentEvidence: "Confirmed verbally on 22 Oct", doNotContact: true }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toMatchObject({ consentStatus: "GRANTED", doNotContact: true });
  });
  it("denies outreach unless consent was granted and DNC is clear", () => {
    expect(contactMayBeContacted({ consentStatus: "UNKNOWN", doNotContact: false })).toBe(false);
    expect(contactMayBeContacted({ consentStatus: "DENIED", doNotContact: false })).toBe(false);
    expect(contactMayBeContacted({ consentStatus: "GRANTED", doNotContact: true })).toBe(false);
    expect(contactMayBeContacted({ consentStatus: "GRANTED", doNotContact: false })).toBe(true);
  });
  it("never lets staff request an all-contacts scope", () => {
    expect(contactListScope("staff", "staff-1", true)).toEqual({ ownerUserId: "staff-1" });
    expect(contactListScope("promoter", "promoter-1", true)).toEqual({ ownerUserId: "promoter-1" });
    expect(contactListScope("admin", "owner", false)).toEqual({ ownerUserId: "owner" });
    expect(contactListScope("admin", "owner", true)).toEqual({});
    expect(contactRecordScope("staff", "staff-1")).toEqual({ ownerUserId: "staff-1" });
    expect(contactRecordScope("admin", "owner")).toEqual({});
  });
  it("validates IDs and concurrency versions", () => {
    expect(isContactUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isContactUuid("../../../users")).toBe(false);
    expect(parseContactVersion("2026-10-22T09:00:00.000Z")?.toISOString()).toBe("2026-10-22T09:00:00.000Z");
    expect(parseContactVersion("2026-10-22")).toBeNull();
  });
});
