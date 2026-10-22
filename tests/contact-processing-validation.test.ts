import { describe, expect, it } from "vitest";
import {
  contactCsvCell, csvRows, exactlyOne, followUpDue, followUpNote,
  mayScheduleOutreach, reviewReason, taskAction, taskKind, validVersion,
} from "../src/lib/contact-processing";
import { matchingQueueContacts } from "../src/lib/contact-processing-duplicates";

const granted = { state: "MAIN", consentStatus: "GRANTED" as const, doNotContact: false,
  consentEvidence: "Consent confirmed directly", consentUpdatedAt: new Date("2026-10-20T12:00:00.000Z") };
const candidate = (id: string, owner: string, name: string, phone: string) => ({
  id, ownerUserId: owner, ownerSnapshot: "Owner", firstName: name, lastName: "Sample",
  city: "Nairobi", version: 1, methods: [{ type: "PHONE" as const, normalizedValue: phone }],
});

describe("Contact Intake Batch D — pure validation", () => {
  it("rejects duplicate form keys, files and missing values", () => {
    const f = new FormData();
    f.set("name", "one");
    expect(exactlyOne(f, "name")).toBe("one");
    f.append("name", "two");
    expect(exactlyOne(f, "name")).toBeNull();
    expect(exactlyOne(f, "missing")).toBeNull();
  });
  it("rejects invalid or excessive contact versions", () => {
    expect(validVersion("1")).toBe(1);
    expect(validVersion("0")).toBeNull();
    expect(validVersion("1.5")).toBeNull();
    expect(validVersion("9999999999")).toBeNull();
  });
  it("enforces mandatory, bounded, clean queue decisions", () => {
    expect(reviewReason("too short")).toBeNull();
    expect(reviewReason("Reviewed source and recorded decision")).toBe("Reviewed source and recorded decision");
    expect(reviewReason("a".repeat(301))).toBeNull();
    expect(reviewReason("Valid reason\u0000 with bad data")).toBeNull();
  });
  it("requires complete follow-up notes and prevents control characters", () => {
    expect(followUpNote("brief")).toBeNull();
    expect(followUpNote("Discuss status\nwith member")).toBe("Discuss status\nwith member");
    expect(followUpNote("a".repeat(2001))).toBeNull();
    expect(followUpNote("Appropriate\u0000 record")).toBeNull();
  });
  it("accepts only future, bounded ISO UTC dates", () => {
    const now = new Date("2026-10-22T00:00:00.000Z");
    expect(followUpDue("2026-10-24T00:00:00.000Z", now)?.toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(followUpDue("2026-10-20T00:00:00.000Z", now)).toBeNull();
    expect(followUpDue("2026-10-22", now)).toBeNull();
    expect(followUpDue("2040-10-22T00:00:00.000Z", now)).toBeNull();
  });
  it("enforces strict action and task-kind values", () => {
    expect(taskKind("INTERNAL")).toBe("INTERNAL");
    expect(taskKind("SEND_EMAIL")).toBeNull();
    expect(taskAction("RESCHEDULE")).toBe("RESCHEDULE");
    expect(taskAction("DELETE")).toBeNull();
  });
  it("requires documented positive permission, Main state, and no Do Not Contact", () => {
    expect(mayScheduleOutreach(granted)).toBe(true);
    expect(mayScheduleOutreach({ ...granted, state: "IMPORTED_QUEUE" })).toBe(false);
    expect(mayScheduleOutreach({ ...granted, consentStatus: "UNKNOWN" })).toBe(false);
    expect(mayScheduleOutreach({ ...granted, doNotContact: true })).toBe(false);
    expect(mayScheduleOutreach({ ...granted, consentEvidence: null })).toBe(false);
    expect(mayScheduleOutreach({ ...granted, consentUpdatedAt: null })).toBe(false);
  });
  it("quotes commas and formulas in untrusted CSV values", () => {
    expect(contactCsvCell('abc,"quoted"')).toBe('"abc,""quoted"""');
    expect(contactCsvCell("=1+2")).toBe('"\'=1+2"');
    expect(contactCsvCell(" \t@SUM(1)")).toBe('"\' \t@SUM(1)"');
    expect(contactCsvCell("-2")).toBe('"\'-2"');
    expect(contactCsvCell(null)).toBe('""');
  });
  it("produces CRLF CSV with a UTF-8 BOM", () => {
    const csv = csvRows([["Contact", "Owner"], ["=malicious", "One"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("\"'=malicious\"");
  });
  it("matches exact phone under the same owner, never different owners", () => {
    const target = candidate("A", "staff-a", "Wanjiku", "+254712345678");
    const sameOwner = candidate("B", "staff-a", "Different", "+254712345678");
    const another = candidate("C", "staff-b", "Wanjiku", "+254712345678");
    expect(matchingQueueContacts(target, [target, sameOwner, another])).toEqual(["B"]);
  });
  it("matches full name plus city but not names alone", () => {
    const target = candidate("A", "staff-a", "Wanjiku", "+254712345678");
    const another = { ...candidate("B", "staff-a", "Wanjiku", "+254733333333"), city: "Mombasa" };
    const sameNameCity = candidate("C", "staff-a", "Wanjiku", "+254744444444");
    expect(matchingQueueContacts(target, [another, sameNameCity])).toEqual(["C"]);
  });
});
