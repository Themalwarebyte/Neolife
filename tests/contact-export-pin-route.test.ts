import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { id: string; name: string; role: "admin" | "staff"; mustChangePassword: boolean },
    credential: null as null | {
      id: string;
      userId: string;
      pinHash: string;
      failedAttempts: number;
      lockedUntil: Date | null;
      lastVerifiedAt: Date | null;
    },
    events: [] as Array<Record<string, unknown>>,
    verifyPin: vi.fn(),
    transactionTail: Promise.resolve(),
  },
}));

vi.mock("@/server/auth/requireCrmUser", () => ({
  getCrmUser: async () => state.user,
}));

vi.mock("@/lib/contact-export-pin", () => ({
  verifyExportPin: (...args: unknown[]) => state.verifyPin(...args),
}));

vi.mock("@/lib/contact-intake", () => ({
  contactListScope: () => ({}),
}));

vi.mock("@/lib/contact-processing", () => ({
  CONTACT_EXPORT_LIMIT: 1000,
  csvRows: (rows: unknown[][]) => rows.map(row => row.join(",")).join("\n"),
}));

vi.mock("@/server/db/prisma", () => {
  const findCredential = async () => state.credential ? { ...state.credential } : null;

  const updateCredential = async ({ where, data }: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => {
    if (!state.credential || state.credential.id !== where.id) {
      throw new Error("Credential not found");
    }
    state.credential = { ...state.credential, ...data } as typeof state.credential;
    return state.credential;
  };

  const createEvent = async ({ data }: { data: Record<string, unknown> }) => {
    state.events.push(data);
    return data;
  };

  const transaction = async (callback: (tx: unknown) => Promise<unknown>) => {
    // Model the per-account row lock by serializing transaction callbacks.
    const previous = state.transactionTail;
    let release!: () => void;
    state.transactionTail = new Promise<void>(resolve => { release = resolve; });
    await previous;

    try {
      const tx = {
        $queryRaw: async (strings: TemplateStringsArray) => {
          const sql = strings.join(" ");
          if (sql.includes('FROM "User"')) {
            return state.user ? [{ id: state.user.id }] : [];
          }
          if (sql.includes('FROM "ContactExportCredential"')) {
            return state.credential ? [{ id: state.credential.id }] : [];
          }
          return [];
        },
        contactExportCredential: {
          findUnique: findCredential,
          update: updateCredential,
        },
        contactExportSecurityEvent: { create: createEvent },
      };
      return await callback(tx);
    } finally {
      release();
    }
  };

  return {
    prisma: {
      $transaction: transaction,
      contactExportCredential: { findUnique: findCredential },
      contactExportSecurityEvent: { create: createEvent },
      activityAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data },
      contactExportAudit: { create: async ({ data }: { data: Record<string, unknown> }) => data },
      contactFollowUp: { findMany: async () => [] },
      contact: { findMany: async () => [] },
    },
  };
});

import { POST as exportContacts } from "../src/app/admin/(protected)/my-contacts/export/route";

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

beforeEach(() => {
  process.env.BETTER_AUTH_URL = "https://neolife.test";
  state.user = {
    id: "pin-concurrency-test-user",
    name: "PIN Concurrency Test User",
    role: "admin",
    mustChangePassword: false,
  };
  state.credential = {
    id: "pin-concurrency-test-credential",
    userId: "pin-concurrency-test-user",
    pinHash: "mock-hash",
    failedAttempts: 0,
    lockedUntil: null,
    lastVerifiedAt: null,
  };
  state.events = [];
  state.verifyPin.mockReset();
  state.verifyPin.mockResolvedValue(false);
  state.transactionTail = Promise.resolve();
});

afterEach(() => {
  if (originalBetterAuthUrl === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
});

describe("contact export PIN concurrent failure throttling", () => {
  it("serializes concurrent invalid PIN attempts and locks the account at five failures", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => exportContacts(request())),
    );

    expect(responses.every(response => response.status === 303)).toBe(true);
    expect(responses.filter(response => errorFrom(response) === "pin")).toHaveLength(4);
    expect(responses.filter(response => errorFrom(response) === "locked")).toHaveLength(16);
    expect(state.credential?.failedAttempts).toBe(5);
    expect(state.credential?.lockedUntil).toBeInstanceOf(Date);
    expect(state.credential?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(state.verifyPin).toHaveBeenCalledTimes(5);
    expect(state.events.filter(event => event.action === "EXPORT_PIN_FAILED")).toHaveLength(4);
    expect(state.events.filter(event => event.action === "EXPORT_PIN_LOCKED")).toHaveLength(1);
  });
});
