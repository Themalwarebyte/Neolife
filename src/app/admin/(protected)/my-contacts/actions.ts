"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser, type CrmUser } from "@/server/auth/requireCrmUser";
import {
  contactRecordScope,
  isContactUuid,
  parseManualContactData,
  type ManualContactInput,
} from "@/lib/contact-intake";

export type ContactActionResult = { status: "success" | "error"; message: string; contactId?: string };

async function requireContactUser(): Promise<CrmUser> {
  const user = await requireCrmUser();
  // Server actions are callable without first navigating through the layout.
  if (user.mustChangePassword) redirect("/admin/change-password");
  return user;
}

function auditSnapshot(contact: {
  firstName: string;
  lastName: string | null;
  city: string | null;
  sourceDetail: string | null;
  notes: string | null;
  consentEvidence: string | null;
  consentStatus: string;
  consentUpdatedAt: Date | null;
  doNotContactAt: Date | null;
  version: number;
  doNotContact: boolean;
  state: string;
  origin: string;
  methods: { type: string; value: string; normalizedValue: string; isPrimary: boolean }[];
}) {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    city: contact.city,
    sourceDetail: contact.sourceDetail,
    notes: contact.notes,
    consentEvidence: contact.consentEvidence,
    consentUpdatedAt: contact.consentUpdatedAt?.toISOString() ?? null,
    doNotContactAt: contact.doNotContactAt?.toISOString() ?? null,
    version: contact.version,
    consentStatus: contact.consentStatus,
    doNotContact: contact.doNotContact,
    state: contact.state,
    origin: contact.origin,
    methods: contact.methods.map(m => ({
      type: m.type, value: m.value, normalizedValue: m.normalizedValue, isPrimary: m.isPrimary,
    })),
  };
}

function contactFields(data: ManualContactInput) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    city: data.city,
    sourceDetail: data.sourceDetail,
    notes: data.notes,
    consentEvidence: data.consentEvidence,
    consentStatus: data.consentStatus,
    doNotContact: data.doNotContact,
  };
}
function invalidate(id: string) {
  revalidatePath("/admin/my-contacts");
  revalidatePath(`/admin/my-contacts/${id}`);
}

/** Manual entries start in MAIN, not an imported queue or the Lead pipeline. */
export async function createManualContact(
  _previous: ContactActionResult | null,
  form: FormData,
): Promise<ContactActionResult> {
  const user = await requireContactUser();
  const parsed = parseManualContactData(form);
  if (!parsed.ok) return { status: "error", message: parsed.message };
  try {
    const contact = await prisma.$transaction(async tx => {
      const record = await tx.contact.create({
        data: {
          ...contactFields(parsed.value),
          ownerUserId: user.id,
          ownerSnapshot: user.name,
          origin: "MANUAL",
          state: "MAIN",
          consentUpdatedAt: parsed.value.consentStatus === "UNKNOWN" ? null : new Date(),
          doNotContactAt: parsed.value.doNotContact ? new Date() : null,
          methods: { create: parsed.value.methods },
        },
        include: { methods: true },
      });
      await tx.contactAuditEvent.create({
        data: {
          contactId: record.id,
          actorUserId: user.id,
          actorSnapshot: user.name,
          action: "CREATED",
          after: auditSnapshot(record),
        },
      });
      return record;
    });
    invalidate(contact.id);
    return { status: "success", message: "Contact saved to Main Contacts.", contactId: contact.id };
  } catch {
    return { status: "error", message: "Could not save contact. Please retry." };
  }
}

/** Owner can inspect/update any contact; staff can update only their own. */
export async function updateManualContact(
  _previous: ContactActionResult | null,
  form: FormData,
): Promise<ContactActionResult> {
  const user = await requireContactUser();
  const id = form.get("contactId");
  const versionValue = form.get("expectedVersion");
  const expectedVersion = typeof versionValue === "string" ? Number(versionValue) : NaN;
  if (!isContactUuid(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { status: "error", message: "Invalid contact or stale form." };
  const parsed = parseManualContactData(form);
  if (!parsed.ok) return { status: "error", message: parsed.message };
  const where = { id, ...contactRecordScope(user.role, user.id) };
  try {
    const result = await prisma.$transaction(async tx => {
      const previous = await tx.contact.findFirst({ where, include: { methods: true } });
      if (!previous) return "missing" as const;
      if (previous.version !== expectedVersion) return "stale" as const;
      // A rejected import remains archived and cannot be edited into an approved record.
      if (previous.origin === "IMPORT" && previous.queueReviewOutcome === "REJECTED") {
        return "unsupported" as const;
      }
      if (previous.state !== "MAIN" && previous.state !== "ARCHIVED") {
        // Batch B/C will supply distinct imported/duplicate review actions.
        return "unsupported" as const;
      }
      const liftingDnc = previous.doNotContact && !parsed.value.doNotContact;
      const rawReason = form.get("dncLiftReason");
      const reason = typeof rawReason === "string" ? rawReason.trim() : "";
      // eslint-disable-next-line no-control-regex -- Reject control characters in DNC lift audit reasons.
      if (liftingDnc && (reason.length < 10 || reason.length > 300 || /[\u0000-\u001f\u007f]/.test(reason))) {
        return "dnc_reason" as const;
      }
      const consentChanged = previous.consentStatus !== parsed.value.consentStatus ||
        previous.consentEvidence !== parsed.value.consentEvidence;
      const update = await tx.contact.updateMany({
        where: { ...where, version: expectedVersion },
        data: {
          ...contactFields(parsed.value),
          version: { increment: 1 },
          consentUpdatedAt: consentChanged ? (parsed.value.consentStatus === "UNKNOWN" ? null : new Date()) : previous.consentUpdatedAt,
          doNotContactAt: previous.doNotContact !== parsed.value.doNotContact ? (parsed.value.doNotContact ? new Date() : null) : previous.doNotContactAt,
          updatedAt: new Date(),
        },
      });
      if (update.count !== 1) return "stale" as const;
      const desired = new Map(parsed.value.methods.map(m => [`${m.type}:${m.normalizedValue}`, m]));
      const existing = new Map(previous.methods.map(m => [`${m.type}:${m.normalizedValue}`, m]));
      const obsolete = previous.methods.filter(m => !desired.has(`${m.type}:${m.normalizedValue}`)).map(m => m.id);
      if (obsolete.length) await tx.contactMethod.deleteMany({ where: { contactId: id, id: { in: obsolete } } });
      for (const [key, item] of desired) {
        const previousMethod = existing.get(key);
        if (previousMethod) {
          if (previousMethod.value !== item.value || previousMethod.isPrimary !== item.isPrimary) {
            await tx.contactMethod.update({
              where: { id: previousMethod.id },
              data: { value: item.value, isPrimary: item.isPrimary },
            });
          }
        } else {
          await tx.contactMethod.create({ data: { contactId: id, ...item } });
        }
      }
      // Existing outreach reminders cease to be actionable when consent is restricted.
      if (parsed.value.consentStatus !== "GRANTED" || parsed.value.doNotContact) {
        const cancelled = await tx.contactFollowUp.updateMany({
          where: { contactId: id, status: "OPEN", kind: { in: ["CALL", "EMAIL"] } },
          data: { status: "CANCELLED", version: { increment: 1 },
            resolvedAt: new Date(), resolvedByUserId: user.id, resolvedBySnapshot: user.name,
            resolutionNote: "Contact consent is no longer eligible for outreach." },
        });
        if (cancelled.count) await tx.contactAuditEvent.create({ data: {
          contactId: id, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: "Consent or Do Not Contact restriction.",
          after: { count: cancelled.count, scope: "OPEN_CALL_EMAIL" },
        } });
      }
      // A removed phone/email also makes a pending task of that kind unsafe.
      for (const kind of ["PHONE", "EMAIL"] as const) {
        if (parsed.value.methods.some(m => m.type === kind)) continue;
        const removedTasks = await tx.contactFollowUp.updateMany({
          where: { contactId: id, kind: kind === "PHONE" ? "CALL" : "EMAIL", status: "OPEN" },
          data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: new Date(),
            resolvedByUserId: user.id, resolvedBySnapshot: user.name,
            resolutionNote: `Contact no longer has a ${kind.toLowerCase()} method.` },
        });
        if (removedTasks.count) await tx.contactAuditEvent.create({ data: {
          contactId: id, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: `${kind} method removed.`,
          after: { count: removedTasks.count, scope: kind },
        } });
      }
      const current = await tx.contact.findFirstOrThrow({ where, include: { methods: true } });
      await tx.contactAuditEvent.create({
        data: {
          contactId: id,
          actorUserId: user.id,
          actorSnapshot: user.name,
          action: "UPDATED",
          reason: liftingDnc ? reason : null,
          before: auditSnapshot(previous),
          after: auditSnapshot(current),
        },
      });
      return "updated" as const;
    });
    if (result === "missing") return { status: "error", message: "Contact not found." };
    if (result === "stale") return { status: "error", message: "This contact changed. Refresh the page before editing." };
    if (result === "dnc_reason") return { status: "error", message: "Explain why a Do Not Contact restriction is being lifted (10–300 characters)." };
    if (result === "unsupported") return { status: "error", message: "This contact requires queue review." };
    invalidate(id);
    return { status: "success", message: "Contact updated.", contactId: id };
  } catch {
    return { status: "error", message: "Could not update contact. Please retry." };
  }
}

async function changeContactState(form: FormData, target: "MAIN" | "ARCHIVED"): Promise<ContactActionResult> {
  const user = await requireContactUser();
  const id = form.get("contactId");
  const versionValue = form.get("expectedVersion");
  const expectedVersion = typeof versionValue === "string" ? Number(versionValue) : NaN;
  if (!isContactUuid(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { status: "error", message: "Invalid contact or stale form." };
  const from = target === "ARCHIVED" ? "MAIN" : "ARCHIVED";
  const where = { id, ...contactRecordScope(user.role, user.id), state: from as "MAIN" | "ARCHIVED" };
  try {
    const result = await prisma.$transaction(async tx => {
      const previous = await tx.contact.findFirst({ where, include: { methods: true } });
      if (!previous) return "missing" as const;
      if (previous.version !== expectedVersion) return "stale" as const;
      // An imported rejection must NEVER use the generic restore-to-MAIN action.
      if (target === "MAIN" && previous.origin === "IMPORT" && previous.queueReviewOutcome !== "APPROVED") {
        return "review_required" as const;
      }
      const changed = await tx.contact.updateMany({
        where: { ...where, version: expectedVersion },
        data: { state: target, version: { increment: 1 }, updatedAt: new Date() },
      });
      if (changed.count !== 1) return "stale" as const;
      if (target === "ARCHIVED") {
        const cancelled = await tx.contactFollowUp.updateMany({
          where: { contactId: id, status: "OPEN" },
          data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: new Date(),
            resolvedByUserId: user.id, resolvedBySnapshot: user.name,
            resolutionNote: "Contact was archived." },
        });
        if (cancelled.count) await tx.contactAuditEvent.create({ data: {
          contactId: id, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: "Contact archived.",
          after: { count: cancelled.count, scope: "ALL_OPEN" },
        } });
      }
      const current = await tx.contact.findFirstOrThrow({ where: { id }, include: { methods: true } });
      await tx.contactAuditEvent.create({
        data: {
          contactId: id,
          actorUserId: user.id,
          actorSnapshot: user.name,
          action: target === "ARCHIVED" ? "ARCHIVED" : "RESTORED",
          before: auditSnapshot(previous),
          after: auditSnapshot(current),
        },
      });
      return "updated" as const;
    });
    if (result === "missing") return { status: "error", message: "Contact not available for this action." };
    if (result === "stale") return { status: "error", message: "This contact changed. Refresh the page." };
    if (result === "review_required") return { status: "error", message: "A rejected imported contact cannot be restored to Main Contacts." };
    invalidate(id);
    return { status: "success", message: target === "ARCHIVED" ? "Contact archived." : "Contact restored to Main Contacts.", contactId: id };
  } catch {
    return { status: "error", message: "Could not change contact status." };
  }
}

export async function archiveManualContact(
  _previous: ContactActionResult | null,
  form: FormData,
): Promise<ContactActionResult> {
  return changeContactState(form, "ARCHIVED");
}
export async function restoreManualContact(
  _previous: ContactActionResult | null,
  form: FormData,
): Promise<ContactActionResult> {
  return changeContactState(form, "MAIN");
}
