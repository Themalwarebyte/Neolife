-- Batch D: explicit imported queue review and separate personal-contact follow-ups.
-- Preserve all existing contacts, import lineage, duplicates, and Lead workflows.
CREATE TYPE "ContactQueueReviewOutcome" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "ContactFollowUpKind" AS ENUM ('INTERNAL', 'CALL', 'EMAIL');
CREATE TYPE "ContactFollowUpStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Contact"
  ADD COLUMN "queueReviewOutcome" "ContactQueueReviewOutcome",
  ADD COLUMN "queueReviewedAt" TIMESTAMP(3),
  ADD COLUMN "queueReviewedByUserId" TEXT,
  ADD COLUMN "queueReviewedBySnapshot" TEXT,
  ADD COLUMN "queueReviewReason" TEXT;

CREATE INDEX "Contact_ownerUserId_queueReviewOutcome_queueReviewedAt_idx"
  ON "Contact"("ownerUserId", "queueReviewOutcome", "queueReviewedAt");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_queueReviewedByUserId_fkey"
  FOREIGN KEY ("queueReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContactFollowUp" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contactId" UUID NOT NULL,
  "kind" "ContactFollowUpKind" NOT NULL,
  "status" "ContactFollowUpStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT,
  "createdBySnapshot" TEXT NOT NULL,
  "resolvedByUserId" TEXT,
  "resolvedBySnapshot" TEXT,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactFollowUp_contactId_status_dueAt_idx"
  ON "ContactFollowUp"("contactId", "status", "dueAt");
CREATE INDEX "ContactFollowUp_status_dueAt_idx"
  ON "ContactFollowUp"("status", "dueAt");
ALTER TABLE "ContactFollowUp" ADD CONSTRAINT "ContactFollowUp_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactFollowUp" ADD CONSTRAINT "ContactFollowUp_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactFollowUp" ADD CONSTRAINT "ContactFollowUp_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContactExportAudit" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorUserId" TEXT,
  "actorSnapshot" TEXT NOT NULL,
  "scopeAll" BOOLEAN NOT NULL,
  "category" TEXT NOT NULL,
  "view" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactExportAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactExportAudit_actorUserId_createdAt_idx" ON "ContactExportAudit"("actorUserId", "createdAt");
CREATE INDEX "ContactExportAudit_createdAt_idx" ON "ContactExportAudit"("createdAt");
ALTER TABLE "ContactExportAudit" ADD CONSTRAINT "ContactExportAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
