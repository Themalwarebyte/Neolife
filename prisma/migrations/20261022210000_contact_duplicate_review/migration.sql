-- Batch C: append-only merge lineage and human-reviewed duplicate issues.
-- Existing contacts and leads are not backfilled or moved.
ALTER TYPE "ContactState" ADD VALUE 'MERGED';
CREATE TYPE "ContactDuplicateStatus" AS ENUM ('OPEN', 'DISMISSED', 'MERGED', 'CLOSED');

ALTER TABLE "Contact"
  ADD COLUMN "mergedIntoContactId" UUID,
  ADD COLUMN "mergedAt" TIMESTAMP(3);

CREATE TABLE "ContactDuplicateIssue" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerUserId" TEXT,
  "ownerSnapshot" TEXT NOT NULL,
  "leftContactId" UUID NOT NULL,
  "rightContactId" UUID NOT NULL,
  "leftVersion" INTEGER NOT NULL,
  "rightVersion" INTEGER NOT NULL,
  "signals" JSONB NOT NULL,
  "status" "ContactDuplicateStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedByUserId" TEXT,
  "reviewedBySnapshot" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "retainedContactId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactDuplicateIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactDuplicateIssue_distinct_check" CHECK ("leftContactId" < "rightContactId")
);

CREATE UNIQUE INDEX "ContactDuplicateIssue_leftContactId_rightContactId_key"
  ON "ContactDuplicateIssue"("leftContactId", "rightContactId");
CREATE INDEX "ContactDuplicateIssue_ownerUserId_status_createdAt_idx"
  ON "ContactDuplicateIssue"("ownerUserId", "status", "createdAt");
CREATE INDEX "ContactDuplicateIssue_status_createdAt_idx"
  ON "ContactDuplicateIssue"("status", "createdAt");
CREATE INDEX "Contact_mergedIntoContactId_idx" ON "Contact"("mergedIntoContactId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_mergedIntoContactId_fkey"
  FOREIGN KEY ("mergedIntoContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactDuplicateIssue" ADD CONSTRAINT "ContactDuplicateIssue_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactDuplicateIssue" ADD CONSTRAINT "ContactDuplicateIssue_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactDuplicateIssue" ADD CONSTRAINT "ContactDuplicateIssue_leftContactId_fkey"
  FOREIGN KEY ("leftContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactDuplicateIssue" ADD CONSTRAINT "ContactDuplicateIssue_rightContactId_fkey"
  FOREIGN KEY ("rightContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
