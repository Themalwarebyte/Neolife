import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkXlsxContainer, parseImportContact, readUploadedSheet } from "../src/lib/contact-import";
import { guessMapping, readMapping } from "../src/lib/contact-import-fields";

const bytes = (s: string) => new TextEncoder().encode(s);
const mapping = guessMapping(["Full name", "Mobile", "Email", "Opt out", "Notes", "Consent"]);

describe("Contact import Batch B — CSV and mapping safety", () => {
  it("recognizes common headers and avoids assigning one source column twice", () => {
    expect(mapping).toMatchObject({ fullName: 0, phone1: 1, email1: 2, doNotContact: 3, notes: 4, consentStatus: 5 });
  });
  it("parses BOM, quoted commas, embedded newlines and keeps contact rows separate", async () => {
    const csv = '\uFEFFName,Mobile,Notes\r\n"Mary, Wanjiku",0712345678,"Met at an event\nNeed follow-up"\r\nPeter,0733456789,\r\n';
    const sheet = await readUploadedSheet("contacts.csv", bytes(csv));
    expect(sheet.headers).toEqual(["Name", "Mobile", "Notes"]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0].values[0]).toBe("Mary, Wanjiku");
    expect(sheet.rows[0].values[2]).toContain("\n");
    expect(sheet.rows[0].rowNumber).toBe(2);
  });
  it("parses semicolon separated exports", async () => {
    const sheet = await readUploadedSheet("semi.csv", bytes("Name;Phone\nAlice;0712345678"));
    expect(sheet.headers).toEqual(["Name", "Phone"]);
    expect(sheet.rows[0].values).toEqual(["Alice", "0712345678"]);
  });
  it("rejects malformed CSV instead of silently guessing missing data", async () => {
    await expect(readUploadedSheet("broken.csv", bytes('name,mobile\n"Unclosed,0712345678'))).rejects.toThrow("unclosed quote");
  });
  it("rejects wrong file types, empty files and files that exceed the cap", async () => {
    await expect(readUploadedSheet("contacts.xls", bytes("a,b\nc,d"))).rejects.toThrow("Only .csv and .xlsx");
    await expect(readUploadedSheet("contacts.csv", bytes(""))).rejects.toThrow("Choose a spreadsheet");
    await expect(readUploadedSheet("contacts.csv", bytes("x".repeat(768 * 1024 + 1)))).rejects.toThrow("768 KB");
  });
  it("rejects 501 data rows before DB processing", async () => {
    await expect(readUploadedSheet("huge.csv", bytes("Name,Mobile\n" + Array.from({ length: 501 }, () => "Mary,0712345678").join("\n")))).rejects.toThrow("Upload 1–500 nonempty contact rows.");
  });
  it("requires at least one name and phone/email mapping", () => {
    const bad = new FormData();
    for (const f of Object.keys(mapping)) bad.set(`map_${f}`, "");
    expect(readMapping(bad, 6)).toMatchObject({ ok: false, message: "Map either First name or Full name." });
    bad.set("map_fullName", "0");
    expect(readMapping(bad, 6)).toMatchObject({ ok: false, message: "Map at least one phone or email column." });
  });
  it("refuses duplicate column assignment and out-of-range mapping", () => {
    const form = new FormData();
    for (const [field, index] of Object.entries(mapping)) form.set(`map_${field}`, index === null ? "" : String(index));
    form.set("map_phone2", "0");
    expect(readMapping(form, 6).ok).toBe(false);
    form.set("map_phone2", "99");
    expect(readMapping(form, 6).ok).toBe(false);
  });
  it("normalizes Kenyan numeric phone cells and requires consent provenance", () => {
    const result = parseImportContact(["Mary Wanjiku", "712345678", "", "yes", "Please do not contact", "GRANTED"], mapping, "source.csv");
    expect(result.ok).toBe(false); // Granted requires evidence.
    const denied = parseImportContact(["Mary Wanjiku", "712345678", "", "yes", "Please do not contact", "DENIED"], mapping, "source.csv");
    expect(denied.ok).toBe(true);
    if (denied.ok) {
      expect(denied.value.methods[0].normalizedValue).toBe("+254712345678");
      expect(denied.value.doNotContact).toBe(true);
      expect(denied.value.consentStatus).toBe("DENIED");
    }
  });
  it("does not infer granted consent for spreadsheets missing permission fields", () => {
    const simple = guessMapping(["First Name", "Phone"]);
    const result = parseImportContact(["Alice", "0712345678"], simple, "contacts.csv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.consentStatus).toBe("UNKNOWN");
  });
  it("does not evaluate text formula-looking CSV cells", () => {
    const simple = guessMapping(["Full name", "Phone", "Notes"]);
    const data = parseImportContact(["Alice Example", "0712345678", "=1+1"], simple, "contacts.csv");
    expect(data.ok).toBe(true);
    if (data.ok) expect(data.value.notes).toBe("=1+1");
  });
  it("checks XLSX ZIP signatures instead of assuming the extension means safe content", async () => {
    expect(() => checkXlsxContainer(bytes("not a zip"))).toThrow("Invalid XLSX ZIP");
    await expect(readUploadedSheet("fake.xlsx", bytes("name,phone\nAlice,0712345678"))).rejects.toThrow("Invalid XLSX ZIP");
  });
  it("reads a valid XLSX workbook from an isolated test fixture", async () => {
    const contents = readFileSync(join(process.cwd(), "tests/fixtures/contact-import-valid.xlsx"));
    const parsed = await readUploadedSheet("contacts.xlsx", new Uint8Array(contents));
    expect(parsed.fileType).toBe("XLSX");
    expect(parsed.rows[0].values).toEqual(["Alice Example", "0712345678", "Nairobi"]);
  });
  it("rejects formula cells before parsing the workbook", async () => {
    const contents = readFileSync(join(process.cwd(), "tests/fixtures/contact-import-formula.xlsx"));
    await expect(readUploadedSheet("formulas.xlsx", new Uint8Array(contents))).rejects.toThrow("Unsupported formula");
  });
});
