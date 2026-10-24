-- Batch E: durable contact transfers, shared pool, rejected-import correction history,
-- and password-verified export PINs. Existing contacts and CRM Leads are not rewritten.
ALTER TYPE "ContactState" ADD VALUE 'CONTACT_POOL';
ALTER TYPE "ContactState" ADD VALUE 'TRANSFER_PENDING';
ALTER TYPE "ContactImportRowStatus" ADD VALUE 'REJECTED';
CREATE TYPE "ContactTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TABLE "ContactImportRow"
  ADD COLUMN "correctedValues" JSONB,
  ADD COLUMN "correctionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastCorrectedAt" TIMESTAMP(3),
  ADD COLUMN "lastCorrectedBySnapshot" TEXT;

CREATE TABLE "ContactImportRowCorrection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rowId" UUID NOT NULL,
  "actorUserId" TEXT,
  "actorSnapshot" TEXT NOT NULL,
  "submittedValues" JSONB NOT NULL,
  "validationPassed" BOOLEAN NOT NULL,
  "validationError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactImportRowCorrection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactImportRowCorrection_rowId_createdAt_idx" ON "ContactImportRowCorrection"("rowId", "createdAt");
CREATE INDEX "ContactImportRowCorrection_actorUserId_createdAt_idx" ON "ContactImportRowCorrection"("actorUserId", "createdAt");
ALTER TABLE "ContactImportRowCorrection" ADD CONSTRAINT "ContactImportRowCorrection_rowId_fkey"
  FOREIGN KEY ("rowId") REFERENCES "ContactImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactImportRowCorrection" ADD CONSTRAINT "ContactImportRowCorrection_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContactTransfer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contactId" UUID NOT NULL,
  "sourceOwnerUserId" TEXT,
  "sourceOwnerSnapshot" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "recipientSnapshot" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "requestedBySnapshot" TEXT NOT NULL,
  "decidedByUserId" TEXT,
  "decidedBySnapshot" TEXT,
  "sourceState" "ContactState" NOT NULL,
  "expectedContactVersion" INTEGER NOT NULL,
  "status" "ContactTransferStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "decisionReason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactTransfer_recipientUserId_status_createdAt_idx" ON "ContactTransfer"("recipientUserId", "status", "createdAt");
CREATE INDEX "ContactTransfer_status_createdAt_idx" ON "ContactTransfer"("status", "createdAt");
CREATE INDEX "ContactTransfer_contactId_createdAt_idx" ON "ContactTransfer"("contactId", "createdAt");
CREATE INDEX "ContactTransfer_requestedByUserId_createdAt_idx" ON "ContactTransfer"("requestedByUserId", "createdAt");
CREATE UNIQUE INDEX "ContactTransfer_one_pending_per_contact_idx" ON "ContactTransfer"("contactId") WHERE "status" = 'PENDING';
ALTER TABLE "ContactTransfer" ADD CONSTRAINT "ContactTransfer_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTransfer" ADD CONSTRAINT "ContactTransfer_sourceOwnerUserId_fkey"
  FOREIGN KEY ("sourceOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactTransfer" ADD CONSTRAINT "ContactTransfer_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactTransfer" ADD CONSTRAINT "ContactTransfer_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactTransfer" ADD CONSTRAINT "ContactTransfer_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContactExportCredential" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactExportCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactExportCredential_userId_key" ON "ContactExportCredential"("userId");
ALTER TABLE "ContactExportCredential" ADD CONSTRAINT "ContactExportCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ContactExportSecurityEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT,
  "actorSnapshot" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactExportSecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactExportSecurityEvent_userId_createdAt_idx" ON "ContactExportSecurityEvent"("userId", "createdAt");
CREATE INDEX "ContactExportSecurityEvent_createdAt_idx" ON "ContactExportSecurityEvent"("createdAt");
ALTER TABLE "ContactExportSecurityEvent" ADD CONSTRAINT "ContactExportSecurityEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
