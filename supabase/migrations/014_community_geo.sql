-- Real-world center point + radius per community, used to validate that a guest's typed address
-- actually falls inside the community they selected (so the correct fixed transfer_pricing row
-- applies). Populated by server/scripts/geocode-communities.js — not hand-typed, so it stays
-- self-consistent with whatever geocoder validates guest addresses at request time.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS radius_miles numeric(5, 2);
ALTER TABLE communities ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;
