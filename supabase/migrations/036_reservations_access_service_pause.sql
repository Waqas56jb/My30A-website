-- Client reservation update (Oct 2026):
--  • 'walk_in' = no reservations, first come first served (no Reserve button, phone if any).
--  • booking_note: a line under the reservation info ("Groups of more than 4: please call").
--  • access_note: private-club / hotel-guest venues ("Watersound Club members & Camp Creek Inn
--    guests only") — shown as a badge, never a normal Reserve button.
--  • menu_url: a menu link when the place has no website of its own.
ALTER TABLE explore_vendors DROP CONSTRAINT IF EXISTS explore_vendors_booking_platform_check;
ALTER TABLE explore_vendors ADD CONSTRAINT explore_vendors_booking_platform_check
  CHECK (booking_platform IN ('opentable', 'resy', 'sevenrooms', 'tock', 'website_widget', 'phone_only', 'walk_in'));
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS booking_note text;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS access_note text;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS menu_url text;

-- Service availability (Admin → Settings): pause Transfer and/or Grocery with a message and an
-- optional "back online" time. Guests see the message instead of the form; requests are refused.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS transfer_paused boolean NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS transfer_pause_message text NOT NULL DEFAULT 'Airport transfers are paused for the moment. We''ll be back soon — thank you for your patience.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS transfer_resume_at timestamptz;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_paused boolean NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_pause_message text NOT NULL DEFAULT 'Grocery delivery is paused for the moment. We''ll be back soon — thank you for your patience.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_resume_at timestamptz;
