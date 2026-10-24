"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { isContactUuid } from "@/lib/contact-intake";
import { exactlyOne, reviewReason } from "@/lib/contact-processing";

export type TransferDecisionState = { status: "success" | "error"; message: string };
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 } as const;

export async function respondToContactTransfer(_previous: TransferDecisionState | null, form: FormData): Promise<TransferDecisionState> {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  const id = exactlyOne(form, "transferId");
  const decision = exactlyOne(form, "decision");
  const rawReason = exactlyOne(form, "reason");
  const reason = decision === "REJECT" ? reviewReason(rawReason) : (typeof rawReason === "string" && rawReason.trim().length <= 300 ? rawReason.trim() : "");
  if (!isContactUuid(id) || !["APPROVE", "REJECT"].includes(decision || "") || (decision === "REJECT" && !reason)) {
    return { status: "error", message: "Choose approve or reject; rejection requires a reason of 10–300 characters." };
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const transfer = await tx.contactTransfer.findUnique({ where: { id }, include: { contact: true } });
      if (!transfer || transfer.recipientUserId !== user.id) return "missing" as const;
      if (transfer.status !== "PENDING" || transfer.contact.state !== "TRANSFER_PENDING" ||
        transfer.contact.version !== transfer.expectedContactVersion) return "stale" as const;
      if (decision === "APPROVE" && !user.id) return "missing" as const;
      const nextState = decision === "REJECT"
        ? transfer.sourceState
        : transfer.sourceState === "IMPORTED_QUEUE" ? "IMPORTED_QUEUE" : "MAIN";
      const now = new Date();
      const contactUpdate = await tx.contact.updateMany({
        where: { id: transfer.contactId, state: "TRANSFER_PENDING", version: transfer.expectedContactVersion },
        data: decision === "REJECT"
          ? { ownerUserId: transfer.sourceOwnerUserId, ownerSnapshot: transfer.sourceOwnerSnapshot,
              state: nextState, version: { increment: 1 }, updatedAt: now }
          : { ownerUserId: user.id, ownerSnapshot: user.name, state: nextState,
              version: { increment: 1 }, updatedAt: now },
      });
      if (contactUpdate.count !== 1) return "stale" as const;
      const transferUpdate = await tx.contactTransfer.updateMany({
        where: { id, recipientUserId: user.id, status: "PENDING", expectedContactVersion: transfer.expectedContactVersion },
        data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          rejectionReason: decision === "REJECT" ? reason : null,
          decisionReason: reason || null, decidedAt: now, decidedByUserId: user.id, decidedBySnapshot: user.name },
      });
      if (transferUpdate.count !== 1) throw new Error("STALE_TRANSFER");
      await tx.contactAuditEvent.create({ data: {
        contactId: transfer.contactId, actorUserId: user.id, actorSnapshot: user.name,
        action: decision === "APPROVE" ? "CONTACT_TRANSFER_ACCEPTED" : "CONTACT_TRANSFER_REJECTED",
        reason: decision === "REJECT" ? reason : (reason || null),
        before: { ownerUserId: transfer.sourceOwnerUserId, ownerSnapshot: transfer.sourceOwnerSnapshot,
          state: "TRANSFER_PENDING", transferId: transfer.id, status: "PENDING" },
        after: { ownerUserId: decision === "APPROVE" ? user.id : transfer.sourceOwnerUserId,
          ownerSnapshot: decision === "APPROVE" ? user.name : transfer.sourceOwnerSnapshot,
          state: nextState, transferId: transfer.id, status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decidedAt: now.toISOString() },
      } });
      return { state: nextState } as const;
    }, SERIALIZABLE);
    if (result === "missing") return { status: "error", message: "This transfer is not available to your account." };
    if (result === "stale") return { status: "error", message: "This transfer has already been decided or the contact changed. Refresh the queue." };
    revalidatePath("/admin/my-contacts");
    revalidatePath("/admin/my-contacts/transfers");
    revalidatePath("/admin/my-contacts/rejected-imports");
    return { status: "success", message: decision === "APPROVE"
      ? result.state === "IMPORTED_QUEUE" ? "Transfer accepted. The contact remains in your Imported Queue for its separate import review." : "Transfer accepted. The contact is now in your Main Contacts."
      : "Transfer rejected. It has returned to the sender or Contact Pool, and the rejection is visible in the administrator's Transfers view." };
  } catch {
    return { status: "error", message: "Transfer decision was not completed. Refresh and retry; review the transfer status first." };
  }
}


/**
 * Owner recovery path for pending transfers whose recipient is unavailable or
 * where an administrator has determined that reassignment is required.
 * A transfer record is cancelled, never deleted. If the contact is still in
 * TRANSFER_PENDING, its source owner and source state are restored atomically.
 */
export async function cancelPendingContactTransfer(
  _previous: TransferDecisionState | null,
  form: FormData,
): Promise<TransferDecisionState> {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  if (user.role !== "admin") {
    return { status: "error", message: "Only the Owner can resolve pending contact transfers." };
  }

  const id = exactlyOne(form, "transferId");
  const reason = reviewReason(exactlyOne(form, "reason"));
  if (!isContactUuid(id) || !reason) {
    return { status: "error", message: "Provide a valid transfer and a resolution reason of 10–300 characters." };
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const transfer = await tx.contactTransfer.findUnique({ where: { id }, include: { contact: true } });
      if (!transfer) return { kind: "missing" as const };
      if (transfer.status !== "PENDING") return { kind: "stale" as const };
      // Do not overwrite a contact that changed after this transfer was created.
      // Recipient decisions already enforce this optimistic-concurrency guard.
      if (transfer.contact.state === "TRANSFER_PENDING" &&
          transfer.contact.version !== transfer.expectedContactVersion) {
        return { kind: "stale" as const };
      }

      const now = new Date();
      let restoredContact = false;
      let contactAfter = {
        ownerUserId: transfer.contact.ownerUserId,
        ownerSnapshot: transfer.contact.ownerSnapshot,
        state: transfer.contact.state,
        version: transfer.contact.version,
      };

      if (transfer.contact.state === "TRANSFER_PENDING") {
        const restored = await tx.contact.updateMany({
          where: {
            id: transfer.contactId,
            state: "TRANSFER_PENDING",
            version: transfer.contact.version,
          },
          data: {
            ownerUserId: transfer.sourceOwnerUserId,
            ownerSnapshot: transfer.sourceOwnerSnapshot,
            state: transfer.sourceState,
            version: { increment: 1 },
            updatedAt: now,
          },
        });
        if (restored.count !== 1) return { kind: "stale" as const };

        restoredContact = true;
        contactAfter = await tx.contact.findUniqueOrThrow({
          where: { id: transfer.contactId },
          select: { ownerUserId: true, ownerSnapshot: true, state: true, version: true },
        });
      }

      const cancelled = await tx.contactTransfer.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "CANCELLED",
          decisionReason: reason,
          decidedAt: now,
          decidedByUserId: user.id,
          decidedBySnapshot: user.name,
        },
      });
      if (cancelled.count !== 1) throw new Error("STALE_TRANSFER");

      await tx.contactAuditEvent.create({
        data: {
          contactId: transfer.contactId,
          actorUserId: user.id,
          actorSnapshot: user.name,
          action: "CONTACT_TRANSFER_ADMIN_CANCELLED",
          reason,
          before: {
            transferId: transfer.id,
            transferStatus: transfer.status,
            recipientUserId: transfer.recipientUserId,
            recipientSnapshot: transfer.recipientSnapshot,
            sourceOwnerUserId: transfer.sourceOwnerUserId,
            sourceOwnerSnapshot: transfer.sourceOwnerSnapshot,
            sourceState: transfer.sourceState,
            contactOwnerUserId: transfer.contact.ownerUserId,
            contactOwnerSnapshot: transfer.contact.ownerSnapshot,
            contactState: transfer.contact.state,
            contactVersion: transfer.contact.version,
            expectedContactVersion: transfer.expectedContactVersion,
          },
          after: {
            transferId: transfer.id,
            transferStatus: "CANCELLED",
            restoredContact,
            ownerUserId: contactAfter.ownerUserId,
            ownerSnapshot: contactAfter.ownerSnapshot,
            state: contactAfter.state,
            version: contactAfter.version,
            decidedAt: now.toISOString(),
          },
        },
      });

      return { kind: "cancelled" as const, restoredContact };
    }, SERIALIZABLE);

    if (result.kind === "missing") {
      return { status: "error", message: "Transfer not found. Refresh the Transfers view." };
    }
    if (result.kind === "stale") {
      return { status: "error", message: "This transfer is no longer pending or the contact changed concurrently. Refresh and review its status." };
    }

    revalidatePath("/admin/my-contacts");
    revalidatePath("/admin/my-contacts/transfers");
    revalidatePath("/admin/my-contacts/rejected-imports");
    return {
      status: "success",
      message: result.restoredContact
        ? "Pending transfer cancelled. The contact returned to its previous owner and state; it can now be reassigned."
        : "Pending transfer cancelled. The contact was already outside Transfer Pending, so its current state was preserved. Review the contact before reassignment.",
    };
  } catch {
    return { status: "error", message: "Transfer recovery was not completed. Refresh and review the transfer status before retrying." };
  }
}
