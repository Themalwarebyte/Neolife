import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  EMAIL_MAX_PER_SENDER_PER_HOUR,
  currentEmailProvider,
  isClientEmailSendingEnabled,
  reserveClientEmailSend,
  finalizeClientEmailReservation,
} from "../src/lib/communications";
import { sendMail } from "../src/lib/email";

/**
 * Task #029 Fix 4 — outbound email reservation safety (scenarios A–J).
 *
 * ALL provider calls are MOCKED (no live email, no provider configuration).
 * Authorization comes from a MOCKED requireCrmUser. The claim/finalize logic
 * runs against real local PostgreSQL to prove the advisory-lock
 * serialization and the conservative reservation semantics.
 */

vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: vi.fn(async () => CRM_USER_MOCK.current),
  getCrmUser: vi.fn(async () => CRM_USER_MOCK.current),
  requireAdmin: vi.fn(async () => CRM_USER_MOCK.current),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/email", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    sendMail: vi.fn(),
  };
});

// Mutable mock for the "authenticated" user per test.
const CRM_USER_MOCK: { current: { id: string; role: string } } = {
  current: { id: "esend-staff-1", role: "staff" },
};

const sendMailMock = sendMail as unknown as ReturnType<typeof vi.fn>;

const ownerId = "esend-owner-1";
const staffId = "esend-staff-1";
const intruderStaffId = "esend-staff-2";
const consentedPhone = "+254744990010";
const unconsentedPhone = "+254744990011";
const intruderLeadPhone = "+254744990012";
const quotaLeadPhone = "+254744990013";

const EMAIL_ENABLED_LOCAL = {
  EMAIL_PROVIDER: "none",
  NEOLIFE_ALLOW_LOCAL_EMAIL: "1",
};
const EMAIL_ENABLED_RESEND = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-only-mock-key",
  EMAIL_FROM: "from@test.local",
};

const OLD_ENV = process.env;
function withEnv(env: Record<string, string>, run: () => Promise<void>) {
  return async () => {
    process.env = { ...OLD_ENV, ...env };
    try {
      await run();
    } finally {
      process.env = OLD_ENV;
    }
  };
}

function emailForm(leadId: string) {
  const form = new FormData();
  form.set("leadId", leadId);
  form.set("subject", "Hello from the safety test");
  form.set("body", "A body text of suitable length.");
  return form;
}

async function cleanupLead(phone: string) {
  const leadIds = await prisma.lead.findMany({ where: { phone }, select: { id: true } });
  const ids = leadIds.map((l) => l.id);
  await prisma.emailSendReservation.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.leadEvent.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.lead.deleteMany({ where: { phone } });
}

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

runIfDb("Task #029 Fix 4 — outbound email reservation safety (DB)", () => {
  let consentedLeadId = "";
  let unconsentedLeadId = "";
  let intruderLeadId = "";
  let quotaLeadId = "";

  beforeAll(async () => {
    for (const phone of [
      consentedPhone,
      unconsentedPhone,
      intruderLeadPhone,
      quotaLeadPhone,
    ]) {
      await cleanupLead(phone);
    }
    await prisma.emailSendReservation.deleteMany({
      where: { userId: { in: [staffId, intruderStaffId, ownerId] } },
    });

    for (const [id, email] of [
      [ownerId, "esend-owner@test.local"],
      [staffId, "esend-staff@test.local"],
      [intruderStaffId, "esend-staff-2@test.local"],
    ] as const) {
      await prisma.user.upsert({
        where: { id },
        update: { role: id === ownerId ? "admin" : "staff", isActive: true },
        create: { id, name: id, email, role: id === ownerId ? "admin" : "staff" },
      });
    }

    const consented = await prisma.lead.create({
      data: {
        firstName: "Esend",
        phone: consentedPhone,
        email: "esend-client@test.local",
        interestType: "BUSINESS",
        consent: true,
        consentAt: new Date(),
        assignedUserId: staffId,
      },
      select: { id: true },
    });
    consentedLeadId = consented.id;

    const unconsented = await prisma.lead.create({
      data: {
        firstName: "NoConsent",
        phone: unconsentedPhone,
        email: "noconsent@test.local",
        interestType: "BUSINESS",
        consent: false,
        assignedUserId: staffId,
      },
      select: { id: true },
    });
    unconsentedLeadId = unconsented.id;

    const intruderLead = await prisma.lead.create({
      data: {
        firstName: "OwnedElsewhere",
        phone: intruderLeadPhone,
        email: "elsewhere@test.local",
        interestType: "BUSINESS",
        consent: true,
        assignedUserId: ownerId, // NOT the intruder
      },
      select: { id: true },
    });
    intruderLeadId = intruderLead.id;

    const quotaLead = await prisma.lead.create({
      data: {
        firstName: "Quota",
        phone: quotaLeadPhone,
        email: "quota@test.local",
        interestType: "BUSINESS",
        consent: true,
        assignedUserId: staffId,
      },
      select: { id: true },
    });
    quotaLeadId = quotaLead.id;
  });

  afterAll(async () => {
    for (const phone of [
      consentedPhone,
      unconsentedPhone,
      intruderLeadPhone,
      quotaLeadPhone,
    ]) {
      await cleanupLead(phone);
    }
    await prisma.emailSendReservation.deleteMany({
      where: { userId: { in: [staffId, intruderStaffId, ownerId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, staffId, intruderStaffId] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    sendMailMock.mockReset();
    vi.clearAllMocks();
    process.env = { ...OLD_ENV };
    CRM_USER_MOCK.current = { id: staffId, role: "staff" };
    // Isolates every test from the 90s per-lead interval and the hourly cap:
    // reservation rows persist in the DB, so each test starts clean.
    await prisma.emailSendReservation.deleteMany({
      where: {
        OR: [
          {
            leadId: {
              in: [consentedLeadId, unconsentedLeadId, intruderLeadId, quotaLeadId],
            },
          },
          { userId: { in: [staffId, intruderStaffId, ownerId] } },
        ],
      },
    });
  });

  // Imported here so the vi.mock registrations above are in place.
  const loadAction = () => import("../src/app/admin/(protected)/actions");

  it("A. two simultaneous requests to the same lead: exactly one send (advisory-lock serialized claims)", withEnv(EMAIL_ENABLED_LOCAL, async () => {
    expect(isClientEmailSendingEnabled()).toBe(true);
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const results = await Promise.all([
      action.sendClientEmail(null, emailForm(consentedLeadId)),
      action.sendClientEmail(null, emailForm(consentedLeadId)),
    ]);

    const successes = results.filter((r) => r.status === "success");
    const failures = results.filter((r) => r.status === "error");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    // Only ONE provider call for ONE allowed claim — no double external send.
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    // Exactly one TRY reservation row was created for the lead.
    const rows = await prisma.emailSendReservation.findMany({
      where: { leadId: consentedLeadId },
      select: { status: true },
    });
    expect(rows).toHaveLength(1);
    // Local provider (EMAIL_PROVIDER=none + NEOLIFE_ALLOW_LOCAL_EMAIL=1) is a
    // SIMULATION — the status must never claim a real "accepted" send.
    expect(rows[0]?.status).toBe("simulated");
  }));

  it("B. same sender near the hourly cap is refused even on an untouched lead", withEnv(EMAIL_ENABLED_LOCAL, async () => {
    // Reserve 20 attempts for staffId this hour (any status counts).
    await prisma.emailSendReservation.createMany({
      data: Array.from({ length: EMAIL_MAX_PER_SENDER_PER_HOUR }, () => ({
        leadId: quotaLeadId,
        userId: staffId,
        status: "failed",
      })),
    });
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(result.status).toBe("error");
    expect(result.message).toContain("Hourly sending limit");
    expect(sendMailMock).not.toHaveBeenCalled();
    // No new reservation for the target lead from the refused attempt.
    expect(
      await prisma.emailSendReservation.count({
        where: { leadId: consentedLeadId },
      }),
    ).toBe(0);
  }));

  it("G. unauthorized staff cannot send or even reserve for another staff member's lead", withEnv(EMAIL_ENABLED_LOCAL, async () => {
    CRM_USER_MOCK.current = { id: intruderStaffId, role: "staff" };
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(result.status).toBe("error");
    expect(result.message).toBe("Lead not found.");
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(
      await prisma.emailSendReservation.count({ where: { userId: intruderStaffId } }),
    ).toBe(0);
  }));

  it("H. absent contact consent blocks sending before any reservation", async () => {
    process.env = { ...OLD_ENV, ...EMAIL_ENABLED_LOCAL };
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(unconsentedLeadId));
    expect(result.status).toBe("error");
    expect(result.message).toContain("has not consented");
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(
      await prisma.emailSendReservation.count({
        where: { leadId: unconsentedLeadId },
      }),
    ).toBe(0);
  });

  it("I. disabled provider blocks everything", async () => {
    process.env = { ...OLD_ENV }; // intentionally no EMAIL_PROVIDER
    expect(currentEmailProvider()).toBe("disabled");
    expect(isClientEmailSendingEnabled()).toBe(false);
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(result.status).toBe("error");
    expect(result.message).toContain("not enabled yet");
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(
      await prisma.emailSendReservation.count({
        where: { leadId: consentedLeadId },
      }),
    ).toBe(0);
  });

  it("J. local simulation is never presented as real delivery", withEnv(EMAIL_ENABLED_LOCAL, async () => {
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(result.status).toBe("success");
    expect(result.message).toContain("(simulation)");
    expect(result.message).toContain("no external email was sent");
    expect(result.message).not.toContain("accepted by the delivery provider");

    const reservation = await prisma.emailSendReservation.findFirst({
      where: { leadId: consentedLeadId },
      select: { status: true },
    });
    expect(reservation?.status).toBe("simulated");
  }));

  it("C. a definitive provider rejection (4xx) records FAILED, never success", withEnv(EMAIL_ENABLED_RESEND, async () => {
    sendMailMock.mockResolvedValue({ ok: false, error: "resend_http_422:invalid_recipient" });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(result.status).toBe("error");
    expect(result.message).toContain("rejected the message. Nothing was sent.");

    const reservation = await prisma.emailSendReservation.findFirst({
      where: { leadId: consentedLeadId },
      select: { status: true },
    });
    expect(reservation?.status).toBe("failed");
  }));

  it("E. provider timeout/network failure records UNKNOWN and forbids immediate resend", withEnv(EMAIL_ENABLED_RESEND, async () => {
    sendMailMock.mockResolvedValue({ ok: false, error: "fetch failed" });

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(result.status).toBe("error");
    expect(result.message).toContain("may have been sent");
    expect(result.message).toContain("Do not resend immediately");

    const reservation = await prisma.emailSendReservation.findFirst({
      where: { leadId: consentedLeadId },
      select: { status: true },
    });
    expect(reservation?.status).toBe("unknown");

    // The per-lead interval still blocks an immediate duplicate attempt
    // (blind resend prevention), because the unknown attempt reserved a slot.
    const again = await reserveClientEmailSend(consentedLeadId, staffId);
    expect(again.allowed).toBe(false);
  }));

  it("D. provider accepts but the CRM audit write fails — reservation still latches ACCEPTED", withEnv(EMAIL_ENABLED_RESEND, async () => {
    sendMailMock.mockResolvedValue({ ok: true });
    // Force the communication audit event to fail.
    const spy = vi.spyOn(prisma.leadEvent, "create").mockRejectedValueOnce(new Error("audit down"));

    const action = await loadAction();
    const result = await action.sendClientEmail(null, emailForm(consentedLeadId));
    spy.mockRestore();

    expect(result.status).toBe("success");
    expect(result.message).toContain("accepted by the delivery provider.");
    // The reservation holds the auditable outcome even though the leadEvent
    // audit write failed — and "accepted" NEVER means "delivered" anywhere.
    const reservation = await prisma.emailSendReservation.findFirst({
      where: { leadId: consentedLeadId },
      select: { status: true },
    });
    expect(reservation?.status).toBe("accepted");
  }));

  it("F. duplicate request identifiers / browser retries are refused inside the interval; finalization is idempotent", withEnv(EMAIL_ENABLED_LOCAL, async () => {
    sendMailMock.mockResolvedValue({ ok: true });

    const action = await loadAction();
    const first = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(first.status).toBe("success");
    const reservation = await prisma.emailSendReservation.findFirst({
      where: { leadId: consentedLeadId },
      select: { id: true, status: true },
    });
    // Local provider ⇒ simulation status (never "accepted").
    expect(reservation?.status).toBe("simulated");

    // The immediate duplicate (browser retry / double submit) is refused by
    // the per-lead interval — the reservation from the FIRST attempt already
    // occupies the slot, so the duplicate can never reach the provider.
    const retry = await action.sendClientEmail(null, emailForm(consentedLeadId));
    expect(retry.status).toBe("error");
    expect(retry.message).toContain("was attempted recently");

    // Identifiers finalize idempotently — the same reservationId does not
    // create rows or change outcome.
    const latched = await finalizeClientEmailReservation(
      reservation!.id,
      "accepted",
    );
    expect(latched).toBe(1);
    const again = await finalizeClientEmailReservation(
      reservation!.id,
      "accepted",
    );
    expect(again).toBe(1);
    expect(
      await prisma.emailSendReservation.count({
        where: { leadId: consentedLeadId },
      }),
    ).toBe(1);
  }));
});
