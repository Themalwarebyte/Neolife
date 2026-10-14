/*
 * Task #037 — Two-user configuration: profile + notification preference.
 *
 * Purely ADDITIVE, nullable columns on the shared Better Auth User table:
 *   - "phone"             optional contact phone (E.164 or national form)
 *   - "notificationEmail" optional override for operational notification
 *                         recipients; NULL/blank = use the login email.
 *
 * No existing column or row is touched, no default changes, no backfill:
 * identity and credential continuity of every existing account (including
 * the provisioned Owner) is preserved exactly.
 */
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "notificationEmail" TEXT;
