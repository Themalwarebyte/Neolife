CREATE TABLE "ActivityAuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorUserId" TEXT,
    "actorSnapshot" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entitySnapshot" TEXT,
    "outcome" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityAuditEvent_actorUserId_createdAt_idx" ON "ActivityAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "ActivityAuditEvent_action_createdAt_idx" ON "ActivityAuditEvent"("action", "createdAt");
CREATE INDEX "ActivityAuditEvent_entityType_entityId_idx" ON "ActivityAuditEvent"("entityType", "entityId");
CREATE INDEX "ActivityAuditEvent_outcome_createdAt_idx" ON "ActivityAuditEvent"("outcome", "createdAt");
CREATE INDEX "ActivityAuditEvent_createdAt_idx" ON "ActivityAuditEvent"("createdAt");

ALTER TABLE "ActivityAuditEvent" ADD CONSTRAINT "ActivityAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
