import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, accountMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  accountMock: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: sessionMock } } }));
vi.mock("@/server/db/prisma", () => ({ prisma: { user: { findUnique: accountMock } } }));

import { getCrmUser } from "../src/server/auth/requireCrmUser";

const account = {
  id: "test-id", email: "staff@test.local", name: "Staff",
  role: "staff", isActive: true, mustChangePassword: false,
};

beforeEach(() => {
  sessionMock.mockReset();
  accountMock.mockReset();
  sessionMock.mockResolvedValue({ user: { id: account.id, role: "staff", isActive: true } });
  accountMock.mockResolvedValue(account);
});

describe("live CRM authorization after Better Auth session verification", () => {
  it("denies unauthenticated users without querying a database account", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await getCrmUser()).toBeNull();
    expect(accountMock).not.toHaveBeenCalled();
  });
  it("checks current database activation instead of old session claims", async () => {
    accountMock.mockResolvedValue({ ...account, isActive: false });
    expect(await getCrmUser()).toBeNull();
  });
  it("denies deleted users and unknown roles", async () => {
    accountMock.mockResolvedValueOnce(null);
    expect(await getCrmUser()).toBeNull();
    accountMock.mockResolvedValueOnce({ ...account, role: "visitor" });
    expect(await getCrmUser()).toBeNull();
  });
  it("uses current database role and forced password flag", async () => {
    accountMock.mockResolvedValue({ ...account, role: "admin", mustChangePassword: true });
    expect(await getCrmUser()).toEqual({
      id: account.id, email: account.email, name: account.name,
      role: "admin", mustChangePassword: true,
    });
    expect(accountMock).toHaveBeenCalledWith({
      where: { id: account.id },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, mustChangePassword: true,
      },
    });
  });
});
