/**
 * Phase B (dev/test only) — Staff account provisioning.
 *
 * Creates a local-development Staff account via Better Auth's sign-up flow
 * (password hashed by Better Auth — never stored in plaintext). This script is
 * for local development and test environments only.
 *
 * It mirrors the architecture of src/lib/auth.ts and scripts/seed-admin.ts:
 *   - role is NOT client-supplied (Better Auth `input: false`).
 *   - role is SET SERVER-SIDE via prisma after sign-up, same as seed-admin.ts.
 *   - Uses the same env-var credential pattern (no hard-coded secrets).
 *
 * Usage:
 *   $env:STAFF_EMAIL='colleague@example.com'
 *   $env:STAFF_PASSWORD='<12+ char password>'
 *   $env:STAFF_NAME='Colleague Name'
 *   pnpm exec tsx scripts/seed-staff.ts
 *
 * The default STAFF_EMAIL/STAFF_PASSWORD values are intentionally weak and clearly
 * marked as development-only. Do NOT use in production.
 */
import { auth } from "../src/lib/auth";
import { prisma } from "../src/server/db/prisma";

async function main() {
  const email = (process.env.STAFF_EMAIL ?? "colleague@neolife.local").trim().toLowerCase();
  const password = process.env.STAFF_PASSWORD ?? "dev-staff-password-12345";
  const name = process.env.STAFF_NAME ?? "Colleague";

  if (password.length < 12) {
    throw new Error(
      "STAFF_PASSWORD must be at least 12 characters. Default dev password is pre-set; override for real use.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await auth.api.signUpEmail({
      body: { name: name.trim() || "Colleague", email, password },
    });
  }

  // Set role explicitly server-side — never trusts client-supplied role.
  // role "staff" is already the default, but we enforce it here for clarity.
  await prisma.user.update({ where: { email }, data: { role: "staff" } });

  console.log(`Staff account ready (dev-only): ${email} (role=staff)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
