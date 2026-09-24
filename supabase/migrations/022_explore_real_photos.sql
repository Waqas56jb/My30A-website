-- Explore now uses each business's OWN photo (fetched from its official website by
-- server/scripts/fetch-vendor-photos.js into client/public/vendors/). This migration:
--  1. gives every guide and every category tile a distinct real partner photo instead of the
--     same handful of repeated stock images (image1/2/6/7/12, cover, homecover);
--  2. clears the repeated stock image from partners that have no usable photo of their own — the
--     app renders a designed, category-themed card for them instead of a mismatched picture;
--  3. rejects three scraped images that weren't real photos (a logo, a website screenshot, and a
--     gambling ad served by a hijacked domain), and clears that hijacked website link.

-- 1a. Guide covers — the strongest real photo among each guide's own partners.
UPDATE explore_guides SET image_url = '/vendors/30a-yacht-charters.webp' WHERE slug = 'on-the-water';
UPDATE explore_guides SET image_url = '/vendors/bombora-sun-surf.webp' WHERE slug = 'shopping';
UPDATE explore_guides SET image_url = '/vendors/30a-bike-rentals.webp' WHERE slug = 'bike-rentals';
UPDATE explore_guides SET image_url = '/vendors/origins-golf-course-watersound.webp' WHERE slug = 'golf-courses';
UPDATE explore_guides SET image_url = '/vendors/amanda-eubank-photography.webp' WHERE slug = 'photography';
UPDATE explore_guides SET image_url = '/vendors/peach-pearl-events.webp' WHERE slug = 'weddings-events';
UPDATE explore_guides SET image_url = '/vendors/spa-pearl.webp' WHERE slug = 'wellness-spa';
UPDATE explore_guides SET image_url = '/vendors/clay-garden-gifts.webp' WHERE slug = 'welcome-setup';
UPDATE explore_guides SET image_url = '/vendors/happy-tails-pet-care-services.webp' WHERE slug = 'pet-services';
UPDATE explore_guides SET image_url = '/vendors/30a-blaze-beach-bonfires.webp' WHERE slug = 'beach-bonfires';
UPDATE explore_guides SET image_url = '/vendors/angelfish-babysitting-services.webp' WHERE slug = 'babysitting';
UPDATE explore_guides SET image_url = '/vendors/sandcastle-rockstars.webp' WHERE slug = 'family';
UPDATE explore_guides SET image_url = '/vendors/emerald-coast-theatre-company.webp' WHERE slug = 'arts-culture';
UPDATE explore_guides SET image_url = '/vendors/doc-smiley-s-urgent-care.webp' WHERE slug = 'medical';
UPDATE explore_guides SET image_url = '/vendors/joy-ride-30a-golf-carts.webp' WHERE slug = 'golf-cart-rentals';
UPDATE explore_guides SET image_url = '/vendors/30a-vacation-chef.webp' WHERE slug = 'private-chef';
-- Guides whose partners have no photo of their own borrow the closest real local one.
UPDATE explore_guides SET image_url = '/vendors/tops-l-beach-racquet-resort.webp' WHERE slug = 'pickleball';
UPDATE explore_guides SET image_url = '/vendors/gigi-s-fabulous-kids-fashions-and-toys.webp' WHERE slug = 'kids-camps';
UPDATE explore_guides SET image_url = '/vendors/coast-kids-at-the-big-chill.webp' WHERE slug = 'baby-kids-equipment';
UPDATE explore_guides SET image_url = '/vendors/tracery-interiors.webp' WHERE slug = 'real-estate';

-- 1b. Category tiles — a different real photo from the guide covers above.
UPDATE explore_categories SET image_url = '/vendors/30a-beach-boyz.webp' WHERE key = 'beaches';
UPDATE explore_categories SET image_url = '/vendors/crab-island-luxury-adventures.webp' WHERE key = 'on-the-water';
UPDATE explore_categories SET image_url = '/vendors/eventure-florida-30a.webp' WHERE key = 'golf-outdoor';
UPDATE explore_categories SET image_url = '/vendors/thrills-laser-tag-arcade.webp' WHERE key = 'family-kids';
UPDATE explore_categories SET image_url = '/vendors/sandestin-tennis-club.webp' WHERE key = 'wellness-spa';
UPDATE explore_categories SET image_url = '/vendors/destin-to-wed-event-planning.webp' WHERE key = 'weddings-photography';
UPDATE explore_categories SET image_url = '/vendors/willow-boutique.webp' WHERE key = 'shopping';
UPDATE explore_categories SET image_url = '/vendors/justin-gaffrey-gallery.webp' WHERE key = 'arts-culture';
UPDATE explore_categories SET image_url = '/vendors/marrow-private-chefs.webp' WHERE key = 'local-essentials';
UPDATE explore_categories SET image_url = '/vendors/shoreline-beach-services.webp' WHERE key = 'info';

-- 3. Rejected scrapes (files deleted from client/public/vendors) + the hijacked domain.
UPDATE explore_vendors SET image_url = NULL
WHERE slug IN ('jongle-beach-service', 'old-florida-outfitters', 'palms-30a');
UPDATE explore_vendors SET website_url = NULL
WHERE slug = 'jongle-beach-service' AND website_url ILIKE '%jonglebeach.com%';

-- 2. Partners without their own photo: no more shared stock picture.
UPDATE explore_vendors SET image_url = NULL
WHERE kind = 'vendor' AND image_url IS NOT NULL AND image_url NOT LIKE '/vendors/%';
