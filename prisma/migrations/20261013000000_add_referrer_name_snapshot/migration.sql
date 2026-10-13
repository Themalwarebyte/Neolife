-- Task #027, Fix 5 — creation-time public referrer snapshot.
--
-- Lead.referredByUserId is FK ON DELETE SET NULL, so DELETING a Staff account
-- nulls the user reference. To keep historical referral attribution meaningful
-- in every continuity scenario (code rotation, link revocation, deactivation,
-- deletion), each lead now also snapshots the APPROVED public referrer name
-- at capture time. referredByName keeps its original meaning (the visitor's
-- self-reported spelling for manual_name attribution); referredBySnapshot is
-- the resolved, approved name for both "link" and "manual_name" methods.
--
-- Purely additive: one nullable TEXT column, no data rewrite, no destructive
-- SQL. Existing lead attribution is never rewritten. Column is written once
-- at creation (system-set only) and never updated afterwards.
--
-- No index: the snapshot is display-only audit data with no query path.

ALTER TABLE "Lead" ADD COLUMN "referredBySnapshot" TEXT;
