import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { guessMapping, IMPORT_FIELDS } from "../src/lib/contact-import-fields";
import { contactListScope } from "../src/lib/contact-intake";

const { caller } = vi.hoisted(() => ({
  caller: { current: null as null | { id: string; role: "admin" | "staff"; name: string; mustChangePassword: boolean } },
}));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => { if (!caller.current) throw new Error("UNAUTHENTICATED"); return caller.current; },
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { previewContactSheet, confirmContactSheet } from "../src/app/admin/(protected)/my-contacts/import/actions";

const isLocalTest = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /test|qa|ci/i.test(url.pathname);
  } catch { return false; }
})();
const runIfDb = isLocalTest ? describe : describe.skip;
const staffA = { id: "NeolifeImportBStaffA", role: "staff" as const, name: "BatchB QA Staff A", mustChangePassword: false };
const staffB = { id: "NeolifeImportBStaffB", role: "staff" as const, name: "BatchB QA Staff B", mustChangePassword: false };
const owner = { id: "NeolifeImportBOwner", role: "admin" as const, name: "BatchB QA Owner", mustChangePassword: false };
const users = [staffA, staffB, owner];
const csv = "First Name,Last Name,Phone,Consent,Consent Evidence,Opt Out,Notes\nAlice,Test,0712345678,granted,Consent confirmed in writing,no,Good contact\nBob,Test,not-a-phone,unknown,,no,Invalid phone\nCarol,Test,0733456789,unknown,,yes,Do not contact";
function upload(text = csv, name = "qa-import.csv") {
  const form = new FormData();
  form.set("sheet", new File([text], name, { type: "text/csv" }));
  return form;
}
function submit(batchId: string) {
  const mapping = guessMapping(["First Name", "Last Name", "Phone", "Consent", "Consent Evidence", "Opt Out", "Notes"]);
  const form = new FormData();
  form.set("batchId", batchId);
  for (const field of IMPORT_FIELDS) form.set(`map_${field}`, mapping[field] === null ? "" : String(mapping[field]));
  return form;
}
let batchId = "";
let initialLeadCount = 0;

runIfDb("Batch B import queue — isolated PostgreSQL integration", () => {
  beforeAll(async () => {
    // Test-only fixture boundary; never remove unrelated records.
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.contactImportBatch.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    for (const user of users) await prisma.user.create({ data: { id: user.id, name: user.name, email: `${user.id.toLowerCase()}@neolife-test.invalid`, role: user.role } });
    initialLeadCount = await prisma.lead.count();
  });
  afterAll(async () => {
    caller.current = null;
    await prisma.contact.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.contactImportBatch.deleteMany({ where: { ownerSnapshot: { in: users.map(u => u.name) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });
  it("creates a private PREVIEW with rows but no Contact or Lead", async () => {
    caller.current = staffA;
    const result = await previewContactSheet(null, upload());
    expect(result.status).toBe("preview");
    batchId = result.batchId!;
    expect(result.total).toBe(3);
    const batch = await prisma.contactImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rows: true } });
    expect(batch.status).toBe("PREVIEW");
    expect(batch.rows).toHaveLength(3);
    expect(await prisma.contact.count({ where: { importBatchId: batchId } })).toBe(0);
    expect(await prisma.lead.count()).toBe(initialLeadCount);
  });
  it("never lets a different staff member confirm another user's upload", async () => {
    caller.current = staffB;
    const result = await confirmContactSheet(null, submit(batchId));
    expect(result.status).toBe("error");
    expect(await prisma.contactImportBatch.findUniqueOrThrow({ where: { id: batchId } })).toMatchObject({ status: "PREVIEW" });
  });
  it("never lets Owner change another user's upload without authorization", async () => {
    caller.current = owner;
    const result = await confirmContactSheet(null, submit(batchId));
    expect(result.status).toBe("error");
  });
  it("rejects invalid mapping while retaining preview state", async () => {
    caller.current = staffA;
    const form = submit(batchId);
    form.set("map_phone1", "0"); // duplicates First name column
    expect((await confirmContactSheet(null, form)).status).toBe("error");
    expect(await prisma.contact.count({ where: { importBatchId: batchId } })).toBe(0);
  });
  it("confirms valid rows into queue, records errors and never creates Leads", async () => {
    caller.current = staffA;
    const result = await confirmContactSheet(null, submit(batchId));
    expect(result.status).toBe("success");
    const batch = await prisma.contactImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rows: true, contacts: { include: { methods: true, audit: true } } } });
    expect(batch.status).toBe("COMPLETE");
    expect(batch.importedRows).toBe(2);
    expect(batch.invalidRows).toBe(1);
    expect(batch.rows.find(r => r.status === "INVALID")?.error).toContain("valid Kenya");
    expect(batch.contacts).toHaveLength(2);
    expect(batch.contacts.every(c => c.state === "IMPORTED_QUEUE" && c.origin === "IMPORT" && c.ownerUserId === staffA.id)).toBe(true);
    expect(batch.contacts.every(c => c.audit.some(a => a.action === "IMPORTED"))).toBe(true);
    expect(batch.contacts.find(c => c.firstName === "Alice")?.consentStatus).toBe("GRANTED");
    expect(batch.contacts.find(c => c.firstName === "Carol")?.doNotContact).toBe(true);
    expect(await prisma.lead.count()).toBe(initialLeadCount);
  });
  it("refuses repeat confirmation and exact-file reupload with no duplicates", async () => {
    caller.current = staffA;
    expect((await confirmContactSheet(null, submit(batchId))).status).toBe("error");
    const again = await previewContactSheet(null, upload());
    expect(again.status).toBe("existing");
    expect(again.batchId).toBe(batchId);
    expect(await prisma.contact.count({ where: { importBatchId: batchId } })).toBe(2);
  });
  it("does not expose staff A contacts in staff B's private scope", async () => {
    const scoped = await prisma.contact.findMany({ where: { ...contactListScope(staffB.role, staffB.id, true), importBatchId: batchId } });
    expect(scoped).toHaveLength(0);
    expect(await prisma.contact.count({ where: { ...contactListScope(owner.role, owner.id, true), importBatchId: batchId } })).toBe(2);
  });
  it("keeps the same valid number on a second spreadsheet without silently merging", async () => {
    caller.current = staffB;
    const second = await previewContactSheet(null, upload("First Name,Phone\nDifferent,0712345678", "other-batch.csv"));
    expect(second.status).toBe("preview");
    const form = new FormData();
    form.set("batchId", second.batchId!);
    for (const field of IMPORT_FIELDS) form.set(`map_${field}`, field === "firstName" ? "0" : field === "phone1" ? "1" : "");
    expect((await confirmContactSheet(null, form)).status).toBe("success");
    expect(await prisma.contactMethod.count({ where: { normalizedValue: "+254712345678" } })).toBeGreaterThanOrEqual(2);
    expect(await prisma.lead.count()).toBe(initialLeadCount);
  });
});
