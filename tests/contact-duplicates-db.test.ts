import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { contactListScope } from "../src/lib/contact-intake";

const { caller } = vi.hoisted(() => ({
  caller: { current: null as null | { id: string; name: string; role: "admin" | "staff"; mustChangePassword: boolean } },
}));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => { if (!caller.current) throw new Error("UNAUTHENTICATED"); return caller.current; },
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import {
  scanDuplicateIssues, dismissDuplicateIssue, mergeDuplicateIssue,
} from "../src/app/admin/(protected)/my-contacts/duplicates/actions";

const localDatabase = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL || "");
    return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) && /test|qa|ci/i.test(u.pathname);
  } catch { return false; }
})();
const runIfDb = localDatabase ? describe : describe.skip;
const staffA = { id: "NeolifeDuplicateCStaffA", name: "BatchC QA Staff A", role: "staff" as const, mustChangePassword: false };
const staffB = { id: "NeolifeDuplicateCStaffB", name: "BatchC QA Staff B", role: "staff" as const, mustChangePassword: false };
const owner = { id: "NeolifeDuplicateCOwner", name: "BatchC QA Owner", role: "admin" as const, mustChangePassword: false };
const users = [staffA, staffB, owner];
let a = "", b = "", queue = "", otherStaff = "";
let leadCount = 0;
const method = (value: string, isPrimary = true) => ({
  type: "PHONE" as const, value, normalizedValue: value === "0712345678" ? "+254712345678" : "+254733456789", isPrimary,
});
const scan = (all = false) => {
  const f = new FormData();
  f.set("scope", all ? "all" : "mine");
  return scanDuplicateIssues(null, f);
};
const reviewForm = (issue: { id: string; leftVersion: number; rightVersion: number }, keepId?: string) => {
  const f = new FormData();
  f.set("issueId", issue.id);
  f.set("leftVersion", String(issue.leftVersion));
  f.set("rightVersion", String(issue.rightVersion));
  f.set("reason", "Confirmed identity during careful manual review");
  if (keepId) f.set("keepId", keepId);
  return f;
};

runIfDb("Contact Intake Batch C — isolated PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    for (const u of users) await prisma.user.create({
      data: { id: u.id, name: u.name, email: `${u.id.toLowerCase()}@neolife-test.invalid`, role: u.role },
    });
    leadCount = await prisma.lead.count();
    const create = (ownerUserId: string, ownerSnapshot: string, firstName: string,
      state: "MAIN" | "IMPORTED_QUEUE", phone: string, consentStatus: "GRANTED" | "DENIED" | "UNKNOWN", doNotContact = false) =>
      prisma.contact.create({ data: {
        ownerUserId, ownerSnapshot, firstName, lastName: "Sample", city: "Nairobi", notes: `Original notes: ${firstName}`,
        state, origin: state === "MAIN" ? "MANUAL" : "IMPORT", consentStatus,
        consentEvidence: consentStatus === "GRANTED" ? "Explicit consent confirmed in writing" : null,
        doNotContact, doNotContactAt: doNotContact ? new Date() : null,
        methods: { create: [method(phone)] },
      } });
    a = (await create(staffA.id, staffA.name, "Alice", "MAIN", "0712345678", "GRANTED")).id;
    b = (await create(staffA.id, staffA.name, "Alicia", "MAIN", "0712345678", "DENIED", true)).id;
    queue = (await create(staffA.id, staffA.name, "Imported", "IMPORTED_QUEUE", "0712345678", "UNKNOWN")).id;
    otherStaff = (await create(staffB.id, staffB.name, "Other owner", "MAIN", "0712345678", "GRANTED")).id;
  });
  afterAll(async () => {
    caller.current = null;
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });
  it("creates same-owner candidate issues only, idempotently, without Leads", async () => {
    caller.current = staffA;
    expect((await scan()).status).toBe("success");
    const issues = await prisma.contactDuplicateIssue.findMany({ where: { ownerUserId: staffA.id } });
    expect(issues).toHaveLength(3);
    expect(issues.every(x => x.status === "OPEN")).toBe(true);
    expect(issues.every(x => x.leftContactId !== otherStaff && x.rightContactId !== otherStaff)).toBe(true);
    caller.current = owner;
    expect((await scan(true)).status).toBe("success");
    expect(await prisma.contactDuplicateIssue.count()).toBe(3); // no cross-owner pair
    caller.current = staffA;
    expect((await scan()).status).toBe("success");
    expect(await prisma.contactDuplicateIssue.count({ where: { ownerUserId: staffA.id } })).toBe(3);
    expect(await prisma.lead.count()).toBe(leadCount);
  });
  it("does not leak another owner's pair through staff scope or forged review", async () => {
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { ownerUserId: staffA.id, OR: [ { leftContactId: a, rightContactId: b }, { leftContactId: b, rightContactId: a } ] } });
    caller.current = staffB;
    expect(await prisma.contactDuplicateIssue.count({ where: contactListScope(staffB.role, staffB.id, true) })).toBe(0);
    expect((await dismissDuplicateIssue(null, reviewForm(issue))).status).toBe("error");
    expect((await mergeDuplicateIssue(null, reviewForm(issue, a))).status).toBe("error");
    expect((await prisma.contactDuplicateIssue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("OPEN");
  });
  it("blocks same-owner cross-list merge even with a matching phone", async () => {
    caller.current = staffA;
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { ownerUserId: staffA.id,
      OR: [{ leftContactId: a, rightContactId: queue }, { leftContactId: queue, rightContactId: a }] },
    });
    const result = await mergeDuplicateIssue(null, reviewForm(issue, a));
    expect(result.status).toBe("error");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: queue } })).toMatchObject({ state: "IMPORTED_QUEUE" });
  });
  it("requires fresh versions; a rescan updates the open issue", async () => {
    caller.current = staffA;
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { ownerUserId: staffA.id,
      OR: [{ leftContactId: a, rightContactId: b }, { leftContactId: b, rightContactId: a }] },
    });
    await prisma.contact.update({ where: { id: a }, data: { version: { increment: 1 } } });
    expect((await mergeDuplicateIssue(null, reviewForm(issue, a))).status).toBe("error");
    expect((await scan()).status).toBe("success");
    const refreshed = await prisma.contactDuplicateIssue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(refreshed.leftVersion + refreshed.rightVersion).toBe(issue.leftVersion + issue.rightVersion + 1);
  });
  it("Owner may dismiss a match with audit, and repeated scans preserve dismissal", async () => {
    caller.current = owner;
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { ownerUserId: staffA.id,
      OR: [{ leftContactId: a, rightContactId: queue }, { leftContactId: queue, rightContactId: a }] },
    });
    expect((await dismissDuplicateIssue(null, reviewForm(issue))).status).toBe("success");
    expect(await prisma.contactAuditEvent.count({ where: { contactId: a, action: "DUPLICATE_DISMISSED", actorUserId: owner.id } })).toBe(1);
    caller.current = staffA;
    expect((await scan()).status).toBe("success");
    expect((await prisma.contactDuplicateIssue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("DISMISSED");
  });
  it("merges only confirmed same-state contacts; retains source/audit and strictest consent", async () => {
    caller.current = staffA;
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { ownerUserId: staffA.id,
      OR: [{ leftContactId: a, rightContactId: b }, { leftContactId: b, rightContactId: a }] },
    });
    const result = await mergeDuplicateIssue(null, reviewForm(issue, a));
    expect(result).toMatchObject({ status: "success", retainedId: a });
    const retained = await prisma.contact.findUniqueOrThrow({ where: { id: a }, include: { methods: true, audit: true } });
    const source = await prisma.contact.findUniqueOrThrow({ where: { id: b }, include: { methods: true, audit: true } });
    expect(retained).toMatchObject({ state: "MAIN", consentStatus: "DENIED", doNotContact: true, firstName: "Alice" });
    expect(retained.notes).toBe("Original notes: Alice");
    expect(source).toMatchObject({ state: "MERGED", mergedIntoContactId: a, firstName: "Alicia", doNotContact: true });
    expect(source.methods).toHaveLength(1);
    expect(source.audit.some(ev => ev.action === "DUPLICATE_MERGED_INTO" && ev.before && ev.after)).toBe(true);
    expect(retained.audit.some(ev => ev.action === "DUPLICATE_MERGE_RETAINED" && ev.before && ev.after)).toBe(true);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: queue } })).state).toBe("IMPORTED_QUEUE");
    expect(await prisma.lead.count()).toBe(leadCount);
  });
  it("rejects replayed merge and leaves the retained record unchanged", async () => {
    caller.current = staffA;
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { ownerUserId: staffA.id, status: "MERGED" } });
    const original = await prisma.contact.findUniqueOrThrow({ where: { id: a } });
    expect((await mergeDuplicateIssue(null, reviewForm(issue, a))).status).toBe("error");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: a } })).toMatchObject({ version: original.version });
  });
  it("can merge two reviewed queued imports without ever promoting to Main Contacts", async () => {
    caller.current = staffA;
    const twin = await prisma.contact.create({ data: {
      ownerUserId: staffA.id, ownerSnapshot: staffA.name, firstName: "Import Twin", lastName: "Different", city: "Nairobi",
      origin: "IMPORT", state: "IMPORTED_QUEUE", consentStatus: "GRANTED", consentEvidence: "Recipient granted consent in written form",
      methods: { create: [method("0712345678")] },
    } });
    expect((await scan()).status).toBe("success");
    const issue = await prisma.contactDuplicateIssue.findFirstOrThrow({ where: { status: "OPEN", ownerUserId: staffA.id,
      OR: [{ leftContactId: queue, rightContactId: twin.id }, { leftContactId: twin.id, rightContactId: queue }] },
    });
    const result = await mergeDuplicateIssue(null, reviewForm(issue, queue));
    expect(result.status).toBe("success");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: queue } })).toMatchObject({ state: "IMPORTED_QUEUE", consentStatus: "UNKNOWN" });
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: twin.id } })).toMatchObject({ state: "MERGED", mergedIntoContactId: queue });
    expect(await prisma.lead.count()).toBe(leadCount);
  });
  it("enforces authentication and password-change guard on scan", async () => {
    caller.current = null;
    await expect(scan()).rejects.toThrow("UNAUTHENTICATED");
    caller.current = { ...staffA, mustChangePassword: true };
    await expect(scan()).rejects.toThrow("REDIRECT:/admin/change-password");
  });
});
