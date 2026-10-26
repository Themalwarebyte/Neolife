"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { tryNewNotification } from "@/lib/notifications";
import { crmBaseUrl, notificationRecipientEmail, trySendContactTransferSummaryEmail } from "@/lib/notificationsEmail";
import { buildContactTransferWhatsAppUrl } from "@/lib/contact-transfer-message";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope } from "@/lib/contact-intake";
import { parseContactBulkAction, parseContactIds } from "@/lib/contact-workflow";
import { recordActivityAudit } from "@/lib/activity-audit";

export type BulkContactState = { status: "success" | "error"; message: string; whatsappUrl?: string; whatsappUnavailable?: boolean };
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 } as const;

function exactText(form: FormData, key: string): string | null {
  const values = form.getAll(key);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function cancelOpenTasks(tx: Prisma.TransactionClient, contactId: string, actor: { id: string; name: string }, reason: string) {
  return tx.contactFollowUp.updateMany({
    where: { contactId, status: "OPEN" },
    data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: new Date(),
      resolvedByUserId: actor.id, resolvedBySnapshot: actor.name, resolutionNote: reason },
  });
}

export async function bulkManageContacts(_previous: BulkContactState | null, form: FormData): Promise<BulkContactState> {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  const action = parseContactBulkAction(exactText(form, "bulkAction"));
  const ids = parseContactIds(form);
  const recipientId = exactText(form, "recipientUserId");
  if (!action || !ids) return { status: "error", message: "Select 1–100 unique contacts and one valid action." };
  if ((action === "MOVE_TO_POOL" || action === "SEND_TO_USER") && user.role !== "admin") {
    return { status: "error", message: "Only the Owner can manage the shared Contact Pool and transfer contacts." };
  }

  let recipient: { id: string; name: string; role: string; email: string; notificationEmail: string | null; phone: string | null } | null = null;
  if (action === "SEND_TO_USER") {
    if (!recipientId || recipientId.length > 180 || hasControlCharacters(recipientId)) {
      return { status: "error", message: "Choose a valid recipient." };
    }
    recipient = await prisma.user.findFirst({ where: { id: recipientId, isActive: true, role: { in: ["admin", "staff"] } }, select: { id: true, name: true, role: true, email: true, notificationEmail: true, phone: true } });
    if (!recipient) return { status: "error", message: "Recipient is unavailable or inactive." };
  }

  const succeeded: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      const result = await prisma.$transaction(async tx => {
        const contact = await tx.contact.findFirst({
          where: { id, ...contactRecordScope(user.role, user.id) },
          select: { id: true, ownerUserId: true, ownerSnapshot: true, state: true, origin: true,
            queueReviewOutcome: true, version: true, firstName: true, lastName: true },
        });
        if (!contact) return { ok: false as const, reason: "not found or not authorized" };

        if (action === "MOVE_TO_POOL") {
          if (contact.origin === "IMPORT" && contact.queueReviewOutcome === "REJECTED") return { ok: false as const, reason: "rejected imported contacts must be corrected through Rejected Imports" };
          if (contact.state !== "MAIN" && contact.state !== "ARCHIVED") return { ok: false as const, reason: "only Main or Archived contacts can enter the pool" };
          const changed = await tx.contact.updateMany({
            where: { id, ...contactRecordScope(user.role, user.id), state: contact.state, version: contact.version },
            data: { ownerUserId: null, ownerSnapshot: "Contact Pool", state: "CONTACT_POOL", version: { increment: 1 }, updatedAt: new Date() },
          });
          if (changed.count !== 1) return { ok: false as const, reason: "contact changed; refresh and retry" };
          const cancelled = await cancelOpenTasks(tx, id, user, "Contact moved to the shared Contact Pool.");
          const current = await tx.contact.findUniqueOrThrow({ where: { id } });
          await tx.contactAuditEvent.create({ data: { contactId: id, actorUserId: user.id, actorSnapshot: user.name,
            action: "MOVED_TO_CONTACT_POOL", before: { ownerUserId: contact.ownerUserId, ownerSnapshot: contact.ownerSnapshot, state: contact.state, version: contact.version },
            after: { ownerUserId: null, ownerSnapshot: "Contact Pool", state: current.state, version: current.version, cancelledOpenFollowUps: cancelled.count } } });
          return { ok: true as const };
        }

        if (action === "SEND_TO_USER") {
          if (!recipient) return { ok: false as const, reason: "recipient missing" };
          if (!["MAIN", "IMPORTED_QUEUE", "CONTACT_POOL"].includes(contact.state)) return { ok: false as const, reason: "only Main, Imported Queue or Contact Pool contacts can be transferred" };
          if (contact.ownerUserId === recipient.id) return { ok: false as const, reason: "contact already belongs to this recipient" };
          const changed = await tx.contact.updateMany({
            where: { id, ...contactRecordScope(user.role, user.id), state: contact.state, version: contact.version },
            data: { state: "TRANSFER_PENDING", version: { increment: 1 }, updatedAt: new Date() },
          });
          if (changed.count !== 1) return { ok: false as const, reason: "contact changed; refresh and retry" };
          const transfer = await tx.contactTransfer.create({ data: {
            contactId: id, sourceOwnerUserId: contact.ownerUserId, sourceOwnerSnapshot: contact.ownerSnapshot,
            recipientUserId: recipient.id, recipientSnapshot: recipient.name,
            requestedByUserId: user.id, requestedBySnapshot: user.name,
            sourceState: contact.state, expectedContactVersion: contact.version + 1, status: "PENDING",
          } });
          const cancelled = await cancelOpenTasks(tx, id, user, "Contact transfer is pending recipient approval.");
          await tx.contactAuditEvent.create({ data: { contactId: id, actorUserId: user.id, actorSnapshot: user.name,
            action: "CONTACT_TRANSFER_REQUESTED", after: { transferId: transfer.id, recipientUserId: recipient.id,
              recipientSnapshot: recipient.name, sourceState: contact.state, status: "PENDING", cancelledOpenFollowUps: cancelled.count } } });
          return { ok: true as const };
        }

        if (action === "ARCHIVE") {
          if (contact.state !== "MAIN") return { ok: false as const, reason: "only Main Contacts can be archived" };
          const changed = await tx.contact.updateMany({
            where: { id, ...contactRecordScope(user.role, user.id), state: "MAIN", version: contact.version },
            data: { state: "ARCHIVED", version: { increment: 1 }, updatedAt: new Date() },
          });
          if (changed.count !== 1) return { ok: false as const, reason: "contact changed; refresh and retry" };
          const cancelled = await cancelOpenTasks(tx, id, user, "Contact was archived.");
          await tx.contactAuditEvent.create({ data: { contactId: id, actorUserId: user.id, actorSnapshot: user.name,
            action: "ARCHIVED", before: { state: contact.state, version: contact.version },
            after: { state: "ARCHIVED", version: contact.version + 1, cancelledOpenFollowUps: cancelled.count } } });
          return { ok: true as const };
        }

        if (action === "RESTORE") {
          if (contact.state !== "ARCHIVED") return { ok: false as const, reason: "only Archived contacts can be restored" };
          if (contact.origin === "IMPORT" && contact.queueReviewOutcome === "REJECTED") return { ok: false as const, reason: "rejected imported contacts require their dedicated review workflow" };
          const changed = await tx.contact.updateMany({
            where: { id, ...contactRecordScope(user.role, user.id), state: "ARCHIVED", version: contact.version },
            data: { state: "MAIN", version: { increment: 1 }, updatedAt: new Date() },
          });
          if (changed.count !== 1) return { ok: false as const, reason: "contact changed; refresh and retry" };
          await tx.contactAuditEvent.create({ data: { contactId: id, actorUserId: user.id, actorSnapshot: user.name,
            action: "RESTORED", before: { state: contact.state, version: contact.version }, after: { state: "MAIN", version: contact.version + 1 } } });
          return { ok: true as const };
        }
        return { ok: false as const, reason: "unsupported action" };
      }, SERIALIZABLE);
      if (result.ok) succeeded.push(id);
      else failed.push(`${id.slice(0, 8)}: ${result.reason}`);
    } catch {
      failed.push(`${id.slice(0, 8)}: operation failed; refresh and review`);
    }
  }

  let whatsappUrl: string | undefined;
  let whatsappUnavailable = false;
  if (action === "SEND_TO_USER" && recipient && succeeded.length > 0) {
    const count = succeeded.length;
    const operationId = randomUUID();
    await Promise.all([
      tryNewNotification({
        userId: recipient.id,
        type: "contact_transfer_assignment",
        title: count + " contact" + (count === 1 ? "" : "s") + " awaiting your review",
        body: count + " contact transfer request" + (count === 1 ? " is" : "s are") + " awaiting your approval. Open My Contacts and review Incoming Contact Transfers.",
        dedupKey: "contact_transfer_assignment:" + recipient.id + ":" + operationId,
      }),
      trySendContactTransferSummaryEmail({ recipientEmail: notificationRecipientEmail(recipient), recipientName: recipient.name, count }),
    ]);
    whatsappUrl = buildContactTransferWhatsAppUrl({ phone: recipient.phone, recipientName: recipient.name, count, baseUrl: crmBaseUrl() }) || undefined;
    whatsappUnavailable = !whatsappUrl;
  }
  revalidatePath("/admin/my-contacts");
  revalidatePath("/admin/my-contacts/transfers");
  revalidatePath("/admin/my-contacts/rejected-imports");
  const summary = `${succeeded.length} succeeded; ${failed.length} failed out of ${ids.length}.`;
  const details = failed.slice(0, 5).join(" | ");
  await recordActivityAudit({
    actorUserId: user.id, actorSnapshot: user.name, action: `CONTACT_BULK_${action}`,
    entityType: "CONTACT_BATCH", entitySnapshot: "Bulk contact operation",
    outcome: failed.length === 0 ? "SUCCESS" : succeeded.length > 0 ? "PARTIAL" : "FAILURE",
    details: { requestedCount: ids.length, succeededCount: succeeded.length, failedCount: failed.length },
  });
  const suffix = whatsappUnavailable ? " Recipient phone is missing or not in international format; update the user's phone to enable WhatsApp." : "";
  const result: BulkContactState = failed.length === 0
    ? { status: "success", message: `${summary} ${action === "SEND_TO_USER" ? "Transfers are awaiting recipient approval." : action === "MOVE_TO_POOL" ? "Contacts are now in the shared Contact Pool." : action === "RESTORE" ? "Contacts restored." : "Contacts archived."}` + suffix }
    : { status: succeeded.length ? "success" : "error", message: `${summary}${details ? ` Details: ${details}` : ""}${failed.length > 5 ? ` (+${failed.length - 5} more failures)` : ""}` + suffix };
  return { ...result, ...(whatsappUrl ? { whatsappUrl } : {}), ...(whatsappUnavailable && action === "SEND_TO_USER" && succeeded.length > 0 ? { whatsappUnavailable: true } : {}) };
}
