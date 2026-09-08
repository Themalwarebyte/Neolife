/**
 * Task 1.7 — admin provisioning (local-first).
 *
 * Creates the office/admin account from environment variables. There is no
 * public sign-up route, so the only way to become an authenticated user is this
 * seed (or direct database access). Run once:
 *
 *   $env:ADMIN_EMAIL='office@example.com'
 *   $env:ADMIN_PASSWORD='<strong password>'
 *   pnpm exec tsx scripts/seed-admin.ts
 *
 * Passwords are hashed by Better Auth — never stored in plaintext.
 */
import { auth } from "../src/lib/auth";
import { prisma } from "../src/server/db/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await auth.api.signUpEmail({
      body: { name: "Office Admin", email, password },
    });
  }
  await prisma.user.update({ where: { email }, data: { role: "admin" } });

  console.log(`Admin account ready: ${email} (role=admin)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
