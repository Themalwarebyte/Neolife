import { afterAll, describe, expect, it } from "vitest";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/server/db/prisma";
import {
  parseFollowUpNote,
  parseStatusChange,
} from "../src/lib/leadManagement";

const email = "auth-test@neolife.local";
const password = "correct-horse-battery-staple";

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Better Auth (email/password + role boundary)", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("signs up a user with the default 'staff' role (not admin)", async () => {
    await auth.api.signUpEmail({
      body: { name: "Auth Test", email, password },
    });
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe("staff");
  });

  it("stores the password hashed, never in plaintext", async () => {
    const account = await prisma.account.findFirst({
      where: { user: { email } },
    });
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe(password);
  });

  it("sign-in with correct credentials creates a session", async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();

    await auth.api.signInEmail({ body: { email, password } });
    const sessions = await prisma.session.findMany({
      where: { userId: user!.id },
    });
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("rejects a wrong password", async () => {
    await expect(
      auth.api.signInEmail({ body: { email, password: "wrong-password" } }),
    ).rejects.toThrow();
  });
});

describe("lead status + follow-up validation (pure, no DB)", () => {
  it("accepts valid lifecycle statuses", () => {
    expect(parseStatusChange("CONTACTED")).toBe("CONTACTED");
    expect(parseStatusChange("MEETING_ATTENDED")).toBe("MEETING_ATTENDED");
    expect(parseStatusChange("DISQUALIFIED")).toBe("DISQUALIFIED");
  });

  it("rejects invalid statuses", () => {
    expect(parseStatusChange("SUPER_ADMIN")).toBeNull();
    expect(parseStatusChange(123)).toBeNull();
    expect(parseStatusChange("")).toBeNull();
  });

  it("validates follow-up notes", () => {
    expect(parseFollowUpNote("  Called the lead  ")).toBe("Called the lead");
    expect(parseFollowUpNote("")).toBeNull();
    expect(parseFollowUpNote("   ")).toBeNull();
    expect(parseFollowUpNote("x".repeat(2001))).toBeNull();
  });
});
