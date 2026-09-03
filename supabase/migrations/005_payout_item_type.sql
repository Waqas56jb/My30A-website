-- Distinguish driver vs owner vs shopper lines on the same transfer.

ALTER TABLE payout_items
  ADD COLUMN IF NOT EXISTS item_type text;

ALTER TABLE payout_items
  DROP CONSTRAINT IF EXISTS payout_items_item_type_check;

ALTER TABLE payout_items
  ADD CONSTRAINT payout_items_item_type_check
  CHECK (item_type IS NULL OR item_type IN ('driver', 'owner', 'shopper'));
