/**
 * Task #037 — secure, idempotent provisioning of the two named NEOLIFE users.
 *
 * Creates (or preserves) the two intended human CRM accounts:
 *
 *   Owner   → role "admin"   (full CRM access; also referral-eligible)
 *   Partner → role "staff"   (Partner is a DISPLAY label only — see
 *                             displayRoleLabel in src/lib/user-management.ts)
 *
 * CONFIGURATION (environment variables — no values are committed anywhere):
 *
 *   PROVISION_OWNER_NAME           e.g. "Glen Mainga"
 *   PROVISION_OWNER_EMAIL          login AND notification email
 *   PROVISION_OWNER_PHONE          e.g. 0718002416
 *   PROVISION_PARTNER_NAME         e.g. "Rahab Nyokabi 🌹"
 *   PROVISION_PARTNER_EMAIL        login AND notification email
 *   PROVISION_PARTNER_PHONE        e.g. 0727772331
 *   PROVISION_OWNER_NOTIFICATION_EMAIL / PROVISION_PARTNER_NOTIFICATION_EMAIL
 *                                  optional override of WHERE alerts go
 *
 * IDENTITY CONTINUITY (requirements 2/3): matching is by unique email. An
 * existing account is NEVER deleted or overwritten — not its name, not its
 * password, not its role, not its activation state. Only EMPTY optional
 * profile fields (phone / notificationEmail) are backfilled. All other
 * existing accounts (including any previously seeded Owner) are untouched.
 *
 * PASSWORDS (requirement 6): fresh cryptographically strong temporary
 * passwords (144-bit CSPRNG, unique per account) are generated here and
 * written to a MODE-0600 file OUTSIDE the repository (system temp dir).
 * They are never printed, logged, or committed. New accounts get
 * mustChangePassword=true (forced change at first login, D-033); existing
 * accounts keep their credentials untouched.
 *
 * Usage (local dev or the production seed profile):
 *
 *   PROVISION_OWNER_NAME="Glen Mainga" PROVISION_OWNER_EMAIL=... \
 *   PROVISION_OWNER_PHONE=0718002416 \
 *   PROVISION_PARTNER_NAME="Rahab Nyokabi 🌹" PROVISION_PARTNER_EMAIL=... \
 *   PROVISION_PARTNER_PHONE=0727772331 \
 *   pnpm exec tsx scripts/seed-neolife-users.ts
 *
 * SECURITY: delete the credentials file as soon as the temporary passwords
 * have been handed over securely — they are single-use (forced password
 * change on first login).
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  generateTemporaryPassword,
  provisionCrmUsers,
  type ProvisioningIntent,
  type ProvisioningReportEntry,
} from "../src/lib/provisioning";
import { prisma } from "../src/server/db/prisma";

const REQUIRED_ENV = [
  "PROVISION_OWNER_NAME",
  "PROVISION_OWNER_EMAIL",
  "PROVISION_OWNER_PHONE",
  "PROVISION_PARTNER_NAME",
  "PROVISION_PARTNER_EMAIL",
  "PROVISION_PARTNER_PHONE",
] as const;

function missingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === null || value.trim() === "";
  });
}

function buildIntents(): ProvisioningIntent[] {
  return [
    {
      kind: "owner",
      name: process.env.PROVISION_OWNER_NAME ?? "",
      email: process.env.PROVISION_OWNER_EMAIL ?? "",
      phone: process.env.PROVISION_OWNER_PHONE ?? null,
      notificationEmail: process.env.PROVISION_OWNER_NOTIFICATION_EMAIL ?? null,
    },
    {
      kind: "partner",
      name: process.env.PROVISION_PARTNER_NAME ?? "",
      email: process.env.PROVISION_PARTNER_EMAIL ?? "",
      phone: process.env.PROVISION_PARTNER_PHONE ?? null,
      notificationEmail:
        process.env.PROVISION_PARTNER_NOTIFICATION_EMAIL ?? null,
    },
  ];
}

/**
 * Persist the credentials of NEWLY CREATED accounts to a private file
 * (mode 0600) in the OS temp dir. NEVER to stdout, NEVER inside the repo.
 * Provisioning is strictly sequential, so password #n belongs to outcome #n.
 */
function writeCredentialsFile(
  intents: ProvisioningIntent[],
  passwords: string[],
  entries: ProvisioningReportEntry[],
): string | null {
  const credentials = entries
    .map((entry, index) =>
      entry.outcome.status === "created"
        ? {
            name: intents[index]!.name,
            email: entry.outcome.email,
            role: entry.outcome.role,
            phone: intents[index]!.phone ?? null,
            temporaryPassword: passwords[index]!,
            mustChangePassword: true,
          }
        : null,
    )
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (credentials.length === 0) return null; // nothing new created

  const dir = path.join(os.tmpdir(), "neolife-provisioning");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Filename carries a timestamp + 8 random chars — no personal data, and
  // the 0600/0700 permissions are the real protection.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = Math.random().toString(36).slice(2, 10);
  const file = path.join(dir, `credentials-${stamp}-${nonce}.json`);
  fs.writeFileSync(file, JSON.stringify(credentials, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
  return file;
}

async function main() {
  const missing = missingEnv();
  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    for (const name of missing) console.error(`  ${name}`);
    console.error(
      "\nProvide all six variables for the two intended users " +
        "(see the header of this script). Do NOT pass passwords through " +
        "the environment — fresh temporary passwords are generated below.",
    );
    process.exitCode = 1;
    return;
  }

  const intents = buildIntents();
  // One fresh CSPRNG password per intent, generated up-front so the
  // credentials file and the account creation cannot diverge.
  const passwords = intents.map(() => generateTemporaryPassword());
  let next = 0;
  // Sequential generator: each created account consumes exactly one password,
  // preserving the passwords[n] ↔ entries[n] correspondence.
  const generator = () => passwords[next++] as string;

  const entries = await provisionCrmUsers(intents, generator);

  console.log("");
  console.log("Provisioning report:");
  for (const { intent, outcome } of entries) {
    if (outcome.status === "created") {
      console.log(
        `  CREATED  ${outcome.email} (role=${outcome.role}, ` +
          "mustChangePassword=true, temporary password secured in the credentials file)",
      );
    } else {
      const filled = outcome.backfilled.join(", ") || "nothing";
      console.log(
        `  PRESERVED ${outcome.email} (existing account; identity, credentials ` +
          `and access untouched; backfilled: ${filled}` +
          (outcome.roleMismatch
            ? `; NOTE: existing role "${outcome.role}" differs from intended "${intent.kind}" — kept as-is`
            : "") +
          ")",
      );
    }
  }

  const file = writeCredentialsFile(intents, passwords, entries);
  if (file) {
    console.log("");
    console.log(`Temporary passwords (new accounts only): ${file}`);
    console.log(
      "  The file is mode 0600 in the system temp dir. Read it once, hand " +
        "the passwords to the two users securely, then DELETE the file. " +
        "Passwords are forced to change on first sign-in.",
    );
  } else {
    console.log("");
    console.log(
      "No new accounts were created — existing credentials are unchanged.",
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
