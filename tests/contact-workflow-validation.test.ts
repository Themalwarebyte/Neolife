import { describe, expect, it } from "vitest";
import { boundedImportValues, isFourDigitExportPin, parseContactBulkAction, parseContactIds } from "../src/lib/contact-workflow";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";

describe("Batch E contact workflow validation", () => {
  it("accepts only unique UUID contact selections bounded to 100", () => {
    const form = new FormData(); form.append("contactIds", a); form.append("contactIds", b);
    expect(parseContactIds(form)).toEqual([a, b]);
    const duplicate = new FormData(); duplicate.append("contactIds", a); duplicate.append("contactIds", a);
    expect(parseContactIds(duplicate)).toBeNull();
    const malformed = new FormData(); malformed.append("contactIds", "../contact");
    expect(parseContactIds(malformed)).toBeNull();
    const empty = new FormData(); expect(parseContactIds(empty)).toBeNull();
    const excessive = new FormData(); for (let i = 0; i < 101; i++) excessive.append("contactIds", `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`);
    expect(parseContactIds(excessive)).toBeNull();
  });
  it("accepts only explicit bulk actions", () => {
    expect(parseContactBulkAction("MOVE_TO_POOL")).toBe("MOVE_TO_POOL");
    expect(parseContactBulkAction("SEND_TO_USER")).toBe("SEND_TO_USER");
    expect(parseContactBulkAction("DELETE")).toBeNull();
  });
  it("requires exactly four numeric export PIN digits", () => {
    expect(isFourDigitExportPin("0482")).toBe(true);
    expect(isFourDigitExportPin("0000")).toBe(true); // format validator; weak PIN policy is enforced at setup.
    expect(isFourDigitExportPin("482")).toBe(false);
    expect(isFourDigitExportPin("48a2")).toBe(false);
    expect(isFourDigitExportPin(1234)).toBe(false);
  });
  it("accepts only one bounded text value for each spreadsheet cell", () => {
    const form = new FormData(); form.set("value_0", "Alice"); form.set("value_1", "0712345678");
    expect(boundedImportValues(form, 2)).toEqual(["Alice", "0712345678"]);
    form.append("value_0", "overwritten");
    expect(boundedImportValues(form, 2)).toBeNull();
    const control = new FormData(); control.set("value_0", "Bad\u0000Cell");
    expect(boundedImportValues(control, 1)).toBeNull();
    expect(boundedImportValues(new FormData(), 29)).toBeNull();
  });
});
