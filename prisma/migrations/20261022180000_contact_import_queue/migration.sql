-- Batch B contact upload preview, import queue and detailed import history.
-- Additive migration: existing Lead and Contact records remain unchanged.
CREATE TYPE "ContactImportStatus" AS ENUM ('PREVIEW', 'COMPLETE');
CREATE TYPE "ContactImportRowStatus" AS ENUM ('PENDING', 'IMPORTED', 'INVALID');

CREATE TABLE "ContactImportBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerUserId" TEXT,
  "ownerSnapshot" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSha256" TEXT NOT NULL,
  "status" "ContactImportStatus" NOT NULL DEFAULT 'PREVIEW',
  "headers" JSONB NOT NULL,
  "mapping" JSONB,
  "totalRows" INTEGER NOT NULL,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ContactImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactImportRow" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "values" JSONB NOT NULL,
  "status" "ContactImportRowStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "contactId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactImportRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Contact" ADD COLUMN "importBatchId" UUID,
  ADD COLUMN "importRowNumber" INTEGER;

CREATE UNIQUE INDEX "ContactImportBatch_ownerUserId_fileSha256_key" ON "ContactImportBatch"("ownerUserId", "fileSha256");
CREATE INDEX "ContactImportBatch_ownerUserId_createdAt_idx" ON "ContactImportBatch"("ownerUserId", "createdAt");
CREATE UNIQUE INDEX "ContactImportRow_batchId_rowNumber_key" ON "ContactImportRow"("batchId", "rowNumber");
CREATE UNIQUE INDEX "ContactImportRow_contactId_key" ON "ContactImportRow"("contactId");
CREATE INDEX "ContactImportRow_batchId_status_idx" ON "ContactImportRow"("batchId", "status");
CREATE INDEX "Contact_importBatchId_importRowNumber_idx" ON "Contact"("importBatchId", "importRowNumber");
CREATE UNIQUE INDEX "Contact_importBatchId_importRowNumber_key" ON "Contact"("importBatchId", "importRowNumber");

ALTER TABLE "ContactImportBatch" ADD CONSTRAINT "ContactImportBatch_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "ContactImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "ContactImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
