import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import {
  provisionCrmUsers,
  type ProvisioningIntent,
} from "../src/lib/provisioning";

/**
 * Task #037 — DB-backed provisioning integration tests.
 * Skipped unless DATABASE_URL points at a reachable local PostgreSQL,
 * exactly like the other DB-gated suites (AGENTS.md testing conventions).
 */

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const runIfDb = DB_AVAILABLE ? describe : describe.skip;

const OWNER_EMAIL = "provisioner-owner@test.local";
const PARTNER_EMAIL = "provisioner-partner@test.local";
const OTHER_ADMIN_EMAIL = "provisioner-other-admin@test.local";
const PARTNER_EMAILS = [OWNER_EMAIL, PARTNER_EMAIL, OTHER_ADMIN_EMAIL];

/** Fixture temporary passwords (test-only; the CLI uses CSPRNG values). */
const TEMP_A = "test-temp-password-A-0123456789";
const TEMP_B = "test-temp-password-B-9876543210";
const TEMP_C = "different-password-set-on-retry-only-zzz";

function ownerIntent(extra: Partial<ProvisioningIntent> = {}): ProvisioningIntent {
  return {
    kind: "owner",
    name: "Provisioner Owner",
    email: OWNER_EMAIL,
    phone: "07181112222",
    notificationEmail: null,
    ...extra,
  };
}

function partnerIntent(extra: Partial<ProvisioningIntent> = {}): ProvisioningIntent {
  return {
    kind: "partner",
    name: "Provisioner Partner",
    email: PARTNER_EMAIL,
    phone: "07272223333",
    notificationEmail: "partner-notifications@test.local",
    ...extra,
  };
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { in: PARTNER_EMAILS } } });
}

async function credentialHash(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { accounts: { select: { password: true } } },
  });
  return user?.accounts[0]?.password ?? null;
}

runIfDb("Task #037 — idempotent two-user provisioning (DB)", () => {
  beforeAll(async () => {
    await cleanup();
    // A PRE-EXISTING Owner account that must survive provisioning untouched
    // (identity continuity requirement 3): a different email, already admin.
    await prisma.user.create({
      data: {
        id: `prov-other-${Date.now()}`,
        name: "Pre-existing Owner",
        email: OTHER_ADMIN_EMAIL,
        role: "admin",
        phone: "07000000000",
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("creates both intended users with exact roles, forced password change and profile fields", async () => {
    let next = 0;
    const passwords = [TEMP_A, TEMP_B];
    const generator = () => passwords[next++] as string;

    const entries = await provisionCrmUsers(
      [partnerIntent(), ownerIntent()],
      generator,
    );

    expect(entries).toHaveLength(2);

    // Partner: SYSTEM role staff. "Partner" is a display label only.
    const partnerOutcome = entries[0]!.outcome;
    expect(partnerOutcome.status).toBe("created");
    if (partnerOutcome.status !== "created") return;
    expect(partnerOutcome.role).toBe("staff");

    const partner = await prisma.user.findUnique({
      where: { email: PARTNER_EMAIL },
      select: {
        role: true,
        phone: true,
        notificationEmail: true,
        mustChangePassword: true,
        isActive: true,
      },
    });
    expect(partner?.role).toBe("staff");
    expect(partner?.phone).toBe("07272223333");
    expect(partner?.notificationEmail).toBe("partner-notifications@test.local");
    expect(partner?.mustChangePassword).toBe(true);
    expect(partner?.isActive).toBe(true);

    // Owner: exact role admin, same guarantees.
    const ownerOutcome = entries[1]!.outcome;
    expect(ownerOutcome.status).toBe("created");
    if (ownerOutcome.status !== "created") return;
    expect(ownerOutcome.role).toBe("admin");
    const owner = await prisma.user.findUnique({
      where: { email: OWNER_EMAIL },
      select: { role: true, phone: true, mustChangePassword: true },
    });
    expect(owner?.role).toBe("admin");
    expect(owner?.phone).toBe("07181112222");
    expect(owner?.mustChangePassword).toBe(true);
  });

  it("is idempotent: a re-run PRESERVES the existing accounts and never touches credentials", async () => {
    const beforePartner = await prisma.user.findUnique({ where: { email: PARTNER_EMAIL } });
    const beforeOwner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    const beforePartnerHash = await credentialHash(PARTNER_EMAIL);
    const beforeOwnerHash = await credentialHash(OWNER_EMAIL);
    expect(beforePartner).not.toBeNull();
    expect(beforeOwner).not.toBeNull();

    // A DIFFERENT temporary password is offered on the re-run — it must be
    // ignored: an existing account's credentials are never overwritten.
    const entries = await provisionCrmUsers(
      [ownerIntent(), partnerIntent()],
      () => TEMP_C,
    );

    for (const { outcome } of entries) {
      expect(outcome.status).toBe("existing_preserved");
      if (outcome.status === "existing_preserved") {
        expect(outcome.backfilled).toEqual([]); // nothing was empty
        expect(outcome.roleMismatch).toBe(false); // roles match intent
      }
    }

    const afterPartner = await prisma.user.findUnique({ where: { email: PARTNER_EMAIL } });
    const afterOwner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    expect(afterPartner).toEqual(beforePartner);
    expect(afterOwner).toEqual(beforeOwner);
    expect(await credentialHash(PARTNER_EMAIL)).toBe(beforePartnerHash);
    expect(await credentialHash(OWNER_EMAIL)).toBe(beforeOwnerHash);
  });

  it("backfills ONLY empty profile fields of an existing account and never changes identity", async () => {
    // Wipe phone/notificationEmail to create gaps, and give the account a
    // distinctive existing name/phone that MUST survive.
    await prisma.user.update({
      where: { email: PARTNER_EMAIL },
      data: { phone: "07991111111", notificationEmail: null },
    });
    const preName = (
      await prisma.user.findUnique({
        where: { email: PARTNER_EMAIL },
        select: { name: true },
      })
    )?.name;

    const [partnerEntry] = await provisionCrmUsers([partnerIntent()], () => TEMP_C);
    expect(partnerEntry?.outcome.status).toBe("existing_preserved");
    if (partnerEntry?.outcome.status !== "existing_preserved") return;
    // phone existed → untouched; notificationEmail empty → backfilled.
    expect(partnerEntry.outcome.backfilled).toEqual(["notificationEmail"]);

    const after = await prisma.user.findUnique({
      where: { email: PARTNER_EMAIL },
      select: { name: true, phone: true, notificationEmail: true },
    });
    expect(after?.name).toBe(preName);
    expect(after?.phone).toBe("07991111111");
    expect(after?.notificationEmail).toBe("partner-notifications@test.local");
  });

  it("leaves every OTHER existing account (e.g. a pre-existing Owner) completely untouched", async () => {
    const pre = await prisma.user.findUnique({
      where: { email: OTHER_ADMIN_EMAIL },
      select: { name: true, role: true, phone: true, isActive: true },
    });

    await provisionCrmUsers([ownerIntent(), partnerIntent()], () => TEMP_C);

    const post = await prisma.user.findUnique({
      where: { email: OTHER_ADMIN_EMAIL },
      select: { name: true, role: true, phone: true, isActive: true },
    });
    expect(post).toEqual(pre);
    expect(pre?.role).toBe("admin"); // original Owner access continuity
  });

  it("never deletes or reassigns anything, even for unknown accounts", async () => {
    const userCountBefore = await prisma.user.count();
    await provisionCrmUsers([ownerIntent(), partnerIntent()], () => TEMP_C);
    expect(await prisma.user.count()).toBe(userCountBefore);
  });
});
