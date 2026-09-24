-- Dining guide: the client's list of 246 real restaurants, bars and coffee & breakfast spots
-- (imported by server/scripts/import-restaurants.js as explore_vendors rows with kind='restaurant').
-- Guests browse them by type (Restaurants / Bars & Nightlife / Coffee & Breakfast), by community
-- and by cuisine — replacing the "coming soon" Restaurants tile.
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS venue_type text CHECK (venue_type IN ('restaurant', 'bar', 'coffee'));
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS price_range text;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS opening_hours jsonb;
ALTER TABLE explore_vendors ADD COLUMN IF NOT EXISTS source_url text;
CREATE INDEX IF NOT EXISTS idx_explore_vendors_venue_type ON explore_vendors (venue_type) WHERE venue_type IS NOT NULL;

-- Three dining tiles lead the Explore grid; each opens the same Dining screen on its own tab.
UPDATE explore_categories
SET label = 'Restaurants', target = 'dining?type=restaurant', coming_soon = false, sort_order = 1
WHERE key = 'restaurants';

INSERT INTO explore_categories (key, label, tone, icon, image_url, target, coming_soon, sort_order) VALUES
  ('bars',   'Bars & Nightlife',   'violet', 'Wine',   NULL, 'dining?type=bar',    false, 2),
  ('coffee', 'Coffee & Breakfast', 'sand',   'Coffee', NULL, 'dining?type=coffee', false, 3)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, target = EXCLUDED.target, coming_soon = false;

UPDATE explore_categories SET sort_order = sort_order + 2
WHERE key NOT IN ('restaurants', 'bars', 'coffee') AND sort_order < 20;
