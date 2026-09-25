-- A place can be more than one kind (Pescado is a dinner restaurant AND a rooftop bar): venue_types
-- lists every Dining tab it belongs to. venue_type stays its primary kind from the client's list.
-- Filled by server/scripts/classify-venues.js.
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS venue_types text[];
UPDATE explore_vendors SET venue_types = ARRAY[venue_type] WHERE venue_type IS NOT NULL AND venue_types IS NULL;
CREATE INDEX IF NOT EXISTS idx_explore_vendors_venue_types ON explore_vendors USING gin (venue_types);
