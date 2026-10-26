import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  requireUser: vi.fn(),
  redirect: vi.fn((target: string): never => {
    throw new Error("NEXT_REDIRECT:" + target);
  }),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  contactRecordScope: vi.fn((role: string, userId: string) =>
    role === "admin" ? {} : { ownerUserId: userId }
  ),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: { contact: { findFirst: mocks.findFirst } },
}));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: mocks.requireUser,
}));
vi.mock("@/lib/contact-intake", () => ({
  contactRecordScope: mocks.contactRecordScope,
  isContactUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

import RejectedQueueContactPage from "../src/app/admin/(protected)/my-contacts/rejected-imports/contact/[id]/page";

const contactId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const staff = { id: "staff-1", role: "staff", name: "Test Staff", mustChangePassword: false };

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: contactId,
    firstName: "Test",
    lastName: "Contact",
    city: null,
    sourceDetail: null,
    notes: null,
    consentStatus: "UNKNOWN",
    consentEvidence: null,
    doNotContact: false,
    version: 2,
    state: "IMPORTED_QUEUE",
    origin: "IMPORT",
    queueReviewOutcome: null,
    queueReviewReason: null,
    queueReviewedBySnapshot: null,
    queueReviewedAt: null,
    methods: [],
    audit: [],
    importBatch: null,
    ...overrides,
  };
}

describe("rejected contact page navigation after requeue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue(staff);
  });

  it("redirects an authorized requeued import to Imported Queue", async () => {
    mocks.findFirst.mockResolvedValue(contact({
      state: "IMPORTED_QUEUE",
      queueReviewOutcome: null,
    }));

    await expect(RejectedQueueContactPage({
      params: Promise.resolve({ id: contactId }),
    })).rejects.toThrow("NEXT_REDIRECT:/admin/my-contacts?view=queue");

    expect(mocks.contactRecordScope).toHaveBeenCalledWith("staff", "staff-1");
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: contactId, ownerUserId: "staff-1" },
    }));
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/my-contacts?view=queue");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("continues to render the correction page for a still-rejected archived import", async () => {
    mocks.findFirst.mockResolvedValue(contact({
      state: "ARCHIVED",
      queueReviewOutcome: "REJECTED",
      queueReviewReason: "Needs correction",
    }));

    const result = await RejectedQueueContactPage({
      params: Promise.resolve({ id: contactId }),
    });

    expect(result).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("does not render an unrelated contact state from the rejected-contact route", async () => {
    mocks.findFirst.mockResolvedValue(contact({
      state: "MAIN",
      queueReviewOutcome: null,
    }));

    await expect(RejectedQueueContactPage({
      params: Promise.resolve({ id: contactId }),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns not-found when the scoped contact lookup finds no record", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(RejectedQueueContactPage({
      params: Promise.resolve({ id: contactId }),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: contactId, ownerUserId: "staff-1" },
    }));
  });
});
