-- Phase C: Add canonical audit actor (userId) to LeadEvent.

-- D-028: LeadEvent.userId is the canonical actor field for all CRM audit events.
-- It is nullable so existing LeadEvent rows remain valid (backfilled as null).
-- ON DELETE SET NULL preserves events when a user is deleted.

ALTER TABLE "LeadEvent" ADD COLUMN "userId" TEXT;

ALTER TABLE "LeadEvent"
  ADD CONSTRAINT "LeadEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "LeadEvent_userId_idx" ON "LeadEvent"("userId");
