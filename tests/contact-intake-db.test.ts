import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";

const { caller } = vi.hoisted(() => ({
  caller: { current: null as null | { id: string; role: "admin" | "staff"; name: string; mustChangePassword: boolean } },
}));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => {
    if (!caller.current) throw new Error("UNAUTHENTICATED");
    return caller.current;
  },
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import {
  archiveManualContact,
  createManualContact,
  restoreManualContact,
  updateManualContact,
} from "../src/app/admin/(protected)/my-contacts/actions";

const runIfDb = process.env.DATABASE_URL ? describe : describe.skip;
const staffA = { id: "NeolifeContactTestStaffA", role: "staff" as const, name: "Contact QA A", mustChangePassword: false };
const staffB = { id: "NeolifeContactTestStaffB", role: "staff" as const, name: "Contact QA B", mustChangePassword: false };
const owner = { id: "NeolifeContactTestOwner", role: "admin" as const, name: "Contact QA Owner", mustChangePassword: false };
const users = [staffA, staffB, owner];
const created: string[] = [];

function form(fields: Record<string, string | string[]> = {}): FormData {
  const fd = new FormData();
  const values: Record<string, string | string[]> = {
    firstName: "BatchA", lastName: "Test", city: "Nairobi", sourceDetail: "Test fixture",
    notes: "Initial note", consentStatus: "UNKNOWN", consentEvidence: "", phones: ["0712345678"], emails: ["contact-fixture@example.org"],
    ...fields,
  };
  for (const [key, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : [value]) fd.append(key, entry);
  }
  return fd;
}
async function snapshot(id: string) {
  const row = await prisma.contact.findUniqueOrThrow({ where: { id }, include: { methods: true, audit: true } });
  return row;
}
function changeForm(id: string, version: number, fields: Record<string, string | string[]> = {}) {
  return form({ contactId: id, expectedVersion: String(version), ...fields });
}

runIfDb("Contact intake Batch A — isolated PostgreSQL integration", () => {
  beforeAll(async () => {
    // Only the uniquely named synthetic fixtures may be cleaned up.
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    for (const u of users) await prisma.user.create({
      data: { id: u.id, name: u.name, email: `${u.id.toLowerCase()}@neolife-test.invalid`, role: u.role },
    });
  });
  afterAll(async () => {
    caller.current = null;
    if (created.length) await prisma.contact.deleteMany({ where: { id: { in: created } } });
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });
  it("creates a MAIN personal contact and audit event but never a Lead", async () => {
    caller.current = staffA;
    const leadCount = await prisma.lead.count();
    const result = await createManualContact(null, form());
    expect(result.status).toBe("success");
    expect(result.contactId).toBeTruthy();
    created.push(result.contactId!);
    const record = await snapshot(result.contactId!);
    expect(record).toMatchObject({ ownerUserId: staffA.id, state: "MAIN", origin: "MANUAL", consentStatus: "UNKNOWN", doNotContact: false });
    expect(record.methods).toHaveLength(2);
    expect(record.methods.find(m => m.type === "PHONE")?.normalizedValue).toBe("+254712345678");
    expect(record.audit.map(e => e.action)).toEqual(["CREATED"]);
    expect(await prisma.lead.count()).toBe(leadCount);
  });
  it("allows the same phone on independent contact records with no automatic merge", async () => {
    caller.current = staffB;
    const result = await createManualContact(null, form({ firstName: "Different", emails: ["different@example.net"] }));
    expect(result.status).toBe("success");
    created.push(result.contactId!);
    expect(await prisma.contactMethod.count({ where: { normalizedValue: "+254712345678" } })).toBeGreaterThanOrEqual(2);
  });
  it("refuses cross-staff updates without disclosing another user's record", async () => {
    const first = await snapshot(created[0]);
    caller.current = staffB;
    const result = await updateManualContact(null, changeForm(first.id, first.version, { firstName: "Unauthorized" }));
    expect(result.status).toBe("error");
    expect((await snapshot(first.id)).firstName).toBe("BatchA");
  });
  it("Owner can perform authorized oversight edits with audit attribution", async () => {
    const first = await snapshot(created[0]);
    caller.current = owner;
    const result = await updateManualContact(null, changeForm(first.id, first.version, {
      firstName: "Updated", phones: ["0712345678", "+254733456789"], emails: ["contact-fixture@example.org"],
      consentStatus: "DENIED", notes: "No outreach",
    }));
    expect(result.status).toBe("success");
    const updated = await snapshot(first.id);
    expect(updated.firstName).toBe("Updated");
    expect(updated.ownerUserId).toBe(staffA.id);
    expect(updated.methods).toHaveLength(3);
    expect(updated.consentStatus).toBe("DENIED");
    expect(updated.consentUpdatedAt).not.toBeNull();
    expect(updated.version).toBe(first.version + 1);
    expect(updated.audit.some(e => e.action === "UPDATED" && e.actorUserId === owner.id && e.before !== null)).toBe(true);
  });
  it("rejects an old version instead of silently overwriting a new edit", async () => {
    caller.current = staffA;
    const first = await snapshot(created[0]);
    const oldForm = changeForm(first.id, first.version - 1, { firstName: "Bad edit" });
    const result = await updateManualContact(null, oldForm);
    expect(result.status).toBe("error");
    expect((await snapshot(first.id)).firstName).toBe("Updated");
  });
  it("records DNC as a restriction even with a granted consent flag", async () => {
    caller.current = staffA;
    const first = await snapshot(created[0]);
    const update = changeForm(first.id, first.version, { consentStatus: "GRANTED", consentEvidence: "Confirmed verbally by recipient" });
    update.set("doNotContact", "on");
    expect((await updateManualContact(null, update)).status).toBe("success");
    const current = await snapshot(first.id);
    expect(current.doNotContact).toBe(true);
    expect(current.consentStatus).toBe("GRANTED");
    expect(current.consentEvidence).toBe("Confirmed verbally by recipient");
    expect(current.doNotContactAt).not.toBeNull();
  });
  it("requires evidence before lifting a Do Not Contact restriction", async () => {
    caller.current = staffA;
    const prior = await snapshot(created[0]);
    const withoutReason = changeForm(prior.id, prior.version, { consentStatus: "DENIED" });
    expect((await updateManualContact(null, withoutReason)).status).toBe("error");
    expect((await snapshot(prior.id)).doNotContact).toBe(true);
    const documented = changeForm(prior.id, prior.version, { consentStatus: "DENIED", dncLiftReason: "Recipient requested removal after correction" });
    expect((await updateManualContact(null, documented)).status).toBe("success");
    const after = await snapshot(prior.id);
    expect(after.doNotContact).toBe(false);
    expect(after.audit.some(e => e.reason === "Recipient requested removal after correction")).toBe(true);
  });
  it("staff cannot archive or restore a colleague's contact", async () => {
    const first = await snapshot(created[0]);
    caller.current = staffB;
    expect((await archiveManualContact(null, changeForm(first.id, first.version))).status).toBe("error");
    expect((await snapshot(first.id)).state).toBe("MAIN");
  });
  it("archives and restores a contact with two durable audit events", async () => {
    const first = await snapshot(created[0]);
    caller.current = staffA;
    expect((await archiveManualContact(null, changeForm(first.id, first.version))).status).toBe("success");
    const archived = await snapshot(first.id);
    expect(archived.state).toBe("ARCHIVED");
    expect((await restoreManualContact(null, changeForm(first.id, archived.version))).status).toBe("success");
    const restored = await snapshot(first.id);
    expect(restored.state).toBe("MAIN");
    expect(restored.audit.map(e => e.action)).toContain("ARCHIVED");
    expect(restored.audit.map(e => e.action)).toContain("RESTORED");
    expect(restored.methods).toHaveLength(2);
  });
  it("rejects unauthenticated and forced-password-change actions", async () => {
    caller.current = null;
    await expect(createManualContact(null, form())).rejects.toThrow("UNAUTHENTICATED");
    caller.current = { ...staffA, mustChangePassword: true };
    await expect(createManualContact(null, form())).rejects.toThrow("REDIRECT:/admin/change-password");
  });
  it("preserves a contact when Better Auth deletes the owning user", async () => {
    caller.current = staffB;
    const record = await prisma.contact.findUniqueOrThrow({ where: { id: created[1] } });
    expect(record.ownerUserId).toBe(staffB.id);
    await prisma.user.delete({ where: { id: staffB.id } });
    const preserved = await prisma.contact.findUniqueOrThrow({ where: { id: record.id } });
    expect(preserved.ownerUserId).toBeNull();
    expect(preserved.ownerSnapshot).toBe(staffB.name);
    expect(preserved.state).toBe("MAIN");
  });
});
