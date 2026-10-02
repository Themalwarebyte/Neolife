/**
 * LOCAL / TEST ONLY — deterministic Playwright E2E fixture accounts.
 *
 * PURPOSE
 * `e2e/global-setup.ts` signs in as two fixed identities. Those sign-ins fail
 * unless the accounts exist with exactly the expected password. The existing
 * `scripts/seed-admin.ts` / `scripts/seed-staff.ts` cannot guarantee that: they
 * are idempotent on `role` only and never touch the credential, because
 * creation goes through Better Auth `signUpEmail`, which rejects an existing
 * email. This module makes the fixtures reproducible by resetting the two
 * fixture identities before each E2E run.
 *
 * SAFETY — this module deletes and recreates rows. It refuses to act unless
 * every condition below holds, and it only ever touches the two fixture emails.
 *
 *   1. E2E_SEED_USERS=1 is set (set by playwright.config.ts, never by deploy code)
 *   2. DATABASE_URL is present and parses
 *   3. The database host is a loopback/local address
 *   4. NODE_ENV is not "production"
 *   5. BETTER_AUTH_URL, if set, is not a remote origin
 *
 * If any check fails the module throws before opening a write path.
 *
 * NOT INVOKED BY: the application, `next build`, `next start`, the Dockerfile,
 * `compose.production.yaml`, `deploy/compose.yaml`, or any production entry
 * point. It is imported only by `e2e/global-setup.ts`, which is referenced only
 * from `playwright.config.ts`.
 */
import { auth } from "../src/lib/auth";
import { prisma } from "../src/server/db/prisma";

/**
 * Fixture identities, exported so specs can address a specific row without
 * hardcoding the address and risking drift from this module.
 */
export const E2E_OWNER_EMAIL = "office@test.local";
export const E2E_STAFF_EMAIL = "colleague1@neolife.local";

/** The ONLY two identities this module is permitted to manage. */
const FIXTURES = [
  {
    email: E2E_OWNER_EMAIL,
    name: "NEOLIFE Owner (E2E)",
    role: "admin",
    passwordEnv: "ADMIN_PASSWORD",
    defaultPassword: "owner-password-12345",
  },
  {
    email: E2E_STAFF_EMAIL,
    name: "NEOLIFE Colleague (E2E)",
    role: "staff",
    passwordEnv: "STAFF_PASSWORD",
    defaultPassword: "dev-staff-password-12345",
  },
] as const;

const LOCAL_DB_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
]);

function assertLocalOnly(): string {
  // 1. Explicit authorization flag.
  if (process.env.E2E_SEED_USERS !== "1") {
    throw new Error(
      "E2E fixture seeding is disabled. Set E2E_SEED_USERS=1 to run it " +
        "(playwright.config.ts sets this for E2E runs).",
    );
  }

  // 4. Never under a production runtime.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed E2E fixtures: NODE_ENV is 'production'.");
  }

  // 5. Never against a remote application origin.
  const authUrl = process.env.BETTER_AUTH_URL;
  if (authUrl) {
    let authHost: string;
    try {
      authHost = new URL(authUrl).hostname;
    } catch {
      throw new Error(
        `Refusing to seed E2E fixtures: BETTER_AUTH_URL is not a valid URL (${authUrl}).`,
      );
    }
    if (!LOCAL_DB_HOSTS.has(authHost)) {
      throw new Error(
        `Refusing to seed E2E fixtures: BETTER_AUTH_URL points at a remote host (${authHost}).`,
      );
    }
  }

  // 2 + 3. A local database, explicitly.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Refusing to seed E2E fixtures: DATABASE_URL is not set.");
  }

  let dbHost: string;
  try {
    dbHost = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(
      "Refusing to seed E2E fixtures: DATABASE_URL is not a valid URL.",
    );
  }

  if (!LOCAL_DB_HOSTS.has(dbHost)) {
    throw new Error(
      `Refusing to seed E2E fixtures: DATABASE_URL points at a non-local host (${dbHost}). ` +
        "This tool only operates on a local test database.",
    );
  }

  return dbHost;
}

function fixturePassword(fixture: (typeof FIXTURES)[number]): string {
  const fromEnv = process.env[fixture.passwordEnv];
  return fromEnv && fromEnv.length > 0 ? fromEnv : fixture.defaultPassword;
}

/**
 * Create or deterministically reset the E2E fixture accounts.
 *
 * Reset strategy: delete the existing fixture row (cascading its `Account`
 * credential and `Session` rows) and recreate it through Better Auth so the
 * password is hashed by the library and never stored in plaintext. Leads and
 * LeadEvents are NOT deleted — both relations are `onDelete: SetNull`, so a
 * deleted user's leads and audit history are retained with a null actor.
 */
export async function seedE2EFixtures(): Promise<void> {
  const dbHost = assertLocalOnly();

  console.log(`[e2e-seed] local database confirmed (${dbHost})`);

  for (const fixture of FIXTURES) {
    const password = fixturePassword(fixture);

    const existing = await prisma.user.findUnique({
      where: { email: fixture.email },
      select: { id: true },
    });

    if (existing) {
      // Scoped to a single verified fixture email. No wildcard, no truncate.
      await prisma.user.delete({ where: { id: existing.id } });
      console.log(`[e2e-seed] removed existing fixture ${fixture.email}`);
    }

    const created = await auth.api.signUpEmail({
      body: { email: fixture.email, password, name: fixture.name },
    });

    const userId = created?.user?.id;
    if (!userId) {
      throw new Error(
        `[e2e-seed] Failed to create fixture ${fixture.email}: Better Auth returned no user id.`,
      );
    }

    // role / mustChangePassword are set server-side; Better Auth's additionalFields
    // declare them `input: false`, so a client could never supply them.
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: fixture.role,
        mustChangePassword: false,
        isActive: true,
      },
    });

    console.log(`[e2e-seed] created ${fixture.email} (${fixture.role})`);
  }

  await prisma.$disconnect();
}
