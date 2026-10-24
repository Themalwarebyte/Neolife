import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { Prisma } from "../src/generated/prisma/client";
import { guessMapping } from "../src/lib/contact-import-fields";

const { caller } = vi.hoisted(() => ({ caller: { current: null as null | { id: string; role: "admin" | "staff"; name: string; mustChangePassword: boolean } } }));
vi.mock("@/server/auth/requireCrmUser", () => ({ requireCrmUser: async () => { if (!caller.current) throw new Error("UNAUTHENTICATED"); return caller.current; } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { correctRejectedImport, requeueRejectedContact } from "../src/app/admin/(protected)/my-contacts/rejected-imports/actions";

const dbEnabled = (() => {
  try { const url = new URL(process.env.DATABASE_URL || ""); return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /test|qa|ci/i.test(url.pathname); }
  catch { return false; }
})();
const runIfDb = dbEnabled ? describe : describe.skip;
const staff = { id: "NeolifeBatchERejectedImportStaff", role: "staff" as const, name: "Batch E Rejected Import Staff", mustChangePassword: false };
const admin = { id: "NeolifeBatchERejectedImportAdmin", role: "admin" as const, name: "Batch E Rejected Import Admin", mustChangePassword: false };
let batchId = "";
let rowId = "";
let contactId = "";
let adminBatchId = "";
let adminRowId = "";
let rejectedContactId = "";
const headers = ["First Name", "Last Name", "Phone", "Consent", "Consent Evidence", "Do Not Contact"];
function correction(phone: string, targetRowId = rowId, firstName = "Alice") {
  const form = new FormData(); form.set("rowId", targetRowId);
  [firstName, "Test", phone, "unknown", "", "no"].forEach((value, index) => form.set(`value_${index}`, value));
  return form;
}

runIfDb("Batch E rejected import correction — isolated PostgreSQL integration", () => {
  beforeAll(async () => {
    const oldBatches = await prisma.contactImportBatch.findMany({
      where: { filename: { in: ["batch-e-rejected-correction.csv", "batch-e-admin-correction.csv"] } },
      select: { id: true },
    });
    if (oldBatches.length) {
      await prisma.contact.deleteMany({ where: { importBatchId: { in: oldBatches.map(batch => batch.id) } } });
    }
    await prisma.contact.deleteMany({ where: { firstName: { in: ["BatchERejectedImport", "BatchERejectedQueue", "Bob"] } } });
    await prisma.contactImportBatch.deleteMany({
      where: { filename: { in: ["batch-e-rejected-correction.csv", "batch-e-admin-correction.csv"] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [staff.id, admin.id] } } });
    await prisma.user.create({ data: { id: staff.id, name: staff.name, email: "batch-e-rejected-import@neolife-test.invalid", role: "staff" } });
    await prisma.user.create({ data: { id: admin.id, name: admin.name, email: "batch-e-rejected-admin@neolife-test.invalid", role: "admin" } });
    const mapping = guessMapping(headers);
    const batch = await prisma.contactImportBatch.create({ data: { ownerUserId: staff.id, ownerSnapshot: staff.name,
      filename: "batch-e-rejected-correction.csv", fileType: "CSV", fileSha256: "e".repeat(64), status: "COMPLETE",
      headers, mapping: mapping as Prisma.InputJsonValue, totalRows: 1, importedRows: 0, invalidRows: 1 } });
    batchId = batch.id;
    const row = await prisma.contactImportRow.create({ data: { batchId, rowNumber: 2,
      values: ["Alice", "Test", "not-a-phone", "unknown", "", "no"], status: "INVALID", error: "Enter a valid Kenya national or +international phone number." } });
    rowId = row.id;

    const adminBatch = await prisma.contactImportBatch.create({ data: { ownerUserId: staff.id, ownerSnapshot: staff.name,
      filename: "batch-e-admin-correction.csv", fileType: "CSV", fileSha256: "f".repeat(64), status: "COMPLETE",
      headers, mapping: mapping as Prisma.InputJsonValue, totalRows: 1, importedRows: 0, invalidRows: 1 } });
    adminBatchId = adminBatch.id;
    const adminRow = await prisma.contactImportRow.create({ data: { batchId: adminBatchId, rowNumber: 2,
      values: ["Bob", "Test", "not-a-phone", "unknown", "", "no"], status: "INVALID", error: "Enter a valid Kenya national or +international phone number." } });
    adminRowId = adminRow.id;

    const rejected = await prisma.contact.create({ data: { ownerUserId: staff.id, ownerSnapshot: staff.name,
      firstName: "BatchERejectedQueue", lastName: "Fixture", state: "ARCHIVED", origin: "IMPORT",
      queueReviewOutcome: "REJECTED", queueReviewReason: "Incorrect phone number; please correct it.",
      queueReviewedAt: new Date(), queueReviewedByUserId: staff.id, queueReviewedBySnapshot: staff.name,
      consentStatus: "UNKNOWN", doNotContact: false,
      methods: { create: [{ type: "PHONE", value: "0712345678", normalizedValue: "+254712345678", isPrimary: true }] } } });
    rejectedContactId = rejected.id;
    await prisma.contactAuditEvent.create({ data: { contactId: rejected.id, actorUserId: staff.id, actorSnapshot: staff.name,
      action: "IMPORT_REJECTED", reason: "Incorrect phone number; please correct it." } });
  });
  afterAll(async () => {
    caller.current = null;
    const batchIds = [batchId, adminBatchId].filter(Boolean);
    if (batchIds.length) await prisma.contact.deleteMany({ where: { importBatchId: { in: batchIds } } });
    if (rejectedContactId) await prisma.contact.deleteMany({ where: { id: rejectedContactId } });
    if (batchIds.length) await prisma.contactImportBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [staff.id, admin.id] } } });
  });

  it("retains failed corrections, then revalidates and queues a corrected row without reupload", async () => {
    caller.current = staff;
    const first = await correctRejectedImport(null, correction("still-not-a-phone"));
    expect(first.status).toBe("error");
    const afterFailure = await prisma.contactImportRow.findUniqueOrThrow({ where: { id: rowId } });
    expect(afterFailure.status).toBe("INVALID");
    expect(afterFailure.correctionCount).toBe(1);
    expect(afterFailure.correctedValues).toEqual(["Alice", "Test", "still-not-a-phone", "unknown", "", "no"]);
    expect(await prisma.contactImportRowCorrection.count({ where: { rowId, validationPassed: false } })).toBe(1);

    const second = await correctRejectedImport(null, correction("0712345678"));
    expect(second.status).toBe("success");
    contactId = second.contactId!;
    const row = await prisma.contactImportRow.findUniqueOrThrow({ where: { id: rowId } });
    expect(row).toMatchObject({ status: "IMPORTED", contactId, error: null, correctionCount: 2 });
    expect(row.values).toEqual(["Alice", "Test", "not-a-phone", "unknown", "", "no"]);
    expect(await prisma.contactImportRowCorrection.count({ where: { rowId } })).toBe(2);
    expect(await prisma.contactImportRowCorrection.count({ where: { rowId, validationPassed: true } })).toBe(1);
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contactId } })).toMatchObject({ state: "IMPORTED_QUEUE", ownerUserId: staff.id, origin: "IMPORT" });
    expect(await prisma.contactImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toMatchObject({ importedRows: 1, invalidRows: 0 });
  });

  it("preserves the active import-batch owner when an administrator corrects a rejected spreadsheet row", async () => {
    caller.current = admin;
    const result = await correctRejectedImport(null, correction("0712345679", adminRowId, "Bob"));
    expect(result.status).toBe("success");
    const corrected = await prisma.contact.findUniqueOrThrow({ where: { id: result.contactId! } });
    expect(corrected).toMatchObject({
      ownerUserId: staff.id,
      ownerSnapshot: staff.name,
      state: "IMPORTED_QUEUE",
      origin: "IMPORT",
    });
  });

  it("allows correcting a queue-rejected contact and returning it to Imported Queue with the prior rejection retained", async () => {
    caller.current = staff;
    const form = new FormData();
    form.set("contactId", rejectedContactId);
    form.set("expectedVersion", "1");
    form.set("firstName", "BatchERejectedQueueCorrected");
    form.set("lastName", "Fixture");
    form.set("city", "Nairobi");
    form.set("sourceDetail", "Corrected during rejected import review");
    form.set("notes", "Updated test record");
    form.set("consentStatus", "UNKNOWN");
    form.set("consentEvidence", "");
    form.set("phones", "0712345679");
    form.set("emails", "");
    const result = await requeueRejectedContact(null, form);
    expect(result.status).toBe("success");
    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: rejectedContactId }, include: { methods: true } });
    expect(contact).toMatchObject({ firstName: "BatchERejectedQueueCorrected", state: "IMPORTED_QUEUE", queueReviewOutcome: null, queueReviewReason: null, ownerUserId: staff.id, version: 2 });
    expect(contact.methods).toHaveLength(1);
    expect(contact.methods[0]).toMatchObject({ type: "PHONE", normalizedValue: "+254712345679" });
    expect(await prisma.contactAuditEvent.count({ where: { contactId: rejectedContactId, action: "IMPORT_REJECTED" } })).toBe(1);
    expect(await prisma.contactAuditEvent.count({ where: { contactId: rejectedContactId, action: "REJECTED_IMPORT_CORRECTED_AND_REQUEUED" } })).toBe(1);
    const correctionAudit = await prisma.contactAuditEvent.findFirstOrThrow({
      where: { contactId: rejectedContactId, action: "REJECTED_IMPORT_CORRECTED_AND_REQUEUED" },
    });
    expect(correctionAudit.before).toMatchObject({
      firstName: "BatchERejectedQueue",
      state: "ARCHIVED",
      methods: [{ type: "PHONE", value: "0712345678", normalizedValue: "+254712345678" }],
    });
    expect(correctionAudit.after).toMatchObject({
      firstName: "BatchERejectedQueueCorrected",
      state: "IMPORTED_QUEUE",
      methods: [{ type: "PHONE", value: "0712345679", normalizedValue: "+254712345679" }],
    });
  });

});
