-- Events: local happenings along 30A pulled from 30a.com/events (organizer-submitted listings run
-- by The 30A Company — a volume source, not a guaranteed-accurate one; the app says so). Synced by
-- server/src/services/events.js (daily cron + scripts/sync-events.js). One row per occurrence.
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT '30a.com',
  source_url text UNIQUE NOT NULL,        -- the occurrence's page on 30a.com
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  venue_name text,
  venue_url text,
  address text,
  town text,
  community text,
  lat double precision,
  lng double precision,
  description text,
  image_url text,
  category text,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | cancelled | postponed
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON events (category);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- "Events" tile on Explore, right after the dining tiles.
INSERT INTO explore_categories (key, label, tone, icon, image_url, target, coming_soon, sort_order) VALUES
  ('events', 'Events & Live Music', 'peach', 'CalendarDays', '/marketing/stay-sunset-paddle.webp', 'events', false, 4)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, target = EXCLUDED.target, icon = EXCLUDED.icon, coming_soon = false;
UPDATE explore_categories SET sort_order = sort_order + 1 WHERE key NOT IN ('restaurants', 'bars', 'coffee', 'events') AND sort_order >= 4 AND sort_order < 30;
