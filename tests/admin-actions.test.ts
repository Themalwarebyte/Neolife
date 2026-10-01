import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prisma } from "../src/server/db/prisma";
import {
  BETTER_AUTH_USER_ID_PATTERN,
  isValidBetterAuthUserId,
  toggleUserSchema,
} from "../src/lib/user-management";
import {
  assignLead,
  toggleUserActive,
  type CrmActionResult,
} from "../src/app/admin/(protected)/actions";

/**
 * Task P-2 — Better Auth user ID validation regression tests.
 *
 * Root cause: both toggleUserActive (zod `.uuid()`) and assignLead (UUID
 * regex on targetUserId) assumed user IDs are UUIDs. Better Auth generates
 * opaque ~32-char alphanumeric IDs (all real rows in the User table are
 * 32-char alphanumeric), so every real user ID was rejected before the
 * database write — toggleUserActive silently no-opped and assignLead
 * returned "Invalid assignee." for every real Staff user.
 *
 * These tests exercise the REAL Server Actions (not just the DB writes the
 * way the action performs them): only the Next.js request-scoped seams —
 * the session guard and revalidatePath — are mocked. Prisma is real.
 */

// ─── Next.js seams ────────────────────────────────────────────────────────

type TestUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
};

const { authState } = vi.hoisted(() => ({
  authState: {
    currentUser: null as null | {
      id: string;
      email: string;
      name: string;
      role: string;
      mustChangePassword: boolean;
    },
  },
}));

vi.mock("@/server/auth/requireCrmUser", () => ({
  getCrmUser: () => Promise.resolve(authState.currentUser),
  isAdminSession: () => Promise.resolve(authState.currentUser?.role === "admin"),
  // Mirrors the real guards: requireCrmUser redirects (throws) when there is
  // no session; requireAdmin additionally throws for non-admin roles.
  requireCrmUser: async () => {
    const user = authState.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    return user;
  },
  requireAdmin: async () => {
    const user = authState.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    if (user.role !== "admin") {
      throw new Error("FORBIDDEN: Owner (admin) role required");
    }
    return user;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

function asUser(user: TestUser | null): void {
  authState.currentUser = user;
}

// ─── Test identities ──────────────────────────────────────────────────────
// Better Auth generates 32-char alphanumeric IDs (verified against the live
// User table, e.g. all real rows are length 32). Use the same shape.

const OWNER_ID = "dS9yT4pZ1xM6oV0rN7aB5eF8gI3jL2cG"; // 32 chars, alphanumeric
const STAFF1_ID = "bQ7wR2nX9vK4mT8pL5yZ3cD6fG1hJ0aE"; // 32 chars, alphanumeric
const STAFF2_ID = "cR8xS3oY0wL5nU9qM6zA4dE7fH2iK1bF"; // 32 chars, alphanumeric

for (const id of [OWNER_ID, STAFF1_ID, STAFF2_ID]) {
  if (!/^[A-Za-z0-9]{32}$/.test(id)) {
    throw new Error(`Test ID ${id} must be 32 alphanumeric chars (Better Auth shape)`);
  }
}

const ownerCaller: TestUser = {
  id: OWNER_ID,
  email: "owner-actions@test.local",
  name: "Owner",
  role: "admin",
  mustChangePassword: false,
};
const staff1Caller: TestUser = {
  id: STAFF1_ID,
  email: "staff1-actions@test.local",
  name: "Staff One",
  role: "staff",
  mustChangePassword: false,
};

const PHONE_A = "+254711000401";
const PHONE_B = "+254711000402";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

async function getLead(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: { assignedUserId: true },
  });
}

async function getLatestEvent(leadId: string, type: string) {
  return prisma.leadEvent.findFirst({
    where: { leadId, type },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Pure validation (no DB) ─────────────────────────────────────────────

describe("Better Auth user ID validation (pure, no DB)", () => {
  describe("isValidBetterAuthUserId", () => {
    it("accepts a 32-char Better Auth-style ID (real production shape)", () => {
      expect(isValidBetterAuthUserId(STAFF1_ID)).toBe(true);
    });

    it("accepts a 31-char Better Auth-style ID", () => {
      expect(isValidBetterAuthUserId("aB3xK9mQ2vR7wL5pT0yZ8cD4fG6hJ1n")).toBe(true);
    });

    it("accepts UUID format (Better Auth can be configured to use UUIDs)", () => {
      expect(isValidBetterAuthUserId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("accepts the 16-char minimum and 64-char maximum boundaries", () => {
      expect(isValidBetterAuthUserId("abcdefghijklmnop")).toBe(true); // 16
      expect(isValidBetterAuthUserId("a".repeat(64))).toBe(true); // 64
    });

    it("rejects empty and boundary-violating lengths", () => {
      expect(isValidBetterAuthUserId("")).toBe(false);
      expect(isValidBetterAuthUserId("abcdefghijklmno")).toBe(false); // 15
      expect(isValidBetterAuthUserId("a".repeat(65))).toBe(false); // 65
    });

    it("rejects unsafe characters (markup, paths, whitespace, newlines, unicode)", () => {
      expect(isValidBetterAuthUserId("<script>alert(1)</script>____padding")).toBe(false);
      expect(isValidBetterAuthUserId("../../etc/passwd")).toBe(false);
      expect(isValidBetterAuthUserId(`${"x".repeat(32)} `)).toBe(false);
      expect(isValidBetterAuthUserId("id\nDROP TABLE users;")).toBe(false);
      expect(isValidBetterAuthUserId("úséríd".repeat(6))).toBe(false);
      expect(isValidBetterAuthUserId("not-a-uuid")).toBe(false);
    });

    it("rejects non-string values", () => {
      expect(isValidBetterAuthUserId(null)).toBe(false);
      expect(isValidBetterAuthUserId(undefined)).toBe(false);
      expect(isValidBetterAuthUserId(123)).toBe(false);
      expect(isValidBetterAuthUserId({ id: STAFF1_ID })).toBe(false);
    });
  });

  describe("toggleUserSchema (zod layer shares the same pattern)", () => {
    it("accepts a Better Auth-style ID and rejects malformed input", () => {
      expect(toggleUserSchema.safeParse({ userId: STAFF2_ID }).success).toBe(true);
      expect(toggleUserSchema.safeParse({ userId: "" }).success).toBe(false);
      expect(toggleUserSchema.safeParse({ userId: "../../etc/passwd" }).success).toBe(false);
    });

    it("exposes the same pattern constant used by the shared validator", () => {
      expect(BETTER_AUTH_USER_ID_PATTERN.source).toBe("^[A-Za-z0-9_-]{16,64}$");
    });
  });

  describe("root-cause contrast (documents the regression)", () => {
    it("the old zod .uuid() check rejects real Better Auth IDs — why this fix exists", () => {
      // This is the exact defect: z.string().uuid() (toggleUserSchema before
      // Task P-2) and the UUID regex (assignLead's targetUserId check) both
      // rejected every ID that Better Auth actually generates.
      expect(z.string().uuid().safeParse(STAFF1_ID).success).toBe(false);
    });
  });
});

// ─── Real Server Actions against the DB ──────────────────────────────────

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("toggleUserActive through the real Server Action (DB integration)", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [OWNER_ID, STAFF1_ID, STAFF2_ID] } } });
    await prisma.user.create({
      data: { id: STAFF1_ID, name: "Staff One", email: staff1Caller.email, role: "staff" },
    });
    await prisma.user.create({
      data: { id: STAFF2_ID, name: "Staff Two", email: "staff2-actions@test.local", role: "staff" },
    });
    await prisma.user.create({
      data: { id: OWNER_ID, name: "Owner", email: ownerCaller.email, role: "admin" },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [OWNER_ID, STAFF1_ID, STAFF2_ID] } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    asUser(null);
  });

  it("flips isActive for a real Better Auth-style staff ID (was a silent no-op before the fix)", async () => {
    asUser(ownerCaller);

    await toggleUserActive(STAFF1_ID);
    let user = await prisma.user.findUnique({ where: { id: STAFF1_ID }, select: { isActive: true } });
    expect(user?.isActive).toBe(false);

    await toggleUserActive(STAFF1_ID);
    user = await prisma.user.findUnique({ where: { id: STAFF1_ID }, select: { isActive: true } });
    expect(user?.isActive).toBe(true);
  });

  it("is a silent no-op for malformed user IDs (DB unchanged)", async () => {
    asUser(ownerCaller);

    const before = await prisma.user.findUnique({ where: { id: STAFF1_ID }, select: { isActive: true } });
    await toggleUserActive("not-a-uuid");
    await toggleUserActive(`${"x".repeat(32)} `);
    const after = await prisma.user.findUnique({ where: { id: STAFF1_ID }, select: { isActive: true } });
    expect(after?.isActive).toBe(before?.isActive);
  });

  it("refuses to toggle an admin target and the caller's own account", async () => {
    asUser(ownerCaller);

    const adminBefore = await prisma.user.findUnique({ where: { id: OWNER_ID }, select: { isActive: true } });
    await toggleUserActive(OWNER_ID); // target.role === "admin" guard
    const adminAfter = await prisma.user.findUnique({ where: { id: OWNER_ID }, select: { isActive: true } });
    expect(adminAfter?.isActive).toBe(adminBefore?.isActive);
  });

  it("requires an Owner (admin) caller", async () => {
    asUser(staff1Caller);

    const before = await prisma.user.findUnique({ where: { id: STAFF2_ID }, select: { isActive: true } });
    await expect(toggleUserActive(STAFF2_ID)).rejects.toThrow(/FORBIDDEN/);
    const after = await prisma.user.findUnique({ where: { id: STAFF2_ID }, select: { isActive: true } });
    expect(after?.isActive).toBe(before?.isActive);
  });
});

runIfDb("assignLead through the real Server Action (DB integration)", () => {
  beforeAll(async () => {
    await prisma.leadEvent.deleteMany({ where: { lead: { phone: { in: [PHONE_A, PHONE_B] } } } });
    await prisma.lead.deleteMany({ where: { phone: { in: [PHONE_A, PHONE_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [OWNER_ID, STAFF1_ID, STAFF2_ID] } } });
    await prisma.user.create({
      data: { id: STAFF1_ID, name: "Staff One", email: staff1Caller.email, role: "staff" },
    });
    await prisma.user.create({
      data: { id: STAFF2_ID, name: "Staff Two", email: "staff2-actions@test.local", role: "staff" },
    });
    await prisma.user.create({
      data: { id: OWNER_ID, name: "Owner", email: ownerCaller.email, role: "admin" },
    });
  });

  afterAll(async () => {
    await prisma.leadEvent.deleteMany({ where: { userId: { in: [OWNER_ID, STAFF1_ID, STAFF2_ID] } } });
    await prisma.leadEvent.deleteMany({ where: { lead: { phone: { in: [PHONE_A, PHONE_B] } } } });
    await prisma.lead.deleteMany({ where: { phone: { in: [PHONE_A, PHONE_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [OWNER_ID, STAFF1_ID, STAFF2_ID] } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    asUser(null);
  });

  async function createLead(phone: string, firstName: string): Promise<string> {
    const lead = await prisma.lead.create({
      data: { firstName, phone, consent: true, consentAt: new Date() },
    });
    return lead.id;
  }

  it("assigns a lead to a real Better Auth-style staff ID (was rejected before the fix)", async () => {
    asUser(ownerCaller);
    const leadId = await createLead(PHONE_A, "AssignHappy");

    const result: CrmActionResult = await assignLead(
      null,
      formData({ leadId, assignedUserId: STAFF1_ID }),
    );

    expect(result.status).toBe("success");
    expect(result.message).toBe("Lead assigned to Staff One.");

    const lead = await getLead(leadId);
    expect(lead?.assignedUserId).toBe(STAFF1_ID);

    const event = await getLatestEvent(leadId, "lead_assigned");
    expect(event?.userId).toBe(OWNER_ID);
    expect(event?.metadata).toEqual({ by: OWNER_ID, from: null, to: STAFF1_ID });

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("rejects a malformed assignee ID without touching the lead", async () => {
    asUser(ownerCaller);
    const leadId = await createLead(PHONE_A, "AssignBad");

    const result = await assignLead(null, formData({ leadId, assignedUserId: "not a valid id!" }));

    expect(result).toEqual({ status: "error", message: "Invalid assignee." });
    expect((await getLead(leadId))?.assignedUserId).toBeNull();
    expect(await getLatestEvent(leadId, "lead_assigned")).toBeNull();

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("rejects an unknown but well-formed assignee ID", async () => {
    asUser(ownerCaller);
    const leadId = await createLead(PHONE_A, "AssignUnknown");
    const unknownId = "zZ9yX8wV7uU6tT5sS4rR3qQ2pP1oO0nN"; // 32 chars, not in DB

    const result = await assignLead(null, formData({ leadId, assignedUserId: unknownId }));

    expect(result).toEqual({ status: "error", message: "Assignee not found." });
    expect((await getLead(leadId))?.assignedUserId).toBeNull();

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("refuses to assign a lead to an admin-role user", async () => {
    asUser(ownerCaller);
    const leadId = await createLead(PHONE_A, "AssignAdmin");

    const result = await assignLead(null, formData({ leadId, assignedUserId: OWNER_ID }));

    expect(result).toEqual({ status: "error", message: "Assignee must be a staff user." });
    expect((await getLead(leadId))?.assignedUserId).toBeNull();

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("reassigns from Staff One to Staff Two with from/to audit metadata", async () => {
    asUser(ownerCaller);
    const leadId = await createLead(PHONE_A, "AssignReassign");
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: STAFF1_ID } });

    const result = await assignLead(null, formData({ leadId, assignedUserId: STAFF2_ID }));

    expect(result.status).toBe("success");
    expect((await getLead(leadId))?.assignedUserId).toBe(STAFF2_ID);
    const event = await getLatestEvent(leadId, "lead_assigned");
    expect(event?.metadata).toEqual({ by: OWNER_ID, from: STAFF1_ID, to: STAFF2_ID });

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("unassigns when assignedUserId is empty and records a lead_unassigned event", async () => {
    asUser(ownerCaller);
    const leadId = await createLead(PHONE_A, "AssignUnassign");
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: STAFF1_ID } });

    const result = await assignLead(null, formData({ leadId, assignedUserId: "" }));

    expect(result).toEqual({ status: "success", message: "Lead unassigned." });
    expect((await getLead(leadId))?.assignedUserId).toBeNull();
    const event = await getLatestEvent(leadId, "lead_unassigned");
    expect(event?.userId).toBe(OWNER_ID);
    expect(event?.metadata).toEqual({ by: OWNER_ID, from: STAFF1_ID });

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("is Owner-only: a staff caller is rejected before any write", async () => {
    asUser(staff1Caller);
    const leadId = await createLead(PHONE_A, "AssignForbidden");

    await expect(assignLead(null, formData({ leadId, assignedUserId: STAFF2_ID }))).rejects.toThrow(
      /FORBIDDEN/,
    );
    expect((await getLead(leadId))?.assignedUserId).toBeNull();

    await prisma.lead.delete({ where: { id: leadId } });
  });

  it("still validates lead IDs as UUIDs (leads are gen_random_uuid())", async () => {
    asUser(ownerCaller);

    const result = await assignLead(null, formData({ leadId: "not-a-uuid", assignedUserId: STAFF1_ID }));

    expect(result).toEqual({ status: "error", message: "Invalid lead." });
  });

  it("reports a missing lead", async () => {
    asUser(ownerCaller);
    const missingUuid = "00000000-0000-4000-8000-000000000000";

    const result = await assignLead(
      null,
      formData({ leadId: missingUuid, assignedUserId: STAFF1_ID }),
    );

    expect(result).toEqual({ status: "error", message: "Lead not found." });
  });
});
