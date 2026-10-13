-- Referrals + notifications (D-034, FREEBUFF TASK #025 Phase 1/3)
--
-- Referral attribution on Lead is a once-only snapshot: never rewritten by
-- reassignment (D-027 stays in force). referredByUserId / referralCapturedAt
-- are TEXT/nullable. referralCode has NO foreign key by design: revoking or
-- deleting a ReferralCode row must never mutate historical attribution.
--
-- ReferralCode: one opaque, cryptographically random code per Staff user.
-- Notification: per-recipient in-app notifications, deduplicated by dedupKey.
--
-- Local development only until Kilo review + Owner approval to deploy.

-- ─── Lead: immutable referral attribution ────────────────────────────────
ALTER TABLE "Lead" ADD COLUMN "referredByUserId"   TEXT;
ALTER TABLE "Lead" ADD COLUMN "referralCode"       TEXT;
ALTER TABLE "Lead" ADD COLUMN "referralMethod"     TEXT;
ALTER TABLE "Lead" ADD COLUMN "referredByName"     TEXT;
ALTER TABLE "Lead" ADD COLUMN "referralCapturedAt" TIMESTAMP(3);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_referredByUserId_fkey"
  FOREIGN KEY ("referredByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lead_referredByUserId_idx" ON "Lead"("referredByUserId");
CREATE INDEX "Lead_referralCode_idx"     ON "Lead"("referralCode");

-- ─── ReferralCode ────────────────────────────────────────────────────────
CREATE TABLE "ReferralCode" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"     TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "publicName" TEXT NOT NULL,
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ReferralCode_userId_key"  ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key"    ON "ReferralCode"("code");
CREATE INDEX        "ReferralCode_userId_idx"  ON "ReferralCode"("userId");

-- ─── Notification ────────────────────────────────────────────────────────
CREATE TABLE "Notification" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"    TEXT NOT NULL,
    "leadId"    UUID,
    "type"      TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT,
    "dedupKey"  TEXT NOT NULL,
    "readAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Notification_dedupKey_key"          ON "Notification"("dedupKey");
CREATE INDEX        "Notification_userId_createdAt_idx"  ON "Notification"("userId", "createdAt");
CREATE INDEX        "Notification_userId_readAt_idx"     ON "Notification"("userId", "readAt");
CREATE INDEX        "Notification_leadId_idx"            ON "Notification"("leadId");
