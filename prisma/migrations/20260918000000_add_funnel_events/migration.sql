-- Phase D: First-party funnel/traffic measurement (D-029) + qualification tokens (D-030).
--
-- D-029: FunnelEvent table. Separate from LeadEvent (CRM audit trail).
-- Stores no PII — only deviceId (random UUID), leadId (UUID FK), and
-- validated first-party attribution. No IP addresses, no user-agent.
-- D-031: Do NOT store ipAddress or userAgent in FunnelEvent.

CREATE TABLE "FunnelEvent" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "leadId" UUID,
    "attribution" JSONB,
    "deviceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "FunnelEvent_type_idx" ON "FunnelEvent"("type");
CREATE INDEX "FunnelEvent_leadId_idx" ON "FunnelEvent"("leadId");
CREATE INDEX "FunnelEvent_createdAt_idx" ON "FunnelEvent"("createdAt");
CREATE INDEX "FunnelEvent_deviceId_idx" ON "FunnelEvent"("deviceId");
CREATE INDEX "FunnelEvent_deviceId_createdAt_idx" ON "FunnelEvent"("deviceId", "createdAt");

ALTER TABLE "FunnelEvent"
  ADD CONSTRAINT "FunnelEvent_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE SET NULL;

-- Phase D: Qualification continuation tokens (D-030).
-- Durable single-use tokens binding a public prospect to their lead.
-- Stored in DB for reliable replay protection across restarts and processes.

CREATE TABLE "QualificationToken" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "leadId" UUID NOT NULL,
    "nonce" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "consumedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "QualificationToken_leadId_idx" ON "QualificationToken"("leadId");
CREATE INDEX "QualificationToken_expiresAt_idx" ON "QualificationToken"("expiresAt");
CREATE INDEX "QualificationToken_consumedAt_idx" ON "QualificationToken"("consumedAt");

ALTER TABLE "QualificationToken"
  ADD CONSTRAINT "QualificationToken_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE CASCADE;
