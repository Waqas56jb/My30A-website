-- Restaurant reservations (free for the guest — My30A Host only deep-links to the restaurant's own
-- booking page). Each restaurant records which platform it really uses and its exact page, found
-- on the restaurant's own website by server/scripts/verify-reservations.js, plus when that was
-- last checked (platforms change — e.g. Mimmo's moved from OpenTable to Resy).
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS booking_platform text
  CHECK (booking_platform IN ('opentable', 'resy', 'sevenrooms', 'tock', 'website_widget', 'phone_only'));
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS last_verified_date date;
