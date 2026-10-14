/**
 * Task #037/#038 — secure, idempotent provisioning of the two intended NEOLIFE
 * CRM users (Owner = role "admin", Partner = role "staff" with a display-only
 * "Partner" label — see displayRoleLabel in src/lib/user-management.ts).
 *
 * CONFIGURATION (environment variables — no values are committed anywhere):
 *
 *   PROVISION_OWNER_NAME           e.g. "Example Owner"
 *   PROVISION_OWNER_EMAIL          e.g. "owner@example.com"
 *   PROVISION_OWNER_PHONE          e.g. "<phone>"
 *   PROVISION_PARTNER_NAME         e.g. "Example Partner"
 *   PROVISION_PARTNER_EMAIL        e.g. "partner@example.com"
 *   PROVISION_PARTNER_PHONE        e.g. "<phone>"
 *   PROVISION_OWNER_NOTIFICATION_EMAIL / PROVISION_PARTNER_NOTIFICATION_EMAIL
 *                                  optional override of WHERE alerts go
 *
 * RUN MODES
 *   --dry-run   read-only preflight (FIX 3): reports what WOULD happen, the
 *               active CRM users present, role mismatches, and whether the
 *               existing Owner identity differs from the intended Owner
 *               login. Writes nothing. Exit 0 = clean, 2 = STOP (Owner
 *               decision required), 1 = preflight error.
 *   (default)   preflight + idempotent provisioning.
 *
 * IDENTITY CONTINUITY (Task #037 req 2/3): matching is by unique email. An
 * existing account is NEVER deleted or overwritten — not its name, not its
 * password, not its role, not its activation state. Only EMPTY optional
 * profile fields (phone / notificationEmail) are backfilled. All other
 * existing accounts are untouched.
 *
 * STOP GATE (Task #038 Fix 3): if the intended Owner login differs from the
 * existing Owner identity (a different email already holds an active admin
 * account), provisioning REFUSES to run — the existing Owner is never
 * silently renamed, replaced, disabled or migrated. A separate Owner
 * decision is required; acknowledging it explicitly with
 * PROVISION_ACKNOWLEDGE_OWNER_MISMATCH=1 is the only override.
 *
 * PASSWORDS (Task #037 req 6 / Task #038 Fix 1):
 *   - Fresh 144-bit CSPRNG temporary passwords per NEW account, generated up
 *     front and bound to the EXACT account email they are delivered to
 *     (createPasswordVault) — no positional indexing, so mixed scenarios
 *     (e.g. Owner existing, Partner new) always deliver the password Better
 *     Auth actually received.
 *   - Every password is VERIFIED via a real Better Auth sign-in BEFORE the
 *     credentials file is written; an unverified password never reaches a
 *     delivered file.
 *   - Passwords live only in a MODE-0600 file in the system temp dir; they
 *     are never printed, logged, or committed. mustChangePassword=true is
 *     forced on first login (D-033); existing accounts keep credentials.
 *
 * FAILURE RECOVERY (Task #038 Fix 1): if credential delivery fails AFTER an
 * account was created (file write error), the script attempts a guarded
 * rollback (rollbackProvisionedAccounts) of ONLY those brand-new,
 * data-less accounts and reports the outcome explicitly. It never leaves an
 * inaccessible account reported as "preserved". Recovery states:
 *   1. "deleted"          — rolled back cleanly; FIX THE DELIVERY ISSUE and
 *                          simply re-run the script (idempotent).
 *   2. "skipped_has_crm_data" — the account already has CRM data (leads or a
 *                          referral code): nothing was auto-deleted. Manual
 *                          recovery by the Owner: decide whether to delete
 *                          that single User row (its auth credentials live
 *                          in the cascading "Account" rows) or hand it over
 *                          via the normal account-recovery flow, THEN re-run
 *                          provisioning. The row is reported by email; no
 *                          password exists to recover, so silent handover is
 *                          impossible by design.
 *
 * Usage (local dev or the production seed profile):
 *
 *   PROVISION_OWNER_NAME="Example Owner" PROVISION_OWNER_EMAIL="owner@example.com" \
 *   PROVISION_OWNER_PHONE="<phone>" \
 *   PROVISION_PARTNER_NAME="Example Partner" PROVISION_PARTNER_EMAIL="partner@example.com" \
 *   PROVISION_PARTNER_PHONE="<phone>" \
 *   pnpm exec tsx scripts/seed-neolife-users.ts
 *   pnpm exec tsx scripts/seed-neolife-users.ts --dry-run
 *
 * SECURITY: delete the credentials file as soon as the temporary passwords
 * have been handed over securely — they are single-use (forced password
 * change on first login).
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  createPasswordVault,
  preflightProvisioning,
  provisionCrmUsers,
  rollbackProvisionedAccounts,
  verifyProvisionedCredential,
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

const OWNER_MISMATCH_ACK_ENV = "PROVISION_ACKNOWLEDGE_OWNER_MISMATCH";

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

function printPreflight(report: Awaited<ReturnType<typeof preflightProvisioning>>) {
  console.log("");
  console.log("Preflight (read-only — nothing was changed):");
  for (const intent of report.intents) {
    const action =
      intent.action === "would_create"
        ? "WOULD CREATE"
        : "PRESERVED";
    const extras = [
      intent.action === "preserved" ? `existing role: ${intent.existingRole}` : null,
      intent.action === "preserved" && intent.isActive === false ? "account deactivated (stays deactivated)" : null,
      intent.roleMismatch ? "ROLE MISMATCH — reported, never rewritten" : null,
    ]
      .filter(Boolean)
      .join("; ");
    console.log(`  ${action}  ${intent.email} (intended role: ${intent.kind === "owner" ? "admin" : "staff"}${extras ? `; ${extras}` : ""})`);
  }
  console.log(
    `  Active CRM users in database: ${report.activeCrmUsers.length}` +
      (report.activeCrmUsers.length > 0
        ? ` — ${report.activeCrmUsers.map((u) => `${u.email} (${u.role})`).join(", ")}`
        : ""),
  );
  if (report.additionalActiveUsers.length > 0) {
    console.log(
      `  NOTE: ${report.additionalActiveUsers.length} additional active CRM user(s) beyond the intended addresses — ` +
        report.additionalActiveUsers.map((u) => `${u.email} (${u.role})`).join(", "),
    );
  }
  if (report.ownerIdentityMismatch) {
    console.log(
      `  ⚠ OWNER IDENTITY MISMATCH: intended Owner login is a NEW account, but ` +
        `existing active Owner account(s) hold ${report.existingOwnerEmails.join(", ")}. ` +
        `The existing Owner is never renamed, replaced, disabled or deleted — ` +
        `a separate Owner decision is required before provisioning.`,
    );
  }
}

/**
 * Secure credentials file (mode 0600, OS temp dir) for NEWLY CREATED
 * accounts. Passwords are looked up by the account email they were actually
 * delivered to — never by intent position (Task #038 Fix 1).
 */
function writeCredentialsFile(
  entries: ProvisioningReportEntry[],
  delivered: (email: string) => string | undefined,
): string {
  const credentials: Array<Record<string, unknown>> = [];
  for (const [index, entry] of entries.entries()) {
    if (entry.outcome.status !== "created") continue;
    const password = delivered(entry.outcome.email);
    if (!password) {
      throw new Error(
        `No delivered temporary password is bound to ${entry.outcome.email} — ` +
          "aborting BEFORE writing any credentials file. Nothing was handed over.",
      );
    }
    credentials.push({
      name: entry.intent.name,
      email: entry.outcome.email,
      role: entry.outcome.role,
      phone: entry.intent.phone ?? null,
      temporaryPassword: password,
      mustChangePassword: true,
    });
    void index;
  }
  if (credentials.length === 0) {
    return "";
  }

  const dir = path.join(os.tmpdir(), "neolife-provisioning");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = Math.random().toString(36).slice(2, 10);
  const file = path.join(dir, `credentials-${stamp}-${nonce}.json`);
  fs.writeFileSync(file, JSON.stringify(credentials, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
  return file;
}

/** Reports a rollback explicitly; never claims a silently preserved account. */
function reportRollback(
  outcomes: Awaited<ReturnType<typeof rollbackProvisionedAccounts>>,
) {
  for (const outcome of outcomes) {
    if (outcome.status === "deleted") {
      console.log(
        `  ROLLED BACK ${outcome.email} — brand-new account removed; re-run ` +
          "the script after fixing the delivery problem (idempotent).",
      );
    } else if (outcome.status === "skipped_has_crm_data") {
      console.log(
        `  MANUAL RECOVERY REQUIRED ${outcome.email} — the account already has ` +
          `${outcome.leads} CRM lead reference(s), so nothing was auto-deleted. ` +
          "The Owner must decide its fate (delete that single User row — its " +
          "Auth credentials cascade — or hand it over via account recovery), " +
          "then re-run provisioning. It has NO deliverable temporary password.",
      );
    } else if (outcome.status === "not_found") {
      console.log(`  (no account found for ${outcome.email} — nothing to roll back)`);
    } else {
      console.log(
        `  ROLLBACK FAILED ${outcome.email}: ${outcome.error}. The account ` +
          "exists WITHOUT a deliverable password — resolve manually, do not " +
          "treat this run as preserved.",
      );
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
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

  // ── FIX 3: read-only preflight, always before any mutation ──
  const report = await preflightProvisioning(intents);
  printPreflight(report);

  if (dryRun) {
    process.exitCode = report.blocking ? 2 : 0;
    console.log(
      report.blocking
        ? "\nDry-run result: STOP — Owner decision required (exit 2). No changes were made."
        : "\nDry-run result: clean (exit 0). No changes were made.",
    );
    return;
  }

  if (report.blocking) {
    if (process.env[OWNER_MISMATCH_ACK_ENV] !== "1") {
      console.error(
        "\nSTOP: owner identity mismatch. Provisioning aborted — NO accounts " +
          "were created or changed. Decide the Owner identity first; if this " +
          `run is truly intended, set ${OWNER_MISMATCH_ACK_ENV}=1 explicitly.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      "\nOwner identity mismatch was EXPLICITLY acknowledged " +
        `(${OWNER_MISMATCH_ACK_ENV}=1) — continuing under the recorded decision.`,
    );
  }

  // ── FIX 1: password delivery bound per account email ──
  const vault = createPasswordVault();
  const entries = await provisionCrmUsers(intents, (intent) => vault.get(intent));

  const created = entries
    .filter(
      (entry): entry is ProvisioningReportEntry & { outcome: { status: "created"; email: string } } =>
        entry.outcome.status === "created",
    )
    .map((entry) => entry.outcome.email);

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

  if (created.length === 0) {
    console.log("");
    console.log(
      "No new accounts were created — existing credentials are unchanged.",
    );
    return;
  }

  // ── FIX 1 req 6: verify EVERY password authenticates its account BEFORE
  // the credentials file is delivered. Failures roll back the unverifiable
  // brand-new accounts instead of delivering unusable passwords.
  const verificationFailures: string[] = [];
  for (const email of created) {
    const password = vault.passwordFor(email);
    if (!password) {
      verificationFailures.push(email); // no bound password — cannot deliver
      continue;
    }
    const verified = await verifyProvisionedCredential(email, password);
    if (!verified) {
      verificationFailures.push(email);
    } else {
      console.log(`  VERIFIED sign-in for ${email}`);
    }
  }

  console.log("");
  if (verificationFailures.length > 0) {
    console.error(
      "ERROR: temporary password(s) could not be verified for: " +
        verificationFailures.join(", "),
    );
    console.error(
      "Rolling back the affected brand-new accounts (no credentials were " +
        "delivered for them):",
    );
    reportRollback(await rollbackProvisionedAccounts(created));
    process.exitCode = 1;
    return;
  }

  // Credential-file delivery, with guarded recovery on failure.
  let file = "";
  try {
    file = writeCredentialsFile(entries, (email) => vault.passwordFor(email));
  } catch (error) {
    console.error(
      "ERROR: could not write the secure credentials file " +
        `(${error instanceof Error ? error.message : error}). ` +
        "No passwords were handed over. Rolling back the brand-new accounts:",
    );
    reportRollback(await rollbackProvisionedAccounts(created));
    process.exitCode = 1;
    return;
  }

  if (file) {
    console.log(`Temporary passwords (new accounts only): ${file}`);
    console.log(
      "  The file is mode 0600 in the system temp dir. Read it once, hand " +
        "the passwords to the new users securely, then DELETE the file. " +
        "Passwords are forced to change on first sign-in.",
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
