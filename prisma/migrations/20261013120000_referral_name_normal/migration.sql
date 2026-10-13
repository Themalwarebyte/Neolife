-- Task #029, Fix 2 (D-034): normalized public-name storage/lookup agreement.
--
-- Adds ReferralCode.publicNameNormal: the trimmed, internal-whitespace-
-- collapsed, LOWER-CASED public name. All writes (create/rotate) and all
-- manual-name resolution compare through this key, so "Jane  Doe", " jane
-- doe " and "JANE DOE" collapse to the same equality key. The column is
-- UNIQUE across all rows: PostgreSQL unique indexes allow multiple NULLs, so
-- (a) revoked rows (NULL) free the name for reuse and (b) at most ONE active
-- row per normalized name can exist — the Owner duplicate-name guard becomes
-- an atomic, race-safe database constraint instead of count-then-insert.
--
-- Backfill policy (fail-safe, never silently drops data):
--   1. Every ACTIVE row gets its normalized key.
--   2. Rows whose normalized key collides with ANOTHER active row are then
--      set back to NULL (publicName text is PRESERVED). Such legacy-collision
--      names become deliberately unresolvable via the manual fallback until
--      the Owner re-registers one of them — a lead is never silently assigned
--      to one of several ambiguous staff members.
--
-- Additive only: one nullable column + one unique index. No destructive SQL.

ALTER TABLE "ReferralCode" ADD COLUMN "publicNameNormal" TEXT;

-- Step 1: backfill the normalized key for all active rows.
UPDATE "ReferralCode" r
SET "publicNameNormal" = lower(regexp_replace(btrim(r."publicName"), '\s+', ' ', 'g'))
WHERE r."isActive" = true
  AND r."revokedAt" IS NULL;

-- Step 2: quarantine collisions — leave legacy colliding actives NULL.
UPDATE "ReferralCode" r
SET "publicNameNormal" = NULL
WHERE r."isActive" = true
  AND r."revokedAt" IS NULL
  AND r."publicNameNormal" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "ReferralCode" r2
    WHERE r2.id <> r.id
      AND r2."isActive" = true
      AND r2."revokedAt" IS NULL
      AND r2."publicNameNormal" = r."publicNameNormal"
  );

-- Step 3: race-safe uniqueness on the normalized key (NULLs exempt).
CREATE UNIQUE INDEX "ReferralCode_publicNameNormal_key"
  ON "ReferralCode"("publicNameNormal");
