import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";

const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { id: string; name: string; role: "admin" | "staff"; mustChangePassword: boolean },
    verifyPin: vi.fn(),
  },
}));

vi.mock("@/server/auth/requireCrmUser", () => ({
  getCrmUser: async () => state.user,
}));

vi.mock("@/lib/contact-export-pin", () => ({
  verifyExportPin: (...args: unknown[]) => state.verifyPin(...args),
}));

import { POST as exportContacts } from "../src/app/admin/(protected)/my-contacts/export/route";

const userId = "NeolifeBatchEPinConcurrencyDbTest";
const user = {
  id: userId,
  name: "Batch E PIN Concurrency DB Test",
  role: "admin" as const,
  mustChangePassword: false,
};

const dbEnabled = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      /test|qa|ci/i.test(url.pathname);
  } catch {
    return false;
  }
})();

const runIfDb = dbEnabled ? describe : describe.skip;
const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;

function request(pin = "9999") {
  const form = new FormData();
  form.set("view", "main");
  form.set("pin", pin);
  return new Request("https://neolife.test/admin/my-contacts/export", {
    method: "POST",
    headers: { origin: "https://neolife.test" },
    body: form,
  });
}

function errorFrom(response: Response) {
  const location = response.headers.get("location");
  if (!location) throw new Error("Expected a redirect location");
  return new URL(location).searchParams.get("error");
}

runIfDb("Batch E PIN concurrency — real PostgreSQL row-lock integration", () => {
  beforeAll(async () => {
    process.env.BETTER_AUTH_URL = "https://neolife.test";
    state.user = user;
    state.verifyPin.mockReset();
    state.verifyPin.mockResolvedValue(false);

    await prisma.contactExportCredential.deleteMany({ where: { userId } });
    await prisma.contactExportSecurityEvent.deleteMany({ where: { userId } });

    await prisma.user.upsert({
      where: { id: userId },
      update: { name: user.name, email: "batch-e-pin-concurrency-db-test@neolife-test.invalid", role: "admin", isActive: true },
      create: { id: userId, name: user.name, email: "batch-e-pin-concurrency-db-test@neolife-test.invalid", role: "admin", isActive: true },
    });

    await prisma.contactExportCredential.create({
      data: { userId, pinHash: "mock-invalid-pin-hash", failedAttempts: 0 },
    });
  });

  afterAll(async () => {
    state.user = null;
    await prisma.contactExportCredential.deleteMany({ where: { userId } });
    await prisma.contactExportSecurityEvent.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    if (originalBetterAuthUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
  });

  it("serializes 20 concurrent invalid PIN attempts and enforces the database-backed lockout at five", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => exportContacts(request())),
    );

    expect(responses.every(response => response.status === 303)).toBe(true);
    expect(responses.filter(response => errorFrom(response) === "pin")).toHaveLength(4);
    expect(responses.filter(response => errorFrom(response) === "locked")).toHaveLength(16);

    const credential = await prisma.contactExportCredential.findUniqueOrThrow({ where: { userId } });
    expect(credential.failedAttempts).toBe(5);
    expect(credential.lockedUntil).toBeInstanceOf(Date);
    expect(credential.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(state.verifyPin).toHaveBeenCalledTimes(5);

    expect(await prisma.contactExportSecurityEvent.count({
      where: { userId, action: "EXPORT_PIN_FAILED" },
    })).toBe(4);
    expect(await prisma.contactExportSecurityEvent.count({
      where: { userId, action: "EXPORT_PIN_LOCKED" },
    })).toBe(1);
  });
});
