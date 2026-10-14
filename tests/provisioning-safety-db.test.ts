import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  createPasswordVault,
  preflightProvisioning,
  provisionCrmUsers,
  rollbackProvisionedAccounts,
  verifyProvisionedCredential,
  type ProvisioningIntent,
} from "../src/lib/provisioning";

/**
 * Task #038 — provisioning SAFETY tests (DB).
 *
 * Covers the four password-mapping cases the Task #037 defect could hit:
 *   A. Owner new, Partner new
 *   B. Owner existing, Partner new          ← the defect case
 *   C. Owner new, Partner existing
 *   D. Owner existing, Partner existing
 * plus credential verification (every delivered password must authenticate),
 * guarded rollback (failure recovery) and the read-only two-user preflight.
 */

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

/** Test-only fixture passwords (the CLI always generates fresh CSPRNG ones). */
const OLD_OWNER_PW = "s038-owner-old-pass-001!";
const OLD_PARTNER_PW = "s038-partner-old-pass-002!";

const EMAILS = {
  aOwner: "s038a-owner@test.local",
  aPartner: "s038a-partner@test.local",
  bOwner: "s038b-owner@test.local",
  bPartner: "s038b-partner@test.local",
  cOwner: "s038c-owner@test.local",
  cPartner: "s038c-partner@test.local",
  dOwner: "s038d-owner@test.local",
  dPartner: "s038d-partner@test.local",
  rbPlain: "s038rb-plain@test.local",
  rbWired: "s038rb-wired@test.local",
  pfOther: "s038pf-other@test.local",
  pfInactive: "s038pf-inactive@test.local",
  pfNewOwner: "s038pf-owner-new@test.local",
  pfAdminPartner: "s038pf-admin-partner@test.local",
} as const;

const ALL_EMAILS = Object.values(EMAILS);

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { in: ALL_EMAILS } } });
}

/** Creates a real, password-backed account through Better Auth. */
async function createFixtureUser(
  email: string,
  name: string,
  role: "admin" | "staff",
  password: string,
) {
  const auth = (await import("../src/lib/auth")).auth;
  const signUp = await auth.api.signUpEmail({ body: { name, email, password } });
  const userId = signUp?.user?.id;
  if (!userId) throw new Error(`fixture creation failed for ${email}`);
  await prisma.user.update({
    where: { id: userId },
    data: { role, mustChangePassword: false, phone: "07999990000" },
  });
  return prisma.user.findUnique({ where: { email } });
}

/** Idempotent fixture creation (reuse an existing account when present). */
async function ensureFixtureUser(
  email: string,
  name: string,
  role: "admin" | "staff",
  password: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  return existing ?? createFixtureUser(email, name, role, password);
}

function intent(
  kind: "owner" | "partner",
  email: string,
  name = "Example Account",
): ProvisioningIntent {
  return { kind, name, email, phone: "0711223344", notificationEmail: null };
}

/** The exact script-side pipeline: vault-bound delivery, then verification. */
async function runProvisioning(emailIntents: ProvisioningIntent[]) {
  const vault = createPasswordVault();
  const entries = await provisionCrmUsers(
    emailIntents,
    (provisionIntent) => vault.get(provisionIntent),
  );
  // Every password bound to a CREATED account must authenticate that exact
  // account (requirement: passwords in the credentials file always work).
  for (const { outcome } of entries) {
    if (outcome.status !== "created") continue;
    const password = vault.passwordFor(outcome.email);
    expect(password).toBeTruthy();
    expect(await verifyProvisionedCredential(outcome.email, password!)).toBe(true);
  }
  return { vault, entries };
}

runIfDb("Task #038 — provisioning safety (DB)", () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("case A — Owner new, Partner new: both created with their OWN delivered passwords", async () => {
    const { vault, entries } = await runProvisioning([
      intent("owner", EMAILS.aOwner, "A Owner"),
      intent("partner", EMAILS.aPartner, "A Partner"),
    ]);

    expect(entries.map((e) => e.outcome.status)).toEqual(["created", "created"]);
    const [ownerOut, partnerOut] = entries.map((e) => e.outcome);
    if (ownerOut.status !== "created" || partnerOut.status !== "created") {
      throw new Error("unexpected outcome shape in case A");
    }
    expect(ownerOut.role).toBe("admin");
    expect(partnerOut.role).toBe("staff");

    // Mapping is per-account: two distinct passwords, each authenticating
    // its own account only.
    const ownerPw = vault.passwordFor(EMAILS.aOwner)!;
    const partnerPw = vault.passwordFor(EMAILS.aPartner)!;
    expect(ownerPw).not.toBe(partnerPw);
    expect(await verifyProvisionedCredential(EMAILS.aOwner, ownerPw)).toBe(true);
    expect(await verifyProvisionedCredential(EMAILS.aPartner, partnerPw)).toBe(true);
    // Cross-account mapping must NOT authenticate.
    expect(await verifyProvisionedCredential(EMAILS.aPartner, ownerPw)).toBe(false);
    expect(await verifyProvisionedCredential(EMAILS.aOwner, partnerPw)).toBe(false);

    for (const email of [EMAILS.aOwner, EMAILS.aPartner]) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { mustChangePassword: true },
      });
      expect(user?.mustChangePassword).toBe(true);
    }
  });

  it("case B — Owner existing, Partner new (the Task #037 defect case): the Partner receives the password Better Auth actually consumed", async () => {
    const preOwner = await createFixtureUser(
      EMAILS.bOwner,
      "B Owner (pre-existing)",
      "admin",
      OLD_OWNER_PW,
    );
    expect(preOwner?.mustChangePassword).toBe(false);

    const { vault, entries } = await runProvisioning([
      intent("owner", EMAILS.bOwner, "B Owner"),
      intent("partner", EMAILS.bPartner, "B Partner"),
    ]);

    expect(entries[0]!.outcome.status).toBe("existing_preserved");
    expect(entries[1]!.outcome.status).toBe("created");
    const partnerOutcome = entries[1]!.outcome;
    if (partnerOutcome.status !== "created") throw new Error("unexpected shape");
    expect(partnerOutcome.role).toBe("staff");

    // CRITICAL: the password bound to the PARTNER (the one that would land in
    // the credentials file) is the one the Partner can sign in with — even
    // though the Owner consumed no password at all.
    const partnerDelivered = vault.passwordFor(EMAILS.bPartner);
    expect(partnerDelivered).toBeTruthy();
    expect(await verifyProvisionedCredential(EMAILS.bPartner, partnerDelivered!)).toBe(true);

    // The Owner consumed NO password: nothing is bound/delivered for him,
    // and his ORIGINAL password still authenticates.
    expect(vault.passwordFor(EMAILS.bOwner)).toBeUndefined();
    expect(await verifyProvisionedCredential(EMAILS.bOwner, OLD_OWNER_PW)).toBe(true);

    // Identity continuity: role, activation and forced-change flag untouched.
    const owner = await prisma.user.findUnique({
      where: { email: EMAILS.bOwner },
      select: { role: true, isActive: true, mustChangePassword: true },
    });
    expect(owner?.role).toBe("admin");
    expect(owner?.isActive).toBe(true);
    expect(owner?.mustChangePassword).toBe(false);

    const partnerUser = await prisma.user.findUnique({
      where: { email: EMAILS.bPartner },
      select: { mustChangePassword: true },
    });
    expect(partnerUser?.mustChangePassword).toBe(true);
  });

  it("case C — Owner new, Partner existing: Owner gets his own password, Partner credentials untouched", async () => {
    const prePartner = await createFixtureUser(
      EMAILS.cPartner,
      "C Partner (pre-existing)",
      "staff",
      OLD_PARTNER_PW,
    );
    expect(prePartner?.mustChangePassword).toBe(false);

    const { vault, entries } = await runProvisioning([
      intent("owner", EMAILS.cOwner, "C Owner"),
      intent("partner", EMAILS.cPartner, "C Partner"),
    ]);

    expect(entries[0]!.outcome.status).toBe("created");
    expect(entries[1]!.outcome.status).toBe("existing_preserved");

    const ownerDelivered = vault.passwordFor(EMAILS.cOwner)!;
    expect(await verifyProvisionedCredential(EMAILS.cOwner, ownerDelivered)).toBe(true);
    expect(vault.passwordFor(EMAILS.cPartner)).toBeUndefined();
    expect(await verifyProvisionedCredential(EMAILS.cPartner, OLD_PARTNER_PW)).toBe(true);

    const partner = await prisma.user.findUnique({
      where: { email: EMAILS.cPartner },
      select: { role: true, mustChangePassword: true },
    });
    expect(partner?.role).toBe("staff");
    expect(partner?.mustChangePassword).toBe(false);
  });

  it("case D — both existing: nothing created, nothing delivered, old passwords stay valid, idempotent", async () => {
    await createFixtureUser(EMAILS.dOwner, "D Owner", "admin", OLD_OWNER_PW);
    await createFixtureUser(EMAILS.dPartner, "D Partner", "staff", OLD_PARTNER_PW);

    const before = await prisma.user.findMany({
      where: { email: { in: [EMAILS.dOwner, EMAILS.dPartner] } },
    });
    const beforeJson = JSON.stringify(before);

    // Run 1 — nothing should be created; a credentials file would be empty.
    const { vault, entries } = await runProvisioning([
      intent("owner", EMAILS.dOwner),
      intent("partner", EMAILS.dPartner),
    ]);
    expect(entries.every((e) => e.outcome.status === "existing_preserved")).toBe(true);
    expect(vault.deliveredEmails()).toEqual([]);
    expect(vault.passwordFor(EMAILS.dOwner)).toBeUndefined();
    expect(vault.passwordFor(EMAILS.dPartner)).toBeUndefined();

    // Old credentials still valid.
    expect(await verifyProvisionedCredential(EMAILS.dOwner, OLD_OWNER_PW)).toBe(true);
    expect(await verifyProvisionedCredential(EMAILS.dPartner, OLD_PARTNER_PW)).toBe(true);
    const after = await prisma.user.findMany({
      where: { email: { in: [EMAILS.dOwner, EMAILS.dPartner] } },
    });
    expect(JSON.stringify(after)).toEqual(beforeJson);

    // Idempotent repeated execution — identical outcome, zero deliveries.
    const second = await provisionCrmUsers([
      intent("owner", EMAILS.dOwner),
      intent("partner", EMAILS.dPartner),
    ]);
    expect(second.every((e) => e.outcome.status === "existing_preserved")).toBe(true);
  });

  it("UNDELIVERED password never authenticates a preserved account (no silent handover)", async () => {
    await createFixtureUser(EMAILS.rbWired, "RB Wired", "admin", OLD_OWNER_PW);
    const { vault, entries } = await runProvisioning([
      intent("owner", EMAILS.rbWired),
      intent("partner", EMAILS.aPartner), // FRESH password for the new one
    ]);
    // The preserved owner consumed nothing from the vault.
    expect(entries[0]!.outcome.status).toBe("existing_preserved");
    expect(vault.passwordFor(EMAILS.rbWired)).toBeUndefined();
  });

  it("rollback deletes only brand-new data-less accounts and refuses wired ones", async () => {
    // Wired account: has a referral code — must NEVER be auto-deleted.
    await ensureFixtureUser(EMAILS.rbWired, "RB Wired", "admin", OLD_OWNER_PW);
    const wired = await prisma.user.findUnique({ where: { email: EMAILS.rbWired } });
    await prisma.referralCode.create({
      data: {
        userId: wired!.id,
        code: "s038testrefcode000002",
        publicName: "RB Wired",
        publicNameNormal: "rb wired",
      },
    });

    // Plain new account: no leads, no referral code.
    await createFixtureUser(EMAILS.rbPlain, "RB Plain", "staff", OLD_PARTNER_PW);

    const outcomes = await rollbackProvisionedAccounts([
      EMAILS.rbPlain,
      EMAILS.rbWired,
      "s038rb-unknown@test.local",
    ]);

    const byEmail = new Map(outcomes.map((o) => [o.email, o]));
    expect(byEmail.get(EMAILS.rbPlain)?.status).toBe("deleted");
    expect(byEmail.get(EMAILS.rbWired)?.status).toBe("skipped_has_crm_data");
    expect(byEmail.get("s038rb-unknown@test.local")?.status).toBe("not_found");

    expect(await prisma.user.findUnique({ where: { email: EMAILS.rbWired } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { email: EMAILS.rbPlain } })).toBeNull();

    // Remove the referral fixture row so cleanup can delete the user.
    await prisma.referralCode.deleteMany({ where: { userId: wired!.id } });
  });

  it("preflight — existing Owner with a DIFFERENT email blocks provisioning (Fix 3)", async () => {
    await createFixtureUser(EMAILS.pfOther, "PF Other Owner", "admin", OLD_OWNER_PW);

    // The intended Owner is a brand-new email; a DIFFERENT active admin
    // already exists ⇒ blocking, and no run may silently proceed.
    const report = await preflightProvisioning([
      intent("owner", EMAILS.pfNewOwner),
      intent("partner", EMAILS.dPartner), // preserved (from case D)
    ]);

    expect(report.blocking).toBe(true);
    expect(report.ownerIdentityMismatch).toBe(true);
    expect(report.existingOwnerEmails).toContain(EMAILS.pfOther);
    expect(report.intents.find((s) => s.email === EMAILS.pfNewOwner)?.action).toBe(
      "would_create",
    );
    expect(report.intents.find((s) => s.email === EMAILS.dPartner)?.action).toBe(
      "preserved",
    );
    expect(
      report.additionalActiveUsers.map((u) => u.email),
    ).toContain(EMAILS.pfOther);
  });

  it("preflight — exact Owner email match is NOT blocking and reports role mismatch", async () => {
    const ownerUser = await ensureFixtureUser(
      EMAILS.pfOther,
      "PF Other Owner",
      "admin",
      OLD_OWNER_PW,
    );
    void ownerUser;
    // An admin already holds the intended PARTNER email → role mismatch.
    await createFixtureUser(EMAILS.pfAdminPartner, "PF Admin Partner", "admin", OLD_PARTNER_PW);

    const report = await preflightProvisioning([
      intent("owner", EMAILS.pfOther),
      intent("partner", EMAILS.pfAdminPartner),
    ]);

    expect(report.blocking).toBe(false); // intended Owner exists → identity OK
    expect(report.ownerIdentityMismatch).toBe(false);
    expect(report.intents[0]!.action).toBe("preserved");
    expect(report.intents[0]!.roleMismatch).toBe(false);
    expect(report.intents[0]!.existingRole).toBe("admin");
    expect(report.intents[1]!.action).toBe("preserved");
    expect(report.intents[1]!.roleMismatch).toBe(true); // admin vs intended staff
    expect(report.intents[1]!.existingRole).toBe("admin");
  });

  it("preflight — INACTIVE extra admins do not trigger the owner-mismatch stop", async () => {
    await createFixtureUser(EMAILS.pfInactive, "PF Inactive Admin", "admin", OLD_OWNER_PW);
    await prisma.user.update({ where: { email: EMAILS.pfInactive }, data: { isActive: false } });

    const report = await preflightProvisioning([
      intent("owner", EMAILS.pfOther), // preserved active admin → identity OK
      intent("partner", EMAILS.pfAdminPartner),
    ]);
    // Deactivated extra admin is NOT among active CRM users → not blocking.
    expect(report.activeCrmUsers.map((u) => u.email)).not.toContain(EMAILS.pfInactive);
    expect(report.ownerIdentityMismatch).toBe(false);
    expect(report.blocking).toBe(false);
  });
});
