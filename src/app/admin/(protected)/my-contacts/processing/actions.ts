"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser, type CrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import {
  exactlyOne, followUpDue, followUpNote, mayScheduleOutreach,
  reviewReason, taskAction, taskKind, validVersion,
} from "@/lib/contact-processing";
import { matchingQueueContacts } from "@/lib/contact-processing-duplicates";

export type ContactProcessingResult = { status: "success" | "error"; message: string; contactId?: string };

async function actor(): Promise<CrmUser> {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  return user;
}
function invalidate(contactId?: string) {
  revalidatePath("/admin/my-contacts");
  revalidatePath("/admin/my-contacts/follow-ups");
  if (contactId) revalidatePath(`/admin/my-contacts/${contactId}`);
}
function error(message: string): ContactProcessingResult {
  return { status: "error", message };
}
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 } as const;

/** Review one imported contact. Never contact, create a Lead or silently merge it. */
export async function reviewImportedContact(_previous: ContactProcessingResult | null, form: FormData): Promise<ContactProcessingResult> {
  const user = await actor();
  const contactId = exactlyOne(form, "contactId");
  const version = validVersion(exactlyOne(form, "expectedVersion"));
  const decision = exactlyOne(form, "decision");
  const reason = reviewReason(exactlyOne(form, "reason"));
  if (!isContactUuid(contactId) || version === null || !["APPROVE", "REJECT"].includes(decision || "") || !reason) {
    return error("Choose a decision and explain it in 10–300 characters. Refresh stale forms.");
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const contact = await tx.contact.findFirst({
        where: { id: contactId, ...contactRecordScope(user.role, user.id) },
        include: { methods: { select: { type: true, normalizedValue: true } } },
      });
      if (!contact || (contact.ownerUserId === null)) return "missing" as const;
      if (contact.state !== "IMPORTED_QUEUE" || contact.origin !== "IMPORT" || contact.queueReviewOutcome !== null || contact.version !== version) {
        return "stale" as const;
      }
      if (decision === "APPROVE") {
        // Even a never-scanned matching pair needs an explicit review before promotion.
        // Bounded owner-scoped read: never silently approve if the candidate set is too large.
        const active = await tx.contact.findMany({
          where: { ownerUserId: contact.ownerUserId, state: { in: ["MAIN", "IMPORTED_QUEUE"] } },
          take: 2001,
          select: { id: true, ownerUserId: true, ownerSnapshot: true, firstName: true, lastName: true,
            city: true, version: true, methods: { select: { type: true, normalizedValue: true } } },
        });
        if (active.length > 2000) return "limit" as const;
        const candidate = active.find(c => c.id === contactId);
        if (!candidate) return "stale" as const;
        const matches = matchingQueueContacts(candidate, active);
        const issues = await tx.contactDuplicateIssue.findMany({
          where: { ownerUserId: contact.ownerUserId, OR: [
            { leftContactId: contactId }, { rightContactId: contactId },
          ] },
          select: { leftContactId: true, rightContactId: true, status: true },
          take: 2001,
        });
        if (issues.length > 2000) return "limit" as const;
        if (issues.some(issue => issue.status === "OPEN")) return "duplicates" as const;
        for (const otherId of matches) {
          const issue = issues.find(i => (i.leftContactId === contactId && i.rightContactId === otherId) ||
            (i.rightContactId === contactId && i.leftContactId === otherId));
          // Only a human dismissal/verified separation permits a known match to proceed.
          if (issue?.status !== "DISMISSED") return "duplicates" as const;
        }
      }
      const nextState = decision === "APPROVE" ? "MAIN" : "ARCHIVED";
      const now = new Date();
      const updated = await tx.contact.updateMany({
        where: { id: contactId, ownerUserId: contact.ownerUserId, origin: "IMPORT",
          state: "IMPORTED_QUEUE", queueReviewOutcome: null, version },
        data: { state: nextState, version: { increment: 1 },
          queueReviewOutcome: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          queueReviewedAt: now, queueReviewedByUserId: user.id,
          queueReviewedBySnapshot: user.name, queueReviewReason: reason },
      });
      if (updated.count !== 1) return "stale" as const;
      await tx.contactAuditEvent.create({ data: {
        contactId, actorUserId: user.id, actorSnapshot: user.name,
        action: decision === "APPROVE" ? "IMPORT_APPROVED" : "IMPORT_REJECTED", reason,
        before: { state: contact.state, version: contact.version, consentStatus: contact.consentStatus, doNotContact: contact.doNotContact },
        after: { state: nextState, version: version + 1, decision, reviewedAt: now.toISOString(),
          consentStatus: contact.consentStatus, doNotContact: contact.doNotContact },
      } });
      return "saved" as const;
    }, SERIALIZABLE);
    if (result === "missing") return error("Contact not available for this decision.");
    if (result === "stale") return error("This queue record changed. Refresh and review again.");
    if (result === "limit") return error("This owner has too many candidates for a safe approval check. Contact the Owner for a bounded review.");
    if (result === "duplicates") return error("Potential or open duplicate matches require manual review. Run Duplicate Issues scan and resolve each match before approving.");
    invalidate(contactId);
    return { status: "success", message: decision === "APPROVE"
      ? "Imported contact approved into Main Contacts. No messaging or Lead creation occurred."
      : "Imported contact rejected and archived with an audit record.", contactId };
  } catch {
    return error("Queue decision did not complete. Refresh and try again; no partial approval was saved.");
  }
}

/** Contact task scheduling only; creates no email, outbound message or Lead. */
export async function scheduleContactFollowUp(_previous: ContactProcessingResult | null, form: FormData): Promise<ContactProcessingResult> {
  const user = await actor();
  const contactId = exactlyOne(form, "contactId");
  const expectedVersion = validVersion(exactlyOne(form, "expectedVersion"));
  const kind = taskKind(exactlyOne(form, "kind"));
  const note = followUpNote(exactlyOne(form, "note"));
  const dueAt = followUpDue(exactlyOne(form, "dueAtIso"));
  if (!isContactUuid(contactId) || expectedVersion === null || !kind || !note || !dueAt) {
    return error("Provide a valid future date (within one year), task type and note (10–2,000 characters). Refresh stale forms.");
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const contact = await tx.contact.findFirst({
        where: { id: contactId, ...contactRecordScope(user.role, user.id) },
        include: { methods: { select: { type: true } } },
      });
      if (!contact || !contact.ownerUserId) return "missing" as const;
      if (contact.version !== expectedVersion || contact.state !== "MAIN") return "stale" as const;
      if (kind !== "INTERNAL" && !mayScheduleOutreach(contact)) return "consent" as const;
      if (kind !== "INTERNAL" && !contact.methods.some(method => method.type === (kind === "CALL" ? "PHONE" : "EMAIL"))) return "method" as const;
      const active = await tx.contactFollowUp.count({ where: { contactId, status: "OPEN" } });
      if (active >= 50) return "limit" as const;
      // Write the parent version as a consent-and-state concurrency fence.
      const claimed = await tx.contact.updateMany({
        where: { id: contactId, ...contactRecordScope(user.role, user.id), state: "MAIN", version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (claimed.count !== 1) return "stale" as const;
      const task = await tx.contactFollowUp.create({ data: {
        contactId, kind, note, dueAt, status: "OPEN",
        createdByUserId: user.id, createdBySnapshot: user.name,
      } });
      await tx.contactAuditEvent.create({ data: {
        contactId, actorUserId: user.id, actorSnapshot: user.name, action: "CONTACT_FOLLOWUP_CREATED",
        after: { followUpId: task.id, kind, dueAt: dueAt.toISOString(), note },
      } });
      return "saved" as const;
    }, SERIALIZABLE);
    if (result === "missing") return error("Contact not available.");
    if (result === "stale") return error("Contact changed or is not in Main Contacts. Refresh the page.");
    if (result === "consent") return error("Call and email tasks require documented granted consent without a Do Not Contact restriction. Use an internal review task instead.");
    if (result === "limit") return error("This contact already has 50 open tasks; close existing tasks before adding another.");
    if (result === "method") return error("Add a verified contact method of the selected type before scheduling this task.");
    invalidate(contactId);
    return { status: "success", message: "Contact follow-up scheduled. This does not send a message.", contactId };
  } catch {
    return error("Could not save the task. Refresh and retry.");
  }
}

export async function changeContactFollowUp(_previous: ContactProcessingResult | null, form: FormData): Promise<ContactProcessingResult> {
  const user = await actor();
  const id = exactlyOne(form, "followUpId");
  const version = validVersion(exactlyOne(form, "expectedVersion"));
  const action = taskAction(exactlyOne(form, "action"));
  const outcome = action === "COMPLETE" ? followUpNote(exactlyOne(form, "reason")) : reviewReason(exactlyOne(form, "reason"));
  const due = action === "RESCHEDULE" ? followUpDue(exactlyOne(form, "dueAtIso")) : null;
  if (!isContactUuid(id) || version === null || !action || !outcome || (action === "RESCHEDULE" && !due)) {
    return error("Select a valid task action, future date where applicable, and explain it (at least 10 characters).");
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const task = await tx.contactFollowUp.findUnique({
        where: { id }, include: { contact: { include: { methods: { select: { type: true } } } } },
      });
      if (!task || (user.role !== "admin" && task.contact.ownerUserId !== user.id)) return { kind: "missing" } as const;
      if (action !== "CANCEL" && !task.contact.ownerUserId) return { kind: "missing" } as const;
      if (task.status !== "OPEN" || task.version !== version) return { kind: "stale" } as const;
      if (action !== "CANCEL" && task.contact.state !== "MAIN") return { kind: "stale" } as const;
      if (action !== "CANCEL" && task.kind !== "INTERNAL" && !mayScheduleOutreach(task.contact)) {
        return { kind: "consent" } as const;
      }
      if (action !== "CANCEL" && task.kind !== "INTERNAL" &&
        !task.contact.methods.some(method => method.type === (task.kind === "CALL" ? "PHONE" : "EMAIL"))) {
        return { kind: "consent" } as const;
      }
      // The parent write serializes task completion/rescheduling with consent edits and archiving.
      const parent = await tx.contact.updateMany({
        where: { id: task.contactId, ...contactRecordScope(user.role, user.id), version: task.contact.version },
        data: { version: { increment: 1 } },
      });
      if (parent.count !== 1) return { kind: "stale" } as const;
      const now = new Date();
      const modified = await tx.contactFollowUp.updateMany({
        where: { id, version, status: "OPEN" },
        data: action === "RESCHEDULE"
          ? { dueAt: due!, version: { increment: 1 } }
          : { status: action === "COMPLETE" ? "COMPLETED" : "CANCELLED",
            version: { increment: 1 }, resolvedAt: now,
            resolvedByUserId: user.id, resolvedBySnapshot: user.name, resolutionNote: outcome },
      });
      if (modified.count !== 1) throw new Error("STALE_TASK_WRITE");
      await tx.contactAuditEvent.create({ data: {
        contactId: task.contactId, actorUserId: user.id, actorSnapshot: user.name,
        action: action === "RESCHEDULE" ? "CONTACT_FOLLOWUP_RESCHEDULED" :
          action === "COMPLETE" ? "CONTACT_FOLLOWUP_COMPLETED" : "CONTACT_FOLLOWUP_CANCELLED",
        reason: action === "COMPLETE" ? null : outcome,
        before: { id, status: task.status, dueAt: task.dueAt.toISOString(), version },
        after: { id, status: action === "COMPLETE" ? "COMPLETED" : action === "CANCEL" ? "CANCELLED" : "OPEN",
          dueAt: action === "RESCHEDULE" ? due!.toISOString() : task.dueAt.toISOString(),
          version: version + 1, outcome },
      } });
      return { kind: "saved", contactId: task.contactId } as const;
    }, SERIALIZABLE);
    if (result.kind === "missing") return error("Task not available.");
    if (result.kind === "stale") return error("Task or contact changed. Refresh before updating.");
    if (result.kind === "consent") return error("Consent or Do Not Contact now prohibits outreach. Cancel the task or use an internal task.");
    invalidate(result.contactId);
    return { status: "success", message: action === "RESCHEDULE" ? "Follow-up rescheduled." :
      action === "COMPLETE" ? "Follow-up completed with recorded outcome." : "Follow-up cancelled with reason.", contactId: result.contactId };
  } catch {
    return error("Task update did not complete. Refresh and retry.");
  }
}
