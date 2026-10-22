-- Batch A: additive personal contact intake foundation.
-- Does not alter, backfill or create any Lead or CRM assignment record.
CREATE TYPE "ContactState" AS ENUM ('MAIN', 'IMPORTED_QUEUE', 'DUPLICATE_REVIEW', 'ARCHIVED');
CREATE TYPE "ContactOrigin" AS ENUM ('MANUAL', 'IMPORT');
CREATE TYPE "ContactConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'DENIED');
CREATE TYPE "ContactMethodType" AS ENUM ('PHONE', 'EMAIL');

CREATE TABLE "Contact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerUserId" TEXT,
    "ownerSnapshot" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "city" TEXT,
    "sourceDetail" TEXT,
    "notes" TEXT,
    "consentEvidence" TEXT,
    "consentUpdatedAt" TIMESTAMP(3),
    "doNotContactAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "origin" "ContactOrigin" NOT NULL DEFAULT 'MANUAL',
    "state" "ContactState" NOT NULL DEFAULT 'MAIN',
    "consentStatus" "ContactConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactMethod" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contactId" UUID NOT NULL,
    "type" "ContactMethodType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactAuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contactId" UUID NOT NULL,
    "actorUserId" TEXT,
    "actorSnapshot" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_ownerUserId_state_createdAt_idx" ON "Contact"("ownerUserId", "state", "createdAt");
CREATE INDEX "Contact_state_createdAt_idx" ON "Contact"("state", "createdAt");
CREATE UNIQUE INDEX "ContactMethod_contactId_type_normalizedValue_key" ON "ContactMethod"("contactId", "type", "normalizedValue");
CREATE INDEX "ContactMethod_type_normalizedValue_idx" ON "ContactMethod"("type", "normalizedValue");
CREATE INDEX "ContactMethod_contactId_type_idx" ON "ContactMethod"("contactId", "type");
CREATE INDEX "ContactAuditEvent_contactId_createdAt_idx" ON "ContactAuditEvent"("contactId", "createdAt");
CREATE INDEX "ContactAuditEvent_actorUserId_createdAt_idx" ON "ContactAuditEvent"("actorUserId", "createdAt");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactMethod" ADD CONSTRAINT "ContactMethod_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactAuditEvent" ADD CONSTRAINT "ContactAuditEvent_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactAuditEvent" ADD CONSTRAINT "ContactAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
