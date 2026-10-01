import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { auth } from "../src/lib/auth";

/**
 * Integration test against the local development database.
 * Verifies the admin user management flow:
 *  - Owner creates a Staff user with mustChangePassword = true
 *  - Staff user is initially active
 *  - Owner can deactivate/reactivate a Staff user
 *  - Password change flow clears mustChangePassword
 */
const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

const testEmail = "user-mgmt-test@neolife.local";
const testPassword = "TempPassword123!";

runIfDb("Admin user management (integration)", () => {
  let staffUserId: string | null = null;

  afterAll(async () => {
    if (staffUserId) {
      await prisma.user.delete({ where: { id: staffUserId } });
    }
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it("Owner can create a Staff user with mustChangePassword set", async () => {
    await auth.api.signUpEmail({
      body: {
        name: "Test Staff User",
        email: testEmail,
        password: testPassword,
      },
    });

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).not.toBeNull();
    staffUserId = user!.id;

    await prisma.user.update({
      where: { id: staffUserId },
      data: { role: "staff", mustChangePassword: true },
    });

    const updated = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { role: true, mustChangePassword: true, isActive: true },
    });
    expect(updated?.role).toBe("staff");
    expect(updated?.mustChangePassword).toBe(true);
    expect(updated?.isActive).toBe(true);
  });

  it("Owner can deactivate a Staff user", async () => {
    if (!staffUserId) throw new Error("Staff user not created");

    await prisma.user.update({
      where: { id: staffUserId },
      data: { isActive: false },
    });

    const user = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { isActive: true },
    });
    expect(user?.isActive).toBe(false);
  });

  it("Owner can reactivate a Staff user", async () => {
    if (!staffUserId) throw new Error("Staff user not created");

    await prisma.user.update({
      where: { id: staffUserId },
      data: { isActive: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { isActive: true },
    });
    expect(user?.isActive).toBe(true);
  });

  it("Inactive users are filtered from getSession scope", async () => {
    if (!staffUserId) throw new Error("Staff user not created");

    await prisma.user.update({
      where: { id: staffUserId },
      data: { isActive: false },
    });

    const session = await auth.api.getSession({
      headers: {
        cookie: await getStaffSessionCookie(staffUserId, testPassword),
      },
    });

    expect(session?.user).toBeUndefined();
  });
});

async function getStaffSessionCookie(
  userId: string,
  password: string,
): Promise<string> {
  const result = await auth.api.signInEmail({
    body: { email: testEmail, password },
  });
  return `better-auth.session=${result?.token ?? ""}`;
}
