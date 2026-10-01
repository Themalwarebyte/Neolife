BEGIN;

-- Admin User Management fields (Phase P-2).
-- Allows: force password change on first login, deactivate/reactivate users.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

COMMIT;
