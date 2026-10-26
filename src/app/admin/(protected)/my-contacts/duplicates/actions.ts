"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { recordActivityAudit } from "@/lib/activity-audit";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import {
  findDuplicateCandidates,
  planAdditionalMethods,
  strictestConsent,
  type CandidateContact,
} from "@/lib/contact-duplicates";

export type DuplicateActionResult = { status: "success" | "error"; message: string; retainedId?: string };
const DUPLICATE_ACTIVE_STATES = ["MAIN", "IMPORTED_QUEUE"] as const;

async function actor() {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  return user;
}
function oneString(form: FormData, key: string): string | null {
  const entries = form.getAll(key);
  return entries.length === 1 && typeof entries[0] === "string" ? entries[0] : null;
}
function reasonFrom(form: FormData): string | null {
  const value = oneString(form, "reason")?.trim();
  // eslint-disable-next-line no-control-regex -- Reject control characters in audit reasons.
  return value && value.length >= 10 && value.length <= 300 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}
function versionFrom(form: FormData, name: string): number | null {
  const raw = oneString(form, name);
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
function invalidate(ids: string[]) {
  revalidatePath("/admin/my-contacts");
  for (const id of ids) revalidatePath(`/admin/my-contacts/${id}`);
}

/** Explicit user-requested scan; never launched automatically by imports. */
export async function scanDuplicateIssues(_previous: DuplicateActionResult | null, form: FormData): Promise<DuplicateActionResult> {
  const user = await actor();
  const all = user.role === "admin" && oneString(form, "scope") === "all";
  try {
    const counts = await prisma.$transaction(async tx => {
      const scanScope = !all ? { ownerUserId: user.id } : { ownerUserId: { not: null } };
      const contacts = await tx.contact.findMany({
        where: { ...scanScope, state: { in: [...DUPLICATE_ACTIVE_STATES] } },
        take: 2001,
        select: {
          id: true, ownerUserId: true, ownerSnapshot: true, firstName: true, lastName: true,
          city: true, version: true,
          methods: { select: { type: true, normalizedValue: true } },
        },
      });
      const candidates = findDuplicateCandidates(contacts);
      const open = await tx.contactDuplicateIssue.findMany({
        where: { ...scanScope, status: "OPEN" }, take: 5001,
        select: { id: true, leftContactId: true, rightContactId: true },
      });
      if (open.length > 5000) throw new Error("TOO_MANY_OPEN_ISSUES");
      const keys = new Set(candidates.map(c => `${c.leftContactId}|${c.rightContactId}`));
      if (candidates.length) {
        // Unique pair index makes repeated scans idempotent. A dismissed pair
        // never reopens; CLOSED pairs may reopen only with matching evidence.
        await tx.contactDuplicateIssue.createMany({
          data: candidates.map(c => ({
            ownerUserId: c.ownerUserId, ownerSnapshot: c.ownerSnapshot,
            leftContactId: c.leftContactId, rightContactId: c.rightContactId,
            leftVersion: c.leftVersion, rightVersion: c.rightVersion, signals: c.signals,
          })),
          skipDuplicates: true,
        });
        for (const c of candidates) {
          await tx.contactDuplicateIssue.updateMany({
            where: { leftContactId: c.leftContactId, rightContactId: c.rightContactId,
              status: { in: ["OPEN", "CLOSED"] } },
            data: { status: "OPEN", leftVersion: c.leftVersion, rightVersion: c.rightVersion,
              signals: c.signals, reviewedByUserId: null, reviewedBySnapshot: null,
              reviewReason: null, reviewedAt: null, retainedContactId: null },
          });
        }
      }
      // Old OPEN signals must not remain actionable if a method was edited,
      // a contact archived or a prior source merged. Same snapshot/transaction.
      const expired = open.filter(i => !keys.has(`${i.leftContactId}|${i.rightContactId}`)).map(i => i.id);
      if (expired.length) await tx.contactDuplicateIssue.updateMany({
        where: { id: { in: expired }, status: "OPEN" },
        data: { status: "CLOSED", reviewedByUserId: user.id, reviewedBySnapshot: user.name,
          reviewReason: "Previously suggested match is no longer present on rescan.", reviewedAt: new Date() },
      });
      return { contacts: contacts.length, candidates: candidates.length, expired: expired.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
    await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: "DUPLICATE_SCAN_COMPLETED", entityType: "CONTACT_DUPLICATE_SCAN", entitySnapshot: "Duplicate review scan", outcome: "SUCCESS", details: { contactsChecked: counts.contacts, candidatesFound: counts.candidates, obsoleteIssuesClosed: counts.expired } });
    revalidatePath("/admin/my-contacts");
    return {
      status: "success",
      message: `Scan finished: ${counts.contacts} eligible contacts checked, ${counts.candidates} possible pairs found and ${counts.expired} obsolete issues closed. Dismissed and merged decisions remain unchanged; no contact was merged or promoted.`,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_CONTACTS") return {
      status: "error", message: "More than 2,000 eligible contacts are in this scope. Narrow the scan; no partial results were saved.",
    };
    if (error instanceof Error && error.message === "TOO_MANY_OPEN_ISSUES") return {
      status: "error", message: "More than 5,000 open issues exist. The scan was cancelled without saving partial findings.",
    };
    if (error instanceof Error && ["TOO_MANY_PAIRS", "DENSE_MATCH_KEY"].includes(error.message)) return {
      status: "error", message: "Too many contacts share a matching value to review safely in one scan. No partial issues were saved.",
    };
    return { status: "error", message: "Duplicate scan could not finish. No contacts were changed." };
  }
}

type AuditableContact = {
  id: string;
  ownerUserId: string | null;
  ownerSnapshot: string;
  version: number;
  firstName: string;
  lastName: string | null;
  city: string | null;
  notes: string | null;
  sourceDetail: string | null;
  consentStatus: "UNKNOWN" | "GRANTED" | "DENIED";
  consentEvidence: string | null;
  consentUpdatedAt: Date | null;
  doNotContact: boolean;
  doNotContactAt: Date | null;
  state: string;
  origin: string;
  mergedIntoContactId: string | null;
  methods: { type: "EMAIL" | "PHONE"; value: string; normalizedValue: string; isPrimary: boolean }[];
};
function contactSnapshot(c: AuditableContact) {
  return {
    id: c.id, ownerUserId: c.ownerUserId, ownerSnapshot: c.ownerSnapshot,
    version: c.version, firstName: c.firstName, lastName: c.lastName,
    city: c.city, sourceDetail: c.sourceDetail, notes: c.notes,
    consentStatus: c.consentStatus, consentEvidence: c.consentEvidence,
    consentUpdatedAt: c.consentUpdatedAt?.toISOString() ?? null,
    doNotContact: c.doNotContact, doNotContactAt: c.doNotContactAt?.toISOString() ?? null,
    state: c.state, origin: c.origin, mergedIntoContactId: c.mergedIntoContactId,
    methods: c.methods.map(m => ({ type: m.type, value: m.value, normalizedValue: m.normalizedValue, isPrimary: m.isPrimary })),
  };
}

/** Staff may review only their own pairs; Owner may review any same-owner pair. */
export async function dismissDuplicateIssue(_previous: DuplicateActionResult | null, form: FormData): Promise<DuplicateActionResult> {
  const user = await actor();
  const issueId = oneString(form, "issueId");
  const leftVersion = versionFrom(form, "leftVersion");
  const rightVersion = versionFrom(form, "rightVersion");
  const reason = reasonFrom(form);
  if (!isContactUuid(issueId) || leftVersion === null || rightVersion === null || !reason) {
    return { status: "error", message: "Invalid review, version or explanation (10–300 characters)." };
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const issue = await tx.contactDuplicateIssue.findFirst({
        where: { id: issueId, status: "OPEN", ...contactRecordScope(user.role, user.id) },
        include: { leftContact: true, rightContact: true },
      });
      if (!issue) return "missing" as const;
      if (!issue.ownerUserId || issue.ownerUserId !== issue.leftContact.ownerUserId ||
        issue.ownerUserId !== issue.rightContact.ownerUserId) return "missing" as const;
      if (issue.leftContact.version !== leftVersion || issue.rightContact.version !== rightVersion ||
        issue.leftVersion !== leftVersion || issue.rightVersion !== rightVersion) return "stale" as const;
      const updated = await tx.contactDuplicateIssue.updateMany({
        where: { id: issue.id, status: "OPEN", leftVersion, rightVersion },
        data: { status: "DISMISSED", reviewedByUserId: user.id, reviewedBySnapshot: user.name, reviewReason: reason, reviewedAt: new Date() },
      });
      if (updated.count !== 1) return "stale" as const;
      await tx.contactAuditEvent.createMany({ data: [issue.leftContactId, issue.rightContactId].map(id => ({
        contactId: id, actorUserId: user.id, actorSnapshot: user.name,
        action: "DUPLICATE_DISMISSED", reason,
        after: { issueId: issue.id, result: "KEEP_SEPARATE" },
      })) });
      return "dismissed" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result === "missing") return { status: "error", message: "Duplicate issue is not available for review." };
    if (result === "stale") return { status: "error", message: "A contact or issue changed. Rescan and reopen the issue before reviewing." };
    await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: "DUPLICATE_DISMISSED", entityType: "CONTACT_DUPLICATE_ISSUE", entityId: issueId, entitySnapshot: "Duplicate issue", outcome: "SUCCESS", details: { decision: "KEEP_SEPARATE" } });
    invalidate([]);
    return { status: "success", message: "Marked as separate people. The decision and explanation were recorded; future scans will not reopen this pair." };
  } catch {
    return { status: "error", message: "Review did not complete. Refresh and try again." };
  }
}

/** Transactional merge retaining BOTH source records and BOTH audit histories. */
export async function mergeDuplicateIssue(_previous: DuplicateActionResult | null, form: FormData): Promise<DuplicateActionResult> {
  const user = await actor();
  const issueId = oneString(form, "issueId");
  const keepId = oneString(form, "keepId");
  const leftVersion = versionFrom(form, "leftVersion");
  const rightVersion = versionFrom(form, "rightVersion");
  const reason = reasonFrom(form);
  if (!isContactUuid(issueId) || !isContactUuid(keepId) || leftVersion === null || rightVersion === null || !reason) {
    return { status: "error", message: "Choose a retained contact and provide a review explanation (10–300 characters)." };
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const issue = await tx.contactDuplicateIssue.findFirst({
        where: { id: issueId, status: "OPEN", ...contactRecordScope(user.role, user.id) },
        include: {
          leftContact: { include: { methods: true } },
          rightContact: { include: { methods: true } },
        },
      });
      if (!issue || (keepId !== issue.leftContactId && keepId !== issue.rightContactId)) return { kind: "missing" } as const;
      const left = issue.leftContact, right = issue.rightContact;
      if (!issue.ownerUserId || left.ownerUserId !== issue.ownerUserId || right.ownerUserId !== issue.ownerUserId) return { kind: "owner" } as const;
      if (left.version !== leftVersion || right.version !== rightVersion || issue.leftVersion !== leftVersion || issue.rightVersion !== rightVersion) return { kind: "stale" } as const;
      // Merges never auto-promote an imported queue record into Main Contacts.
      if (!DUPLICATE_ACTIVE_STATES.includes(left.state as typeof DUPLICATE_ACTIVE_STATES[number]) ||
        left.state !== right.state || left.mergedIntoContactId || right.mergedIntoContactId) return { kind: "state" } as const;
      const match = findDuplicateCandidates([left as CandidateContact, right as CandidateContact]);
      if (match.length !== 1) return { kind: "no_match" } as const;
      const retained = keepId === left.id ? left : right;
      const source = retained.id === left.id ? right : left;
      const planned = planAdditionalMethods(retained.methods, source.methods);
      if (!planned.ok) return { kind: "methods", message: planned.message } as const;
      const consentStatus = strictestConsent(retained.consentStatus, source.consentStatus);
      const doNotContact = retained.doNotContact || source.doNotContact;
      const evidence = consentStatus === "UNKNOWN" ? null :
        (retained.consentStatus === consentStatus ? retained.consentEvidence : source.consentEvidence);
      const now = new Date();
      const beforeRetained = contactSnapshot(retained);
      const beforeSource = contactSnapshot(source);
      const updatedRetained = await tx.contact.updateMany({
        where: { id: retained.id, ownerUserId: issue.ownerUserId, state: retained.state, version: retained.version },
        data: {
          version: { increment: 1 }, consentStatus, consentEvidence: evidence,
          consentUpdatedAt: consentStatus === retained.consentStatus && evidence === retained.consentEvidence ? retained.consentUpdatedAt : now,
          doNotContact, doNotContactAt: doNotContact ? retained.doNotContactAt || source.doNotContactAt || now : null,
        },
      });
      if (updatedRetained.count !== 1) throw new Error("STALE_DUPLICATE_MERGE");
      if (planned.additional.length) {
        await tx.contactMethod.createMany({
          data: planned.additional.map(m => ({ contactId: retained.id, ...m })),
        });
      }
      const updatedSource = await tx.contact.updateMany({
        where: { id: source.id, ownerUserId: issue.ownerUserId, state: source.state, version: source.version, mergedIntoContactId: null },
        data: { state: "MERGED", mergedIntoContactId: retained.id, mergedAt: now, version: { increment: 1 } },
      });
      if (updatedSource.count !== 1) throw new Error("STALE_DUPLICATE_MERGE");
      // Never leave an open task on a read-only merged source. Nor may the
      // retained record keep outreach tasks when the merge restricts consent.
      const sourceTasks = await tx.contactFollowUp.updateMany({
        where: { contactId: source.id, status: "OPEN" },
        data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: now,
          resolvedByUserId: user.id, resolvedBySnapshot: user.name,
          resolutionNote: "Contact was merged into another record." },
      });
      const retainedTasks = consentStatus !== "GRANTED" || doNotContact
        ? await tx.contactFollowUp.updateMany({
          where: { contactId: retained.id, status: "OPEN", kind: { in: ["CALL", "EMAIL"] } },
          data: { status: "CANCELLED", version: { increment: 1 }, resolvedAt: now,
            resolvedByUserId: user.id, resolvedBySnapshot: user.name,
            resolutionNote: "Merged consent restricts outreach." },
        })
        : { count: 0 };
      if (sourceTasks.count || retainedTasks.count) await tx.contactAuditEvent.createMany({ data: [
        ...(sourceTasks.count ? [{ contactId: source.id, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: "Source contact merged.",
          after: { count: sourceTasks.count, scope: "ALL_OPEN" } }] : []),
        ...(retainedTasks.count ? [{ contactId: retained.id, actorUserId: user.id, actorSnapshot: user.name,
          action: "CONTACT_FOLLOWUPS_AUTO_CANCELLED", reason: "Consent restricted by merge.",
          after: { count: retainedTasks.count, scope: "OPEN_CALL_EMAIL" } }] : []),
      ] });
      const claimed = await tx.contactDuplicateIssue.updateMany({
        where: { id: issue.id, status: "OPEN", leftVersion, rightVersion },
        data: { status: "MERGED", reviewedByUserId: user.id, reviewedBySnapshot: user.name,
          reviewReason: reason, reviewedAt: now, retainedContactId: retained.id },
      });
      if (claimed.count !== 1) throw new Error("STALE_DUPLICATE_MERGE");
      // Remaining open suggestions containing the merged source are no longer actionable.
      await tx.contactDuplicateIssue.updateMany({
        where: { id: { not: issue.id }, status: "OPEN",
          OR: [{ leftContactId: source.id }, { rightContactId: source.id }] },
        data: { status: "CLOSED", reviewedByUserId: user.id, reviewedBySnapshot: user.name,
          reviewReason: "Superseded when source contact was merged.", reviewedAt: now, retainedContactId: retained.id },
      });
      const [afterRetained, afterSource] = await Promise.all([
        tx.contact.findUniqueOrThrow({ where: { id: retained.id }, include: { methods: true } }),
        tx.contact.findUniqueOrThrow({ where: { id: source.id }, include: { methods: true } }),
      ]);
      await tx.contactAuditEvent.createMany({ data: [
        { contactId: retained.id, actorUserId: user.id, actorSnapshot: user.name, action: "DUPLICATE_MERGE_RETAINED", reason,
          before: { ...beforeRetained, issueId: issue.id, sourceId: source.id },
          after: { ...contactSnapshot(afterRetained), issueId: issue.id, sourceId: source.id } },
        { contactId: source.id, actorUserId: user.id, actorSnapshot: user.name, action: "DUPLICATE_MERGED_INTO", reason,
          before: { ...beforeSource, issueId: issue.id, retainedId: retained.id },
          after: { ...contactSnapshot(afterSource), issueId: issue.id, retainedId: retained.id } },
      ] });
      return { kind: "merged", retainedId: retained.id, sourceId: source.id } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    if (result.kind === "missing" || result.kind === "owner") return { status: "error", message: "Duplicate issue is not available for this review." };
    if (result.kind === "stale" || result.kind === "no_match") return { status: "error", message: "The contact or match changed. Scan again before merging." };
    if (result.kind === "state") return { status: "error", message: "Merging requires two active contacts in the same list (both Main or both Imported Queue). No implicit queue promotion is allowed." };
    if (result.kind === "methods") return { status: "error", message: result.message };
    await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: "DUPLICATE_MERGED", entityType: "CONTACT", entityId: result.retainedId, entitySnapshot: "Merged contacts", outcome: "SUCCESS", details: { sourceContactId: result.sourceId, retainedContactId: result.retainedId } });
    invalidate([result.retainedId, result.sourceId]);
    return { status: "success", message: "Reviewed merge saved. Both contact histories were preserved; communication restrictions remain conservative. No Lead was created.", retainedId: result.retainedId };
  } catch {
    return { status: "error", message: "Merge was not committed. Refresh and try again; no partial merge was saved." };
  }
}
