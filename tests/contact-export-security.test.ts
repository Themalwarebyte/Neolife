import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { id: string; name: string; role: "admin" | "staff"; mustChangePassword: boolean },
    recentFailures: 0,
    credential: null as null | Record<string, unknown>,
    events: [] as Array<Record<string, unknown>>,
    verifyPassword: vi.fn(),
  },
}));

vi.mock("@/server/auth/requireCrmUser", () => ({
  getCrmUser: async () => state.user,
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { verifyPassword: (...args: unknown[]) => state.verifyPassword(...args) } },
}));
vi.mock("@/server/db/prisma", () => {
  const createEvent = async ({ data }: { data: Record<string, unknown> }) => {
    state.events.push(data);
    return data;
  };
  const credentialCreate = async ({ data }: { data: Record<string, unknown> }) => {
    state.credential = { ...data, createdAt: new Date(), failedAttempts: 0, lockedUntil: null, lastVerifiedAt: null };
    return state.credential;
  };
  const credentialUpdate = async ({ data }: { data: Record<string, unknown> }) => {
    state.credential = { ...(state.credential || {}), ...data };
    return state.credential;
  };
  return {
    prisma: {
      contactExportCredential: {
        findUnique: async () => state.credential,
        create: credentialCreate,
        update: credentialUpdate,
      },
      contactExportSecurityEvent: { create: createEvent },
      activityAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        $queryRaw: async () => state.user ? [{ id: state.user.id }] : [],
        contactExportSecurityEvent: {
          count: async () => state.recentFailures + state.events.filter(
            event => event.action === "EXPORT_PIN_PASSWORD_VERIFICATION_FAILED",
          ).length,
          create: createEvent,
        },
        contactExportCredential: {
          create: credentialCreate,
          update: credentialUpdate,
        },
      }),
    },
  };
});

import { POST } from "../src/app/admin/(protected)/my-contacts/export/security/route";

const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;

function request() {
  const form = new FormData();
  form.set("mode", "setup");
  form.set("view", "main");
  form.set("password", "incorrect-password");
  form.set("pin", "0482");
  form.set("pinConfirm", "0482");
  return new Request("https://neolife.test/admin/my-contacts/export/security", {
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

beforeEach(() => {
  process.env.BETTER_AUTH_URL = "https://neolife.test";
  state.user = { id: "export-security-test-admin", name: "Export Security Test Admin", role: "admin", mustChangePassword: false };
  state.recentFailures = 0;
  state.credential = null;
  state.events = [];
  state.verifyPassword.mockReset();
});

afterEach(() => {
  if (originalBetterAuthUrl === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
});

describe("contact export password verification throttling", () => {
  it("blocks PIN setup when five recent password checks have already failed", async () => {
    state.recentFailures = 5;
    state.verifyPassword.mockResolvedValue(undefined);

    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(errorFrom(response)).toBe("passwordLocked");
    expect(state.verifyPassword).not.toHaveBeenCalled();
    expect(state.events).toContainEqual(expect.objectContaining({
      action: "EXPORT_PIN_PASSWORD_VERIFICATION_THROTTLED",
      userId: state.user?.id,
    }));
  });

  it("records a failed password check and throttles the next attempt at the threshold", async () => {
    state.recentFailures = 4;
    state.verifyPassword.mockRejectedValue(new Error("Invalid password"));

    const first = await POST(request());
    expect(first.status).toBe(303);
    expect(errorFrom(first)).toBe("password");
    expect(state.events).toContainEqual(expect.objectContaining({
      action: "EXPORT_PIN_PASSWORD_VERIFICATION_FAILED",
      userId: state.user?.id,
    }));

    const second = await POST(request());
    expect(second.status).toBe(303);
    expect(errorFrom(second)).toBe("passwordLocked");
    expect(state.verifyPassword).toHaveBeenCalledTimes(1);
  });
});
