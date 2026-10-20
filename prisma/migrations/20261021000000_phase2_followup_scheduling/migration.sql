-- Phase 2: scheduled follow-up tasks. Purely additive; legacy notes remain notes.
-- No backfill, deletion, constraint rewrite, or existing row update.
ALTER TABLE "FollowUp" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "FollowUp" ADD COLUMN "completedAt" TIMESTAMP(3);
CREATE INDEX "FollowUp_dueAt_completedAt_idx" ON "FollowUp"("dueAt", "completedAt");
