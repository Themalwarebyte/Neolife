import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";

const { caller } = vi.hoisted(() => ({ caller: { current: null as null | { id: string; role: "admin" | "staff"; name: string; mustChangePassword: boolean } } }));
vi.mock("@/server/auth/requireCrmUser", () => ({ requireCrmUser: async () => { if (!caller.current) throw new Error("UNAUTHENTICATED"); return caller.current; } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { bulkManageContacts } from "../src/app/admin/(protected)/my-contacts/bulk-actions";
import { cancelPendingContactTransfer, respondToContactTransfer } from "../src/app/admin/(protected)/my-contacts/transfers/actions";

const dbEnabled = (() => {
  try { const url = new URL(process.env.DATABASE_URL || ""); return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /test|qa|ci/i.test(url.pathname); }
  catch { return false; }
})();
const runIfDb = dbEnabled ? describe : describe.skip;
const admin = { id: "NeolifeBatchETransferAdmin", role: "admin" as const, name: "Batch E Transfer Admin", mustChangePassword: false };
const staffA = { id: "NeolifeBatchETransferA", role: "staff" as const, name: "Batch E Transfer A", mustChangePassword: false };
const staffB = { id: "NeolifeBatchETransferB", role: "staff" as const, name: "Batch E Transfer B", mustChangePassword: false };
const users = [admin, staffA, staffB];
const contactIds: string[] = [];

async function createContact(ownerUserId: string | null, ownerSnapshot: string, state: "MAIN" | "IMPORTED_QUEUE" | "CONTACT_POOL" = "MAIN") {
  const row = await prisma.contact.create({ data: { ownerUserId, ownerSnapshot, firstName: "BatchETransfer", lastName: "Fixture", state,
    origin: state === "IMPORTED_QUEUE" ? "IMPORT" : "MANUAL", consentStatus: "UNKNOWN", doNotContact: false } });
  contactIds.push(row.id);
  return row;
}
function bulkForm(action: string, ids: string[], recipient?: string) {
  const form = new FormData(); form.set("bulkAction", action); form.set("view", "main");
  if (recipient) form.set("recipientUserId", recipient);
  for (const id of ids) form.append("contactIds", id);
  return form;
}
function decisionForm(id: string, decision: string, reason = "Recipient declined this contact transfer.") {
  const form = new FormData(); form.set("transferId", id); form.set("decision", decision); form.set("reason", reason); return form;
}

runIfDb("Batch E contact transfers — isolated PostgreSQL integration", () => {
  beforeAll(async () => {
    // Transfer rows must be explicitly cleaned before fixture contacts because
    // production now restricts permanent deletion when transfer history exists.
    await prisma.contactTransfer.deleteMany({ where: { contact: { is: { firstName: "BatchETransfer" } } } });
    await prisma.contact.deleteMany({ where: { firstName: "BatchETransfer" } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    for (const user of users) await prisma.user.create({ data: { id: user.id, name: user.name, email: `${user.id.toLowerCase()}@neolife-test.invalid`, role: user.role } });
  });
  afterAll(async () => {
    caller.current = null;
    if (contactIds.length) {
      await prisma.contactTransfer.deleteMany({ where: { contactId: { in: contactIds } } });
      await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
    }
    await prisma.contactTransfer.deleteMany({ where: { contact: { is: { firstName: "BatchETransfer" } } } });
    await prisma.contact.deleteMany({ where: { firstName: "BatchETransfer" } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });

  it("keeps a transfer pending until recipient approval and then changes owner", async () => {
    const contact = await createContact(staffA.id, staffA.name, "MAIN");
    caller.current = admin;
    const queued = await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    expect(queued.status).toBe("success");
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).state).toBe("TRANSFER_PENDING");
    caller.current = staffB;
    expect((await respondToContactTransfer(null, decisionForm(transfer.id, "APPROVE"))).status).toBe("success");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({ ownerUserId: staffB.id, state: "MAIN" });
    expect(await prisma.contactTransfer.findUniqueOrThrow({ where: { id: transfer.id } })).toMatchObject({ status: "APPROVED", decidedByUserId: staffB.id });
  });

  it("returns rejected transfers to their source state and preserves rejection history", async () => {
    const contact = await createContact(staffA.id, staffA.name, "IMPORTED_QUEUE");
    caller.current = admin;
    await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });
    caller.current = staffB;
    const result = await respondToContactTransfer(null, decisionForm(transfer.id, "REJECT", "The recipient cannot manage this record yet."));
    expect(result.status).toBe("success");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({ ownerUserId: staffA.id, state: "IMPORTED_QUEUE" });
    expect(await prisma.contactTransfer.findUniqueOrThrow({ where: { id: transfer.id } })).toMatchObject({ status: "REJECTED", rejectionReason: "The recipient cannot manage this record yet." });
  });

  it("lets the Owner cancel a pending transfer and restore the contact for reassignment", async () => {
    const contact = await createContact(staffA.id, staffA.name, "MAIN");
    caller.current = admin;
    await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });

    await prisma.user.update({ where: { id: staffB.id }, data: { isActive: false } });
    caller.current = admin;
    const form = new FormData();
    form.set("transferId", transfer.id);
    form.set("reason", "Recipient account is inactive; return contact for reassignment.");
    const result = await cancelPendingContactTransfer(null, form);

    expect(result.status).toBe("success");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      ownerUserId: staffA.id, ownerSnapshot: staffA.name, state: "MAIN", version: contact.version + 2,
    });
    expect(await prisma.contactTransfer.findUniqueOrThrow({ where: { id: transfer.id } })).toMatchObject({
      status: "CANCELLED", decidedByUserId: admin.id,
      decisionReason: "Recipient account is inactive; return contact for reassignment.",
    });
    expect(await prisma.contactAuditEvent.count({
      where: { contactId: contact.id, action: "CONTACT_TRANSFER_ADMIN_CANCELLED" },
    })).toBe(1);

    // Once the recipient is available again, the Owner can create a new request.
    await prisma.user.update({ where: { id: staffB.id }, data: { isActive: true } });
    const reassigned = await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    expect(reassigned.status).toBe("success");
    expect(await prisma.contactTransfer.count({ where: { contactId: contact.id, status: "PENDING" } })).toBe(1);
  });

  it("refuses administrator cancellation when a pending contact version no longer matches the transfer", async () => {
    const contact = await createContact(staffA.id, staffA.name, "MAIN");
    caller.current = admin;
    await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });

    // Simulate a stale/out-of-band contact update while the transfer is pending.
    await prisma.contact.update({ where: { id: contact.id }, data: { version: { increment: 1 } } });
    const form = new FormData();
    form.set("transferId", transfer.id);
    form.set("reason", "Contact changed during transfer; investigate before cancellation.");

    const result = await cancelPendingContactTransfer(null, form);
    expect(result.status).toBe("error");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      ownerUserId: staffA.id, state: "TRANSFER_PENDING", version: transfer.expectedContactVersion + 1,
    });
    expect(await prisma.contactTransfer.findUniqueOrThrow({ where: { id: transfer.id } })).toMatchObject({ status: "PENDING" });
  });

  it("blocks permanent deletion of a contact with transfer history", async () => {
    const contact = await createContact(staffA.id, staffA.name, "MAIN");
    caller.current = admin;
    await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });

    caller.current = staffB;
    const rejected = await respondToContactTransfer(null, decisionForm(
      transfer.id,
      "REJECT",
      "The recipient cannot manage this record yet.",
    ));
    expect(rejected.status).toBe("success");

    await expect(prisma.contact.delete({ where: { id: contact.id } })).rejects.toThrow();
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      ownerUserId: staffA.id, state: "MAIN",
    });
    expect(await prisma.contactTransfer.findUniqueOrThrow({ where: { id: transfer.id } })).toMatchObject({
      status: "REJECTED", rejectionReason: "The recipient cannot manage this record yet.",
    });
  });

  it("keeps Contact Pool ownership unassigned if its transfer is rejected", async () => {
    const contact = await createContact(null, "Contact Pool", "CONTACT_POOL");
    caller.current = admin;
    await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });
    caller.current = staffB;
    expect((await respondToContactTransfer(null, decisionForm(transfer.id, "REJECT", "This contact should remain in the shared pool."))).status).toBe("success");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({ ownerUserId: null, ownerSnapshot: "Contact Pool", state: "CONTACT_POOL" });
  });
  it("moves a selected Main contact to the shared pool without leaving an owner", async () => {
    const contact = await createContact(staffA.id, staffA.name, "MAIN");
    caller.current = admin;
    const result = await bulkManageContacts(null, bulkForm("MOVE_TO_POOL", [contact.id]));
    expect(result.status).toBe("success");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({ ownerUserId: null, ownerSnapshot: "Contact Pool", state: "CONTACT_POOL" });
    expect(await prisma.contactAuditEvent.count({ where: { contactId: contact.id, action: "MOVED_TO_CONTACT_POOL" } })).toBe(1);
  });

  it("keeps an accepted transfer from Imported Queue in the recipient's queue for separate import review", async () => {
    const contact = await createContact(staffA.id, staffA.name, "IMPORTED_QUEUE");
    caller.current = admin;
    await bulkManageContacts(null, bulkForm("SEND_TO_USER", [contact.id], staffB.id));
    const transfer = await prisma.contactTransfer.findFirstOrThrow({ where: { contactId: contact.id, status: "PENDING" } });
    caller.current = staffB;
    expect((await respondToContactTransfer(null, decisionForm(transfer.id, "APPROVE"))).message).toContain("remains in your Imported Queue");
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({ ownerUserId: staffB.id, state: "IMPORTED_QUEUE", queueReviewOutcome: null });
  });

});
