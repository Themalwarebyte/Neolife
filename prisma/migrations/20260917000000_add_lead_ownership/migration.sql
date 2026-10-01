-- Phase A: Add contact ownership (assignedUserId) to Lead
--
-- Backward compatible: existing leads get NULL (Owner's pool).
-- The column is nullable with ON DELETE SET NULL so deleting a user
-- does not delete their leads.
--
-- NOTE: assignedUserId is TEXT (not UUID) to match Better Auth's User.id
-- column, which is a TEXT/UUID string. The foreign key requires matching types.

-- Add the assigned-user column
ALTER TABLE "Lead" ADD COLUMN "assignedUserId" TEXT;

-- Backfill: existing leads remain unassigned (NULL = Owner's pool). No data migration needed.

-- Foreign key to Better Auth User.id (TEXT type)
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Indexes for ownership-scoped queries
CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");
CREATE INDEX "Lead_assignedUserId_status_idx" ON "Lead"("assignedUserId", "status");
