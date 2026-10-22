"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { guessMapping, isValidImportFilename, parseImportContact, readMapping, readUploadedSheet, type ImportMapping } from "@/lib/contact-import";
import { isContactUuid } from "@/lib/contact-intake";

export type PreviewState = {
  status: "error" | "preview" | "existing";
  message: string;
  batchId?: string;
  headers?: string[];
  mapping?: ImportMapping;
  sample?: string[][];
  total?: number;
};
export type ConfirmState = { status: "error" | "success"; message: string; batchId?: string };

async function actor() {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  return user;
}

/** Accept only bounded text arrays after reading persisted Prisma JSON. */
function isStoredImportRow(values: unknown): values is string[] {
  return Array.isArray(values) && values.length <= 28 &&
    values.every(value => typeof value === "string" && value.length <= 4000);
}

function safeMessage(error: unknown): string {
  if (error instanceof Error && [
    "Choose a spreadsheet", "Only .csv", "Invalid spreadsheet", "The file", "Spreadsheet",
    "A spreadsheet", "Column", "Expected XLSX", "Unsupported", "Malformed", "XLSX",
    "An imported CSV", "Upload", "Encrypted", "Column headings",
  ].some(s => error.message.startsWith(s))) return error.message;
  return "Could not read the spreadsheet. Check the file type and try again.";
}

/** No external storage: persist only parsed cells in an owner-scoped preview. */
export async function previewContactSheet(_previous: PreviewState | null, form: FormData): Promise<PreviewState> {
  const user = await actor();
  const files = form.getAll("sheet");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File)) return { status: "error", message: "Select one CSV or XLSX file." };
  if (!isValidImportFilename(file.name) || file.size > 768 * 1024) return { status: "error", message: "Choose a CSV or XLSX smaller than 768 KB." };
  let sheet: Awaited<ReturnType<typeof readUploadedSheet>>;
  try {
    sheet = await readUploadedSheet(file.name, new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { status: "error", message: safeMessage(e) };
  }
  try {
    const prior = await prisma.contactImportBatch.findFirst({ where: { ownerUserId: user.id, fileSha256: sheet.fileSha256 },
      include: { rows: { orderBy: { rowNumber: "asc" }, take: 5 } },
    });
    if (prior) return {
      status: "existing", message: prior.status === "COMPLETE" ? "This exact spreadsheet has already been imported. See its history." : "This spreadsheet already has an unconfirmed preview. Continue mapping it from Import History.",
      batchId: prior.id,
    };
    const recentUploads = await prisma.contactImportBatch.count({
      where: { ownerUserId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recentUploads >= 8) return { status: "error", message: "Upload limit reached. Up to eight new spreadsheet previews are allowed per hour." };
    const batch = await prisma.contactImportBatch.create({
      data: {
        ownerUserId: user.id, ownerSnapshot: user.name, filename: file.name,
        fileType: sheet.fileType, fileSha256: sheet.fileSha256,
        headers: sheet.headers, totalRows: sheet.rows.length,
        rows: { create: sheet.rows.map(row => ({ rowNumber: row.rowNumber, values: row.values })) },
      },
    });
    revalidatePath("/admin/my-contacts");
    return { status: "preview", message: "Review the suggested columns before importing.",
      batchId: batch.id, headers: sheet.headers, mapping: guessMapping(sheet.headers),
      sample: sheet.rows.slice(0, 5).map(row => row.values), total: sheet.rows.length,
    };
  } catch {
    // Unique (owner, SHA-256) protects against concurrent duplicate uploads.
    const prior = await prisma.contactImportBatch.findFirst({ where: { ownerUserId: user.id, fileSha256: sheet.fileSha256 } });
    if (prior) return { status: "existing", batchId: prior.id, message: "This file is already in your import history." };
    return { status: "error", message: "Could not save the import preview. Try again." };
  }
}

/** Atomic confirmation: invalid rows become history; valid rows enter IMPORTED_QUEUE.
 * Every row and the final batch state commit together. A rejected transaction
 * cannot leave a partly imported batch or a retry that creates duplicates. */
export async function confirmContactSheet(_previous: ConfirmState | null, form: FormData): Promise<ConfirmState> {
  const user = await actor();
  const id = form.get("batchId");
  if (!isContactUuid(id)) return { status: "error", message: "Invalid import batch." };
  const batch = await prisma.contactImportBatch.findFirst({
    where: { id, ownerUserId: user.id },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) return { status: "error", message: "Import batch not found." };
  if (batch.status !== "PREVIEW") return { status: "error", message: "This spreadsheet was already processed." };
  if (!Array.isArray(batch.headers) || batch.headers.length > 28 || !batch.headers.every(h => typeof h === "string")) {
    return { status: "error", message: "Invalid saved header row." };
  }
  const parsed = readMapping(form, batch.headers.length);
  if (!parsed.ok) return { status: "error", message: parsed.message };
  if (batch.rows.length !== batch.totalRows || batch.rows.length > 500 || batch.rows.length === 0) {
    return { status: "error", message: "Import row count requires review." };
  }
  const prepared = batch.rows.map(row => {
    const values = row.values;
    if (!isStoredImportRow(values)) {
      return { rowId: row.id, rowNumber: row.rowNumber, parsed: { ok: false as const, message: "Invalid stored spreadsheet row." } };
    }
    return { rowId: row.id, rowNumber: row.rowNumber, parsed: parseImportContact(values, parsed.mapping, batch.filename) };
  });
  const validCount = prepared.filter(row => row.parsed.ok).length;
  const invalidCount = prepared.length - validCount;
  try {
    await prisma.$transaction(async tx => {
      const claimed = await tx.contactImportBatch.updateMany({
        where: { id: batch.id, ownerUserId: user.id, status: "PREVIEW" },
        data: { status: "COMPLETE", mapping: parsed.mapping, importedRows: validCount, invalidRows: invalidCount, completedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("STALE_IMPORT");
      for (const item of prepared) {
        if (!item.parsed.ok) {
          await tx.contactImportRow.update({ where: { id: item.rowId }, data: { status: "INVALID", error: item.parsed.message } });
          continue;
        }
        const contact = item.parsed.value;
        const created = await tx.contact.create({
          data: {
            ownerUserId: user.id, ownerSnapshot: user.name,
            firstName: contact.firstName, lastName: contact.lastName, city: contact.city,
            sourceDetail: contact.sourceDetail, notes: contact.notes,
            consentStatus: contact.consentStatus, consentEvidence: contact.consentEvidence,
            consentUpdatedAt: contact.consentStatus === "UNKNOWN" ? null : new Date(),
            doNotContact: contact.doNotContact, doNotContactAt: contact.doNotContact ? new Date() : null,
            state: "IMPORTED_QUEUE", origin: "IMPORT",
            importBatchId: batch.id, importRowNumber: item.rowNumber,
            methods: { create: contact.methods },
          },
        });
        await tx.contactImportRow.update({ where: { id: item.rowId }, data: { status: "IMPORTED", contactId: created.id } });
        await tx.contactAuditEvent.create({ data: {
          contactId: created.id, actorUserId: user.id, actorSnapshot: user.name, action: "IMPORTED",
          after: { batchId: batch.id, rowNumber: item.rowNumber, state: "IMPORTED_QUEUE", origin: "IMPORT", consentStatus: contact.consentStatus, doNotContact: contact.doNotContact },
        } });
      }
    }, { maxWait: 10000, timeout: 180000 });
    revalidatePath("/admin/my-contacts");
    revalidatePath(`/admin/my-contacts/import/${batch.id}`);
    return { status: "success", batchId: batch.id,
      message: `Import complete: ${validCount} contacts added to Imported Queue; ${invalidCount} rows need correction. No CRM leads were created.` };
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_IMPORT") return { status: "error", message: "Another session has already processed this import." };
    return { status: "error", message: "Import could not complete. No rows from this transaction were committed. Please retry or contact the Owner." };
  }
}
