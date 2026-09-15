-- Redesign of the Explore 30A category tiles. The old 8 tiles matched against a crude 6-key
-- `filters` tag array on explore_guides — 3 of the 8 tiles (Activities, Wellness, Local
-- Essentials) weren't in that 6-key list at all, so tapping them showed every guide unfiltered.
-- This ties each of the 20 real guide categories (the client's own partner list, 161 vendors) to
-- exactly one top-level tile via category_key, gives each tile a real photo, and marks the one
-- tile with no real backing data (Restaurants) as "coming soon" instead of showing fake listings.
ALTER TABLE explore_categories ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE explore_categories ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false;
ALTER TABLE explore_guides ADD COLUMN IF NOT EXISTS category_key text REFERENCES explore_categories (key) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_explore_guides_category_key ON explore_guides (category_key);

-- The 5 leftover restaurant/beach placeholder guides from the original Figma mockup were never
-- real client data (no restaurant partners were ever provided; real beach data lives in
-- public_places instead) — retire them so nothing fake is reachable.
UPDATE explore_guides SET is_active = false
WHERE slug IN ('pescado', 'dinner-rosemary', 'rosemary', 'inlet-beach', 'sunset-tonight', 'sunset-walk');

-- Replace the 8 tiles with a corrected, real-data-backed set of 11.
DELETE FROM explore_categories;
INSERT INTO explore_categories (key, label, tone, icon, image_url, target, coming_soon, sort_order) VALUES
  ('restaurants',          'Restaurants',             'sand',   'UtensilsCrossed', '/image10.png',   'guide?c=restaurants',         true,  1),
  ('beaches',              'Beaches',                 'sea',    'Umbrella',        '/image1.png',    'info?focus=beach-access',     false, 2),
  ('on-the-water',         'On The Water',            'cyan',   'Waves',           '/image3.png',    'guide?c=on-the-water',        false, 3),
  ('golf-outdoor',         'Golf & Outdoor Rentals',  'leaf',   'Bike',            '/image11.png',   'guide?c=golf-outdoor',        false, 4),
  ('family-kids',          'Family & Kids',           'pink',   'Users',           '/cover.png',     'guide?c=family-kids',         false, 5),
  ('wellness-spa',         'Wellness & Spa',          'olive',  'Leaf',            '/image5.png',    'guide?c=wellness-spa',        false, 6),
  ('weddings-photography', 'Weddings & Photography',  'peach',  'Camera',          '/image2.png',    'guide?c=weddings-photography', false, 7),
  ('shopping',             'Shopping',                'lime',   'ShoppingBag',     '/homecover.png', 'guide?c=shopping',            false, 8),
  ('arts-culture',         'Arts & Culture',          'violet', 'Palette',         '/image12.png',   'guide?c=arts-culture',        false, 9),
  ('local-essentials',     'Local Essentials',        'slate',  'Briefcase',       '/image7.png',    'guide?c=local-essentials',    false, 10),
  ('info',                 'Public Information',      'teal',   'Info',            '/image6.png',    'info',                        false, 11);

-- Map every real guide (the client's 20 categories) to exactly one tile above.
UPDATE explore_guides SET category_key = 'on-the-water' WHERE slug = 'on-the-water';
UPDATE explore_guides SET category_key = 'golf-outdoor' WHERE slug IN ('golf-courses', 'golf-cart-rentals', 'bike-rentals', 'pickleball');
UPDATE explore_guides SET category_key = 'family-kids' WHERE slug IN ('family', 'kids-camps', 'babysitting', 'baby-kids-equipment');
UPDATE explore_guides SET category_key = 'wellness-spa' WHERE slug = 'wellness-spa';
UPDATE explore_guides SET category_key = 'weddings-photography' WHERE slug IN ('weddings-events', 'photography');
UPDATE explore_guides SET category_key = 'shopping' WHERE slug IN ('shopping', 'welcome-setup');
UPDATE explore_guides SET category_key = 'arts-culture' WHERE slug = 'arts-culture';
UPDATE explore_guides SET category_key = 'local-essentials' WHERE slug IN ('medical', 'pet-services', 'private-chef', 'real-estate', 'beach-bonfires');
