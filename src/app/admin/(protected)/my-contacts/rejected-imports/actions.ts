"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid, parseManualContactData } from "@/lib/contact-intake";
import { IMPORT_FIELDS, readMapping, parseImportContact, type ImportMapping } from "@/lib/contact-import";
import { boundedImportValues } from "@/lib/contact-workflow";
import { recordActivityAudit } from "@/lib/activity-audit";

export type CorrectRejectedImportState = { status: "success" | "error"; message: string; contactId?: string };


function storedMapping(value: unknown, columns: number): ImportMapping | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  const form = new FormData();
  for (const field of IMPORT_FIELDS) {
    const column = object[field];
    if (column !== null && (!Number.isSafeInteger(column) || (column as number) < 0 || (column as number) >= columns)) return null;
    form.set(`map_${field}`, column === null ? "" : String(column));
  }
  const parsed = readMapping(form, columns);
  return parsed.ok ? parsed.mapping : null;
}

export async function correctRejectedImport(_previous: CorrectRejectedImportState | null, form: FormData): Promise<CorrectRejectedImportState> {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  const idValues = form.getAll("rowId");
  const rowId = idValues.length === 1 && typeof idValues[0] === "string" ? idValues[0] : null;
  if (!isContactUuid(rowId)) return { status: "error", message: "Invalid rejected import row." };

  const row = await prisma.contactImportRow.findUnique({ where: { id: rowId }, include: { batch: true } });
  if (!row || (user.role !== "admin" && row.batch.ownerUserId !== user.id)) {
    return { status: "error", message: "Rejected import row is not available to your account." };
  }
  if (row.batch.status !== "COMPLETE" || !["INVALID", "REJECTED"].includes(row.status) || row.contactId) {
    return { status: "error", message: "This import row is no longer awaiting correction." };
  }
  const headers = Array.isArray(row.batch.headers) && row.batch.headers.every(h => typeof h === "string") ? row.batch.headers as string[] : [];
  if (!headers.length || headers.length > 28) return { status: "error", message: "Stored import headings require administrator review." };
  const mapping = storedMapping(row.batch.mapping, headers.length);
  if (!mapping) return { status: "error", message: "Saved column mapping is invalid. Review the original import history." };
  const values = boundedImportValues(form, headers.length);
  if (!values) return { status: "error", message: "Corrected cells are invalid or exceed the allowed size." };
  const parsed = parseImportContact(values, mapping, row.batch.filename);
  const now = new Date();

  try {
    const outcome = await prisma.$transaction(async tx => {
      const current = await tx.contactImportRow.findUnique({ where: { id: row.id }, include: { batch: true } });
      if (!current || current.batch.ownerUserId !== row.batch.ownerUserId || current.contactId || !["INVALID", "REJECTED"].includes(current.status) || current.batch.status !== "COMPLETE") return { kind: "stale" as const };
      if (!parsed.ok) {
        const saved = await tx.contactImportRow.updateMany({
          where: { id: current.id, status: current.status, contactId: null },
          data: { correctedValues: values as Prisma.InputJsonValue, error: parsed.message,
            correctionCount: { increment: 1 }, lastCorrectedAt: now, lastCorrectedBySnapshot: user.name },
        });
        if (saved.count !== 1) return { kind: "stale" as const };
        await tx.contactImportRowCorrection.create({ data: {
          rowId: current.id, actorUserId: user.id, actorSnapshot: user.name,
          submittedValues: values as Prisma.InputJsonValue, validationPassed: false, validationError: parsed.message,
        } });
        return { kind: "invalid" as const, message: parsed.message };
      }

      // Preserve the original uploader's ownership when that account is still active.
      // If the uploader has been removed/deactivated, an administrator performing the
      // correction becomes the owner so the new queue record remains recoverable.
      const batchOwner = current.batch.ownerUserId
        ? await tx.user.findUnique({ where: { id: current.batch.ownerUserId }, select: { id: true, isActive: true } })
        : null;
      const targetOwnerUserId = current.batch.ownerUserId && batchOwner?.isActive
        ? current.batch.ownerUserId
        : user.id;
      const targetOwnerSnapshot = targetOwnerUserId === current.batch.ownerUserId
        ? current.batch.ownerSnapshot
        : user.name;

      const contact = await tx.contact.create({
        data: {
          ownerUserId: targetOwnerUserId, ownerSnapshot: targetOwnerSnapshot,
          firstName: parsed.value.firstName, lastName: parsed.value.lastName, city: parsed.value.city,
          sourceDetail: parsed.value.sourceDetail, notes: parsed.value.notes,
          consentStatus: parsed.value.consentStatus, consentEvidence: parsed.value.consentEvidence,
          consentUpdatedAt: parsed.value.consentStatus === "UNKNOWN" ? null : now,
          doNotContact: parsed.value.doNotContact, doNotContactAt: parsed.value.doNotContact ? now : null,
          state: "IMPORTED_QUEUE", origin: "IMPORT", importBatchId: current.batchId, importRowNumber: current.rowNumber,
          methods: { create: parsed.value.methods },
        },
      });
      const saved = await tx.contactImportRow.updateMany({
        where: { id: current.id, status: current.status, contactId: null },
        data: { status: "IMPORTED", contactId: contact.id, correctedValues: values as Prisma.InputJsonValue,
          error: null, correctionCount: { increment: 1 }, lastCorrectedAt: now, lastCorrectedBySnapshot: user.name },
      });
      if (saved.count !== 1) throw new Error("STALE_IMPORT_ROW");
      const batch = await tx.contactImportBatch.findUniqueOrThrow({ where: { id: current.batchId } });
      await tx.contactImportBatch.update({ where: { id: batch.id }, data: {
        importedRows: { increment: 1 }, invalidRows: Math.max(0, batch.invalidRows - 1),
      } });
      await tx.contactImportRowCorrection.create({ data: {
        rowId: current.id, actorUserId: user.id, actorSnapshot: user.name,
        submittedValues: values as Prisma.InputJsonValue, validationPassed: true,
      } });
      await tx.contactAuditEvent.create({ data: {
        contactId: contact.id, actorUserId: user.id, actorSnapshot: user.name,
        action: "REJECTED_IMPORT_CORRECTED_AND_QUEUED",
        after: { batchId: current.batchId, rowId: current.id, rowNumber: current.rowNumber,
          originalError: current.error, correctionCount: current.correctionCount + 1, state: "IMPORTED_QUEUE",
          ownerUserId: targetOwnerUserId, ownerSnapshot: targetOwnerSnapshot },
      } });
      return { kind: "queued" as const, contactId: contact.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });

    revalidatePath("/admin/my-contacts/rejected-imports");
    revalidatePath(`/admin/my-contacts/rejected-imports/${row.id}`);
    revalidatePath(`/admin/my-contacts/import/${row.batchId}`);
    revalidatePath("/admin/my-contacts");
    if (outcome.kind === "stale") return { status: "error", message: "This row changed or was already processed. Refresh the page." };
    if (outcome.kind === "invalid") {
      await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: "REJECTED_IMPORT_CORRECTION_VALIDATION_FAILED", entityType: "IMPORT_ROW", entityId: row.id, entitySnapshot: "Rejected import row", outcome: "FAILURE", details: { validationPassed: false } });
      return { status: "error", message: `The row remains rejected: ${outcome.message}` };
    }
    await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: "REJECTED_IMPORT_CORRECTED_AND_QUEUED", entityType: "CONTACT", entityId: outcome.contactId, entitySnapshot: "Corrected imported contact", outcome: "SUCCESS", details: { state: "IMPORTED_QUEUE", validationPassed: true } });
    return { status: "success", contactId: outcome.contactId, message: "Correction validated. Contact moved to Imported Queue; the original row and correction history were retained." };
  } catch {
    return { status: "error", message: "Correction could not be saved. No partial contact import was committed; refresh and retry." };
  }
}

export async function requeueRejectedContact(_previous: CorrectRejectedImportState | null, form: FormData): Promise<CorrectRejectedImportState> {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  const idValues = form.getAll("contactId");
  const versionValues = form.getAll("expectedVersion");
  const contactId = idValues.length === 1 && typeof idValues[0] === "string" ? idValues[0] : null;
  const expectedVersion = versionValues.length === 1 && typeof versionValues[0] === "string" && /^[1-9]\d{0,8}$/.test(versionValues[0]) ? Number(versionValues[0]) : NaN;
  if (!isContactUuid(contactId) || !Number.isSafeInteger(expectedVersion)) return { status: "error", message: "Invalid contact or stale correction form." };
  const parsed = parseManualContactData(form);
  if (!parsed.ok) return { status: "error", message: parsed.message };
  const rawDncReason = form.get("dncLiftReason");
  const dncLiftReason = typeof rawDncReason === "string" ? rawDncReason.trim().replace(/\s+/g, " ") : "";
  // eslint-disable-next-line no-control-regex -- DNC lift audit reasons must not contain controls.
  const dncReasonValid = dncLiftReason.length >= 10 && dncLiftReason.length <= 300 && !/[\u0000-\u001f\u007f]/.test(dncLiftReason);
  try {
    const result = await prisma.$transaction(async tx => {
      const contact = await tx.contact.findFirst({ where: { id: contactId, ...contactRecordScope(user.role, user.id) }, include: { methods: true } });
      if (!contact) return "missing" as const;
      if (contact.version !== expectedVersion) return "stale" as const;
      if (contact.origin !== "IMPORT" || contact.state !== "ARCHIVED" || contact.queueReviewOutcome !== "REJECTED") return "unsupported" as const;
      const liftingDnc = contact.doNotContact && !parsed.value.doNotContact;
      if (liftingDnc && !dncReasonValid) return "dnc_reason" as const;
      const currentOwner = contact.ownerUserId ? await tx.user.findUnique({ where: { id: contact.ownerUserId }, select: { isActive: true } }) : null;
      const nextOwnerUserId = contact.ownerUserId && currentOwner?.isActive ? contact.ownerUserId : user.id;
      const nextOwnerSnapshot = nextOwnerUserId === contact.ownerUserId ? contact.ownerSnapshot : user.name;
      const now = new Date();
      const consentChanged = contact.consentStatus !== parsed.value.consentStatus || contact.consentEvidence !== parsed.value.consentEvidence;
      const nextConsentUpdatedAt = consentChanged
        ? (parsed.value.consentStatus === "UNKNOWN" ? null : now)
        : contact.consentUpdatedAt;
      const nextDoNotContactAt = contact.doNotContact !== parsed.value.doNotContact
        ? (parsed.value.doNotContact ? now : null)
        : contact.doNotContactAt;
      const beforeSnapshot = {
        ownerUserId: contact.ownerUserId,
        ownerSnapshot: contact.ownerSnapshot,
        state: contact.state,
        origin: contact.origin,
        version: contact.version,
        firstName: contact.firstName,
        lastName: contact.lastName,
        city: contact.city,
        sourceDetail: contact.sourceDetail,
        notes: contact.notes,
        consentStatus: contact.consentStatus,
        consentEvidence: contact.consentEvidence,
        consentUpdatedAt: contact.consentUpdatedAt?.toISOString() ?? null,
        doNotContact: contact.doNotContact,
        doNotContactAt: contact.doNotContactAt?.toISOString() ?? null,
        queueReviewOutcome: contact.queueReviewOutcome,
        queueReviewedAt: contact.queueReviewedAt?.toISOString() ?? null,
        queueReviewedByUserId: contact.queueReviewedByUserId,
        queueReviewedBySnapshot: contact.queueReviewedBySnapshot,
        queueReviewReason: contact.queueReviewReason,
        methods: contact.methods.map(method => ({
          type: method.type,
          value: method.value,
          normalizedValue: method.normalizedValue,
          isPrimary: method.isPrimary,
        })),
      };
      const afterMethods = parsed.value.methods.map(method => ({
        type: method.type,
        value: method.value,
        normalizedValue: method.normalizedValue,
        isPrimary: method.isPrimary,
      }));
      const changed = await tx.contact.updateMany({
        where: { id: contact.id, ...contactRecordScope(user.role, user.id), state: "ARCHIVED", origin: "IMPORT", queueReviewOutcome: "REJECTED", version: expectedVersion },
        data: {
          ownerUserId: nextOwnerUserId, ownerSnapshot: nextOwnerSnapshot,
          firstName: parsed.value.firstName, lastName: parsed.value.lastName, city: parsed.value.city,
          sourceDetail: parsed.value.sourceDetail, notes: parsed.value.notes,
          consentStatus: parsed.value.consentStatus, consentEvidence: parsed.value.consentEvidence,
          consentUpdatedAt: nextConsentUpdatedAt,
          doNotContact: parsed.value.doNotContact,
          doNotContactAt: nextDoNotContactAt,
          state: "IMPORTED_QUEUE", queueReviewOutcome: null, queueReviewedAt: null,
          queueReviewedByUserId: null, queueReviewedBySnapshot: null, queueReviewReason: null,
          version: { increment: 1 }, updatedAt: now,
        },
      });
      if (changed.count !== 1) return "stale" as const;
      const desired = new Map(parsed.value.methods.map(method => [`${method.type}:${method.normalizedValue}`, method]));
      const existing = new Map(contact.methods.map(method => [`${method.type}:${method.normalizedValue}`, method]));
      const obsolete = contact.methods.filter(method => !desired.has(`${method.type}:${method.normalizedValue}`)).map(method => method.id);
      if (obsolete.length) await tx.contactMethod.deleteMany({ where: { contactId, id: { in: obsolete } } });
      for (const [key, method] of desired) {
        const previous = existing.get(key);
        if (previous) {
          if (previous.value !== method.value || previous.isPrimary !== method.isPrimary) await tx.contactMethod.update({ where: { id: previous.id }, data: { value: method.value, isPrimary: method.isPrimary } });
        } else {
          await tx.contactMethod.create({ data: { contactId, ...method } });
        }
      }
      if (parsed.value.consentStatus !== "GRANTED" || parsed.value.doNotContact) {
        const cancelled = await tx.contactFollowUp.updateMany({ where: { contactId, status: "OPEN", kind: { in: ["CALL", "EMAIL"] } },
          data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: now, resolvedByUserId: user.id,
            resolvedBySnapshot: user.name, resolutionNote: "Contact re-entered import review with consent restrictions." } });
        if (cancelled.count) await tx.contactAuditEvent.create({ data: { contactId, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: "Contact re-entered import review with consent restrictions.", after: { count: cancelled.count } } });
      }
      for (const kind of ["PHONE", "EMAIL"] as const) {
        if (parsed.value.methods.some(method => method.type === kind)) continue;
        const removedTasks = await tx.contactFollowUp.updateMany({
          where: { contactId, status: "OPEN", kind: kind === "PHONE" ? "CALL" : "EMAIL" },
          data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: now, resolvedByUserId: user.id,
            resolvedBySnapshot: user.name, resolutionNote: `Contact no longer has a ${kind.toLowerCase()} method after correction.` },
        });
        if (removedTasks.count) await tx.contactAuditEvent.create({ data: { contactId, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: `${kind} method removed during rejected-contact correction.`, after: { count: removedTasks.count, scope: kind } } });
      }
      await tx.contactAuditEvent.create({ data: {
        contactId, actorUserId: user.id, actorSnapshot: user.name,
        action: "REJECTED_IMPORT_CORRECTED_AND_REQUEUED", reason: liftingDnc ? dncLiftReason : null,
        before: beforeSnapshot,
        after: {
          ownerUserId: nextOwnerUserId,
          ownerSnapshot: nextOwnerSnapshot,
          state: "IMPORTED_QUEUE",
          origin: contact.origin,
          version: contact.version + 1,
          firstName: parsed.value.firstName,
          lastName: parsed.value.lastName,
          city: parsed.value.city,
          sourceDetail: parsed.value.sourceDetail,
          notes: parsed.value.notes,
          consentStatus: parsed.value.consentStatus,
          consentEvidence: parsed.value.consentEvidence,
          consentUpdatedAt: nextConsentUpdatedAt?.toISOString() ?? null,
          doNotContact: parsed.value.doNotContact,
          doNotContactAt: nextDoNotContactAt?.toISOString() ?? null,
          queueReviewOutcome: null,
          queueReviewedAt: null,
          queueReviewedByUserId: null,
          queueReviewedBySnapshot: null,
          queueReviewReason: null,
          methods: afterMethods,
          requeuedAt: now.toISOString(),
        },
      } });
      return "saved" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    revalidatePath("/admin/my-contacts");
    revalidatePath("/admin/my-contacts/rejected-imports");
    if (result === "missing") return { status: "error", message: "Rejected contact not found or not authorized." };
    if (result === "stale") return { status: "error", message: "Contact changed. Refresh the correction page before retrying." };
    if (result === "unsupported") return { status: "error", message: "Only rejected imported contacts can be corrected and returned to Imported Queue." };
    if (result === "dnc_reason") return { status: "error", message: "Explain why the Do Not Contact restriction is being lifted (10–300 characters), or leave it enabled." };
    await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: "REJECTED_IMPORT_CORRECTED_AND_REQUEUED", entityType: "CONTACT", entityId: contactId, entitySnapshot: "Rejected imported contact", outcome: "SUCCESS", details: { state: "IMPORTED_QUEUE" } });
    return { status: "success", contactId, message: "Contact corrections saved and returned to Imported Queue for a fresh review. The prior rejection remains in the audit history." };
  } catch {
    return { status: "error", message: "Rejected contact could not be requeued. No partial correction was committed; refresh and retry." };
  }
}
