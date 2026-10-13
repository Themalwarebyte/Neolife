-- Task #029, Fix 4: durable outbound-email send reservations.
--
-- Send permission is reserved ATOMICALLY (short claim transaction serialized
-- by an advisory lock) BEFORE any provider call, eliminating the
-- count-then-send race. The row is the persisted attempt identity:
--
--   reserved → accepted | failed | unknown | simulated
--
-- Every status counts against both limits (90s per lead, 20 per sender per
-- rolling hour), so failures can never reopen the limit. A row left in
-- "reserved" (provider call crashed / finalization failed) also stays
-- conservative. leadId has NO foreign key: attempts must survive lead
-- deletion and expire naturally out of the rate windows.
--
-- Additive only: one new table + two indexes. No destructive SQL.

CREATE TABLE "EmailSendReservation" (
    "id"         TEXT NOT NULL,
    "leadId"     TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"     TEXT NOT NULL DEFAULT 'reserved',

    CONSTRAINT "EmailSendReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailSendReservation_leadId_reservedAt_idx"
  ON "EmailSendReservation"("leadId", "reservedAt");

CREATE INDEX "EmailSendReservation_userId_reservedAt_idx"
  ON "EmailSendReservation"("userId", "reservedAt");
