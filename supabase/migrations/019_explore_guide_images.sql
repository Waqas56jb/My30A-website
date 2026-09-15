-- 5 real guide categories inherited a broken image reference (image4.png / image9.png don't
-- exist as files at all) or a marketing graphic with its own baked-in text ("Eat" / "Move") or a
-- completely unrelated stock photo (a private jet for Pickleball) from the original seed. Vendor
-- rows inherit their guide's image at seed time, so both tables need the fix.
UPDATE explore_guides SET image_url = '/image6.png' WHERE slug = 'golf-cart-rentals';
UPDATE explore_guides SET image_url = '/image2.png' WHERE slug = 'private-chef';
UPDATE explore_guides SET image_url = '/image1.png' WHERE slug = 'pickleball';
UPDATE explore_guides SET image_url = '/image12.png' WHERE slug = 'arts-culture';
UPDATE explore_guides SET image_url = '/cover.png' WHERE slug = 'real-estate';

UPDATE explore_vendors SET image_url = '/image6.png' WHERE guide_slug = 'golf-cart-rentals';
UPDATE explore_vendors SET image_url = '/image2.png' WHERE guide_slug = 'private-chef';
UPDATE explore_vendors SET image_url = '/image1.png' WHERE guide_slug = 'pickleball';
UPDATE explore_vendors SET image_url = '/image12.png' WHERE guide_slug = 'arts-culture';
UPDATE explore_vendors SET image_url = '/cover.png' WHERE guide_slug = 'real-estate';
