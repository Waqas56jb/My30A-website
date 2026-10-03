-- Shared vehicles: one car, more than one partner owner (e.g. a car two partners own together).
-- owner_id stays the main owner (receives the owner fee when someone else drives); co_owner_ids
-- are the other owners. When any owner drives, that driver is treated as the owner for the trip.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS co_owner_ids uuid[] NOT NULL DEFAULT '{}';
