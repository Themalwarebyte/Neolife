-- Batch E corrective migration: transfer history must survive contact lifecycle decisions.
-- A contact with any transfer record cannot be permanently deleted. Administrators
-- should archive or reassign the contact instead; the transfer row remains auditable.
ALTER TABLE "ContactTransfer"
  DROP CONSTRAINT IF EXISTS "ContactTransfer_contactId_fkey";

ALTER TABLE "ContactTransfer"
  ADD CONSTRAINT "ContactTransfer_contactId_fkey"
  FOREIGN KEY ("contactId")
  REFERENCES "Contact"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
