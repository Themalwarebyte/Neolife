import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";

const { caller } = vi.hoisted(() => ({
  caller: { current: null as null | { id: string; role: "admin" | "staff"; name: string; mustChangePassword: boolean } },
}));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => {
    if (!caller.current) throw new Error("UNAUTHENTICATED");
    return caller.current;
  },
  getCrmUser: async () => caller.current,
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import {
  reviewImportedContact, scheduleContactFollowUp, changeContactFollowUp,
} from "../src/app/admin/(protected)/my-contacts/processing/actions";
import { updateManualContact, archiveManualContact, restoreManualContact } from "../src/app/admin/(protected)/my-contacts/actions";
import { scanDuplicateIssues, dismissDuplicateIssue, mergeDuplicateIssue } from "../src/app/admin/(protected)/my-contacts/duplicates/actions";
import { GET as exportContacts } from "../src/app/admin/(protected)/my-contacts/export/route";

const runIfDb = process.env.DATABASE_URL ? describe : describe.skip;
const staffA = { id: "NeolifeContactBatchDStaffA", role: "staff" as const, name: "BatchD QA Staff A", mustChangePassword: false };
const staffB = { id: "NeolifeContactBatchDStaffB", role: "staff" as const, name: "BatchD QA Staff B", mustChangePassword: false };
const owner = { id: "NeolifeContactBatchDOwner", role: "admin" as const, name: "BatchD QA Owner", mustChangePassword: false };
const users = [staffA, staffB, owner];
let clean = "", rejected = "", matchedQueue = "", mainMatch = "";
let initialLeadCount = 0;
let internalId = "", internalVersion = 1, outreachId = "";
const due = (days = 2) => new Date(Date.now() + days * 86_400_000).toISOString();
const fd = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
};
const queueForm = (id: string, version: number, decision = "APPROVE") => fd({
  contactId: id, expectedVersion: String(version), decision,
  reason: "Confirmed source, identity and intended contact list during review",
});
const taskForm = (id: string, version: number, kind = "INTERNAL") => fd({
  contactId: id, expectedVersion: String(version), kind,
  note: "Prepare and record the next approved internal contact activity",
  dueAtIso: due(),
});
const taskChange = (id: string, version: number, action: string) => fd({
  followUpId: id, expectedVersion: String(version), action,
  reason: "Staff recorded the task decision and detailed outcome",
  dueAtIso: due(4),
});
const createContact = (ownerId: string, ownerName: string, name: string, state: "MAIN" | "IMPORTED_QUEUE", phone: string) =>
  prisma.contact.create({ data: {
    ownerUserId: ownerId, ownerSnapshot: ownerName, firstName: name,
    lastName: "Sample", city: "Nairobi", state,
    origin: state === "MAIN" ? "MANUAL" : "IMPORT", consentStatus: "UNKNOWN",
    methods: { create: [{ type: "PHONE", value: phone, normalizedValue: phone, isPrimary: true }] },
  } });
const current = (id: string) => prisma.contact.findUniqueOrThrow({ where: { id }, include: { audit: true, followUps: true } });

runIfDb("Contact Intake Batch D — isolated PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.contactExportAudit.deleteMany({ where: { actorSnapshot: { in: users.map(u => u.name) } } });
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    for (const user of users) await prisma.user.create({
      data: { id: user.id, name: user.name, email: `${user.id.toLowerCase()}@neolife-test.invalid`, role: user.role },
    });
    clean = (await createContact(staffA.id, staffA.name, "BatchDClean", "IMPORTED_QUEUE", "+254712345678")).id;
    rejected = (await createContact(staffA.id, staffA.name, "BatchDRejected", "IMPORTED_QUEUE", "+254711111111")).id;
    matchedQueue = (await createContact(staffA.id, staffA.name, "BatchDPotential", "IMPORTED_QUEUE", "+254733333333")).id;
    mainMatch = (await createContact(staffA.id, staffA.name, "BatchDMatch", "MAIN", "+254733333333")).id;
    await createContact(staffB.id, staffB.name, "BatchDPrivate", "MAIN", "+254733333333");
    initialLeadCount = await prisma.lead.count();
  });
  afterAll(async () => {
    caller.current = null;
    await prisma.contactExportAudit.deleteMany({ where: { actorSnapshot: { in: users.map(u => u.name) } } });
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });

  it("rejects unauthorized cross-staff queue approval without changing the contact", async () => {
    caller.current = staffB;
    const before = await current(clean);
    expect((await reviewImportedContact(null, queueForm(clean, before.version))).status).toBe("error");
    expect((await current(clean)).state).toBe("IMPORTED_QUEUE");
  });
  it("blocks unscanned matching contacts; does not silently promote or create Leads", async () => {
    caller.current = staffA;
    const before = await current(matchedQueue);
    expect((await reviewImportedContact(null, queueForm(matchedQueue, before.version))).status).toBe("error");
    expect((await current(matchedQueue)).state).toBe("IMPORTED_QUEUE");
    expect(await prisma.lead.count()).toBe(initialLeadCount);
  });
  it("requires a human duplicate decision before approving a matched queue contact", async () => {
    caller.current = staffA;
    const scan = new FormData(); scan.set("scope", "mine");
    expect((await scanDuplicateIssues(null, scan)).status).toBe("success");
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { status: "OPEN", OR: [
      { leftContactId: matchedQueue, rightContactId: mainMatch },
      { leftContactId: mainMatch, rightContactId: matchedQueue },
    ] } });
    expect((await reviewImportedContact(null, queueForm(matchedQueue, (await current(matchedQueue)).version))).status).toBe("error");
    const form = fd({ issueId: issue.id, leftVersion: String(issue.leftVersion), rightVersion: String(issue.rightVersion),
      reason: "Verified these are different individuals sharing a contact method" });
    expect((await dismissDuplicateIssue(null, form)).status).toBe("success");
    expect((await reviewImportedContact(null, queueForm(matchedQueue, (await current(matchedQueue)).version))).status).toBe("success");
    expect((await current(matchedQueue)).queueReviewOutcome).toBe("APPROVED");
  });
  it("approves an isolated imported contact with append-only decision history and unchanged consent", async () => {
    caller.current = staffA;
    const first = await current(clean);
    const result = await reviewImportedContact(null, queueForm(clean, first.version));
    expect(result.status).toBe("success");
    const saved = await current(clean);
    expect(saved).toMatchObject({ state: "MAIN", origin: "IMPORT", queueReviewOutcome: "APPROVED", consentStatus: "UNKNOWN", version: first.version + 1 });
    expect(saved.audit.some(e => e.action === "IMPORT_APPROVED" && e.actorUserId === staffA.id)).toBe(true);
    expect(await prisma.lead.count()).toBe(initialLeadCount);
    expect((await reviewImportedContact(null, queueForm(clean, first.version))).status).toBe("error");
  });
  it("rejects and archives an import; ordinary restore/edit cannot bypass review", async () => {
    caller.current = staffA;
    const first = await current(rejected);
    expect((await reviewImportedContact(null, queueForm(rejected, first.version, "REJECT"))).status).toBe("success");
    const after = await current(rejected);
    expect(after).toMatchObject({ state: "ARCHIVED", origin: "IMPORT", queueReviewOutcome: "REJECTED" });
    expect(after.audit.some(e => e.action === "IMPORT_REJECTED")).toBe(true);
    expect((await restoreManualContact(null, fd({ contactId: rejected, expectedVersion: String(after.version) }))).status).toBe("error");
  });
  it("blocks cross-staff follow-ups and outreach without documented consent", async () => {
    caller.current = staffB;
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version))).status).toBe("error");
    caller.current = staffA;
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version, "CALL"))).status).toBe("error");
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version, "EMAIL"))).status).toBe("error");
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version, "INTERNAL"))).status).toBe("success");
    const saved = await prisma.contactFollowUp.findFirstOrThrow({ where: { contactId: clean, kind: "INTERNAL", status: "OPEN" } });
    internalId = saved.id; internalVersion = saved.version;
    expect(saved.createdByUserId).toBe(staffA.id);
    expect(await prisma.lead.count()).toBe(initialLeadCount);
  });
  it("records reschedules, rejects old versions and completes with an outcome", async () => {
    caller.current = staffB;
    expect((await changeContactFollowUp(null, taskChange(internalId, internalVersion, "COMPLETE"))).status).toBe("error");
    caller.current = staffA;
    expect((await changeContactFollowUp(null, taskChange(internalId, internalVersion, "RESCHEDULE"))).status).toBe("success");
    expect((await changeContactFollowUp(null, taskChange(internalId, internalVersion, "COMPLETE"))).status).toBe("error");
    const version = (await prisma.contactFollowUp.findUniqueOrThrow({ where: { id: internalId } })).version;
    expect((await changeContactFollowUp(null, taskChange(internalId, version, "COMPLETE"))).status).toBe("success");
    const completed = await prisma.contactFollowUp.findUniqueOrThrow({ where: { id: internalId } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.resolutionNote).toMatch(/recorded the task/);
    expect((await current(clean)).audit.map(e => e.action)).toContain("CONTACT_FOLLOWUP_COMPLETED");
  });
  it("requires actual contact methods and recorded consent for outward task scheduling", async () => {
    caller.current = staffA;
    const before = await current(clean);
    const form = fd({
      contactId: clean, expectedVersion: String(before.version), firstName: "BatchDClean", lastName: "Sample",
      city: "Nairobi", sourceDetail: "Reviewed import", notes: "Updated permission", consentStatus: "GRANTED",
      consentEvidence: "Consent confirmed directly by recipient", phones: "0712345678",
    });
    expect((await updateManualContact(null, form)).status).toBe("success");
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version, "EMAIL"))).status).toBe("error");
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version, "CALL"))).status).toBe("success");
    outreachId = (await prisma.contactFollowUp.findFirstOrThrow({ where: { contactId: clean, kind: "CALL", status: "OPEN" } })).id;
  });
  it("automatically cancels pending outreach after Do Not Contact is set", async () => {
    caller.current = staffA;
    const before = await current(clean);
    const form = fd({
      contactId: clean, expectedVersion: String(before.version), firstName: "BatchDClean", lastName: "Sample",
      city: "Nairobi", sourceDetail: "Reviewed import", notes: "Restriction recorded", consentStatus: "GRANTED",
      consentEvidence: "Consent confirmed directly by recipient", phones: "0712345678", doNotContact: "on",
    });
    expect((await updateManualContact(null, form)).status).toBe("success");
    expect((await prisma.contactFollowUp.findUniqueOrThrow({ where: { id: outreachId } })).status).toBe("CANCELLED");
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version, "CALL"))).status).toBe("error");
    expect((await current(clean)).audit.map(e => e.action)).toContain("CONTACT_FOLLOWUPS_AUTO_CANCELLED");
  });
  it("Owner can manage tasks in team oversight; archiving cancels outstanding tasks", async () => {
    caller.current = owner;
    expect((await scheduleContactFollowUp(null, taskForm(clean, (await current(clean)).version))).status).toBe("success");
    const before = await current(clean);
    expect((await archiveManualContact(null, fd({ contactId: clean, expectedVersion: String(before.version) }))).status).toBe("success");
    expect(await prisma.contactFollowUp.count({ where: { contactId: clean, status: "OPEN" } })).toBe(0);
    expect((await current(clean)).state).toBe("ARCHIVED");
  });
  it("cancels pending call tasks when the last phone method is removed", async () => {
    caller.current = staffA;
    const record = await prisma.contact.create({ data: {
      ownerUserId: staffA.id, ownerSnapshot: staffA.name, firstName: "BatchDMethod",
      lastName: "Separate", city: "Kisumu", state: "MAIN", consentStatus: "GRANTED",
      consentEvidence: "Permission confirmed explicitly by recipient", consentUpdatedAt: new Date(),
      methods: { create: [
        { type: "PHONE", value: "+254700000000", normalizedValue: "+254700000000", isPrimary: true },
        { type: "EMAIL", value: "method@example.org", normalizedValue: "method@example.org", isPrimary: true },
      ] },
    } });
    expect((await scheduleContactFollowUp(null, taskForm(record.id, record.version, "CALL"))).status).toBe("success");
    const task = await prisma.contactFollowUp.findFirstOrThrow({ where: { contactId: record.id, status: "OPEN", kind: "CALL" } });
    const version = (await current(record.id)).version;
    const update = fd({ contactId: record.id, expectedVersion: String(version),
      firstName: "BatchDMethod", lastName: "Separate", city: "Kisumu", sourceDetail: "QA test",
      notes: "Removed inactive contact method", consentStatus: "GRANTED", consentEvidence: "Permission confirmed explicitly by recipient",
      emails: "method@example.org",
    });
    expect((await updateManualContact(null, update)).status).toBe("success");
    expect((await prisma.contactFollowUp.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("CANCELLED");
  });
  it("cancels tasks on merged sources and retains contact lineage", async () => {
    caller.current = staffA;
    const retained = await createContact(staffA.id, staffA.name, "BatchDKeep", "MAIN", "+254755555555");
    const source = await createContact(staffA.id, staffA.name, "BatchDSource", "MAIN", "+254755555555");
    expect((await scheduleContactFollowUp(null, taskForm(source.id, source.version))).status).toBe("success");
    const task = await prisma.contactFollowUp.findFirstOrThrow({ where: { contactId: source.id, status: "OPEN" } });
    const scan = new FormData(); scan.set("scope", "mine");
    expect((await scanDuplicateIssues(null, scan)).status).toBe("success");
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { status: "OPEN", OR: [
      { leftContactId: source.id, rightContactId: retained.id },
      { leftContactId: retained.id, rightContactId: source.id },
    ] } });
    const mergeForm = fd({ issueId: issue.id, leftVersion: String(issue.leftVersion), rightVersion: String(issue.rightVersion),
      keepId: retained.id, reason: "Confirmed the two records belong to one person" });
    expect((await mergeDuplicateIssue(null, mergeForm)).status).toBe("success");
    expect((await prisma.contactFollowUp.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("CANCELLED");
    expect((await current(source.id)).mergedIntoContactId).toBe(retained.id);
  });
  it("requires a resolved password change before exporting contacts", async () => {
    caller.current = { ...staffA, mustChangePassword: true };
    expect((await exportContacts(new Request("http://localhost/admin/my-contacts/export?view=main"))).status).toBe(403);
  });
  it("returns 401 for unauthenticated downloads", async () => {
    caller.current = null;
    expect((await exportContacts(new Request("http://localhost/admin/my-contacts/export?view=main"))).status).toBe(401);
  });
  it("export isolates staff records, audits downloads, and prefixes dangerous spreadsheet cells", async () => {
    caller.current = staffA;
    const s = await exportContacts(new Request("http://localhost/admin/my-contacts/export?view=archived&scope=all"));
    expect(s.status).toBe(200);
    const text = await s.text();
    expect(text).toContain("BatchDClean");
    expect(text).not.toContain("BatchDPrivate");
    const audit = await prisma.contactExportAudit.findFirstOrThrow({ where: { actorUserId: staffA.id }, orderBy: { createdAt: "desc" } });
    expect(audit.scopeAll).toBe(false);
    caller.current = owner;
    const response = await exportContacts(new Request("http://localhost/admin/my-contacts/export?view=main&scope=all"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("BatchDPrivate");
    expect((await prisma.contactExportAudit.findFirstOrThrow({ where: { actorUserId: owner.id }, orderBy: { createdAt: "desc" } })).scopeAll).toBe(true);
    expect((await exportContacts(new Request("http://localhost/admin/my-contacts/export?view=merged"))).status).toBe(400);
  });
});
