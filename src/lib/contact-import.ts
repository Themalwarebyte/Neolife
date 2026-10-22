/** Batch B import rules: no automatic lead creation, deduplication or outbound activity. */
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { type ImportField, type ImportMapping, type UploadedSheet, type ParsedImportRow } from "@/lib/contact-import-fields";
import { parseManualContactData } from "@/lib/contact-intake";

export const IMPORT_MAX_BYTES = 768 * 1024; // beneath Next server-action's default 1MiB limit
export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_COLUMNS = 28;
export const IMPORT_MAX_CELL = 4000;
export { guessMapping, readMapping, emptyMapping } from "@/lib/contact-import-fields";
export type { ImportField, ImportMapping } from "@/lib/contact-import-fields";
export { IMPORT_FIELDS } from "@/lib/contact-import-fields";
function parseCSV(text: string): string[][] {
  // RFC4180-style parser; rejects malformed unclosed quotes, NUL and oversized cells.
  if (text.includes("\0")) throw new Error("The file contains invalid control characters.");
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  const candidates = [",", ";", "\t"];
  const delimiter = candidates.reduce((best, char) => firstLine.split(char).length > firstLine.split(best).length ? char : best, ",");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, ended = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.length === 0) {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; ended = true;
    } else {
      if (ch === '"') throw new Error("Unexpected quotation mark in CSV cell.");
      cell += ch;
    }
    if (cell.length > IMPORT_MAX_CELL) throw new Error("A spreadsheet cell exceeds the allowed length.");
    if (row.length > IMPORT_MAX_COLUMNS || rows.length > IMPORT_MAX_ROWS + 1) throw new Error("Spreadsheet exceeds the row or column limit.");
    if (ch !== "\r" && ch !== "\n") ended = false;
  }
  if (quoted) throw new Error("An imported CSV field has an unclosed quote.");
  if (!ended || row.length > 0 || cell.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** Basic ZIP central-directory budget check before handing XLSX to the workbook reader.
 * Block macros, encrypted records, path traversal and decompression bombs. */
export function checkXlsxContainer(data: Uint8Array): void {
  if (data.length < 22 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error("Invalid XLSX ZIP structure.");
  const b = Buffer.from(data);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0 || b.readUInt16LE(eocd + 4) || b.readUInt16LE(eocd + 6)) throw new Error("Unsupported XLSX archive.");
  const count = b.readUInt16LE(eocd + 10);
  const size = b.readUInt32LE(eocd + 12);
  const offset = b.readUInt32LE(eocd + 16);
  if (!count || count > 350 || offset + size > eocd) throw new Error("XLSX archive size is not supported.");
  let position = offset, total = 0, foundWorkbook = false, foundSheet = false;
  for (let i = 0; i < count; i++) {
    if (position + 46 > eocd || b.readUInt32LE(position) !== 0x02014b50) throw new Error("Malformed XLSX file directory.");
    const flags = b.readUInt16LE(position + 8);
    const compression = b.readUInt16LE(position + 10);
    const compressed = b.readUInt32LE(position + 20);
    const expanded = b.readUInt32LE(position + 24);
    const nameLength = b.readUInt16LE(position + 28);
    const extraLength = b.readUInt16LE(position + 30);
    const commentLength = b.readUInt16LE(position + 32);
    const localOffset = b.readUInt32LE(position + 42);
    if (flags & 1 || position + 46 + nameLength + extraLength + commentLength > eocd) throw new Error("Encrypted or malformed XLSX archive.");
    const name = b.toString("utf8", position + 46, position + 46 + nameLength);
    if (name.includes("..") || name.startsWith("/") || /(?:^|\/)(?:externalLinks|vbaProject\.bin)(?:\/|$)/i.test(name)) throw new Error("XLSX contains unsupported external links or macros.");
    if (compression !== 0 && compression !== 8) throw new Error("Unsupported XLSX compression method.");
    if (name === "xl/workbook.xml") foundWorkbook = true;
    total += expanded;
    if (expanded > 5_000_000 || total > 14_000_000 || (expanded > 200_000 && expanded > Math.max(1, compressed) * 180)) {
      throw new Error("XLSX expands beyond the safe processing budget.");
    }
    if (/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) {
      foundSheet = true;
      if (localOffset + 30 > b.length || b.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Malformed XLSX sheet entry.");
      const localNameLength = b.readUInt16LE(localOffset + 26);
      const localExtraLength = b.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      if (start + compressed > b.length) throw new Error("Malformed XLSX sheet payload.");
      const payload = b.subarray(start, start + compressed);
      let sheetData: Buffer;
      try {
        sheetData = compression === 0 ? Buffer.from(payload) : inflateRawSync(payload, { maxOutputLength: expanded + 1 });
      } catch { throw new Error("XLSX worksheet could not be inspected safely."); }
      if (sheetData.length !== expanded) throw new Error("XLSX worksheet size is inconsistent.");
      // read-excel-file returns precomputed values for formulas; reject formula
      // cells first to avoid silently accepting untrusted calculated values.
      if (/<(?:[A-Za-z0-9_.-]+:)?f(?:\s|>)/i.test(sheetData.toString("utf8"))) {
        throw new Error("Unsupported formula or special cell in XLSX worksheet.");
      }
    }
    position += 46 + nameLength + extraLength + commentLength;
  }
  if (!foundWorkbook || !foundSheet || position !== offset + size) throw new Error("Expected XLSX workbook structure not found.");
}
export async function readUploadedSheet(filename: string, contents: Uint8Array): Promise<UploadedSheet> {
  if (contents.length === 0 || contents.length > IMPORT_MAX_BYTES) throw new Error("Choose a spreadsheet smaller than 768 KB.");
  const safeName = filename.trim();
  // eslint-disable-next-line no-control-regex -- Reject control characters in uploaded filenames.
  if (!safeName || safeName.length > 140 || /[\\/\x00-\x1f\x7f]/.test(safeName)) throw new Error("Invalid spreadsheet filename.");
  const extension = safeName.toLowerCase().endsWith(".csv") ? "CSV" : safeName.toLowerCase().endsWith(".xlsx") ? "XLSX" : null;
  if (!extension) throw new Error("Only .csv and .xlsx files are supported.");
  let records: string[][];
  if (extension === "CSV") {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    records = parseCSV(decoder.decode(contents));
  } else {
    checkXlsxContainer(contents);
    // Maintained XLSX reader; formulas and archive expansion were blocked above.
    const { readSheet } = await import("read-excel-file/node");
    const rawRows = await readSheet(Buffer.from(contents));
    if (rawRows.length > IMPORT_MAX_ROWS + 1) throw new Error("Spreadsheet exceeds the row or column limit.");
    records = rawRows.map(row => {
      if (row.length > IMPORT_MAX_COLUMNS) throw new Error("Spreadsheet exceeds the row or column limit.");
      return row.map(value => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        throw new Error("Unsupported XLSX cell value.");
      });
    });
  }
  if (records.length < 2) throw new Error("Spreadsheet needs a header row and at least one contact row.");
  const headers = records[0].map(s => s.trim());
  if (!headers.length || headers.length > IMPORT_MAX_COLUMNS || headers.every(h => !h)) throw new Error("Invalid header row.");
  if (headers.some(s => s.length > 120)) throw new Error("Column headings must be shorter than 120 characters.");
  // eslint-disable-next-line no-control-regex -- Header labels must be printable, single-line text.
  if (headers.some(s => /[\x00-\x1f\x7f]/.test(s))) throw new Error("Spreadsheet headings contain invalid control characters.");
  if (records.slice(1).some(values => values.slice(headers.length).some(value => value.trim()))) throw new Error("Spreadsheet has populated columns without headings.");
  const rows = records.slice(1).map((values, i) => ({ rowNumber: i + 2, values: values.slice(0, headers.length) }))
    .filter(row => row.values.some(value => value.trim().length > 0));
  if (!rows.length || rows.length > IMPORT_MAX_ROWS) throw new Error("Upload 1–500 nonempty contact rows.");
  if (rows.some(r => r.values.some(v => v.length > IMPORT_MAX_CELL))) throw new Error("A spreadsheet cell exceeds the allowed length.");
  return { headers, rows, fileSha256: createHash("sha256").update(contents).digest("hex"), fileType: extension };
}

function parseConsent(raw: string): "UNKNOWN" | "GRANTED" | "DENIED" | null {
  const value = raw.trim().toLowerCase();
  if (!value || ["unknown", "unsure", "not recorded"].includes(value)) return "UNKNOWN";
  if (["granted", "yes", "y", "true", "1", "opt in", "opt-in"].includes(value)) return "GRANTED";
  if (["denied", "no", "n", "false", "0", "refused"].includes(value)) return "DENIED";
  return null;
}
function parseDnc(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v || ["no", "n", "false", "0"].includes(v)) return false;
  if (["yes", "y", "true", "1", "dnc", "opt out", "opt-out"].includes(v)) return true;
  return null;
}

export function parseImportContact(values: string[], mapping: ImportMapping, filename: string): ParsedImportRow {
  const read = (field: ImportField) => mapping[field] === null ? "" : (values[mapping[field]!] ?? "").trim();
  let firstName = read("firstName");
  let lastName = read("lastName");
  if (!firstName && read("fullName")) {
    const words = read("fullName").split(/\s+/);
    firstName = words.shift() ?? "";
    if (!lastName) lastName = words.join(" ");
  }
  const consentStatus = parseConsent(read("consentStatus"));
  const dnc = parseDnc(read("doNotContact"));
  if (!consentStatus || dnc === null) return { ok: false, message: "Invalid permission or Do Not Contact value." };
  const form = new FormData();
  form.set("firstName", firstName);
  form.set("lastName", lastName);
  form.set("city", read("city"));
  form.set("sourceDetail", read("sourceDetail") || `Spreadsheet: ${filename}`.slice(0, 160));
  form.set("notes", read("notes"));
  form.set("consentStatus", consentStatus);
  form.set("consentEvidence", read("consentEvidence"));
  if (dnc) form.set("doNotContact", "on");
  const methods = ["phone1", "phone2", "phone3", "email1", "email2", "email3"] as const;
  for (const field of methods) {
    let method = read(field);
    // Excel's numeric cells may omit the national zero or '+' prefix.
    if (field.startsWith("phone") && /^\d+$/.test(method)) {
      if (/^[71]\d{8}$/.test(method)) method = `0${method}`;
      else if (/^254\d{9}$/.test(method)) method = `+${method}`;
    }
    if (method) form.append(field.startsWith("phone") ? "phones" : "emails", method);
  }
  const parsed = parseManualContactData(form);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  return parsed;
}

export function isValidImportFilename(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 140) return false;
  // eslint-disable-next-line no-control-regex -- Reject control characters in uploaded filenames.
  return !/[\\/\x00-\x1f\x7f]/.test(value) && /\.(csv|xlsx)$/i.test(value);
}
