-- Real photos for the three dining tiles, taken from restaurants on the client's own list
-- (fetched by server/scripts/import-restaurants.js into client/public/restaurants/).
UPDATE explore_categories SET image_url = '/restaurants/bijoux.webp' WHERE key = 'restaurants';
UPDATE explore_categories SET image_url = '/restaurants/red-bar.webp' WHERE key = 'bars';
UPDATE explore_categories SET image_url = '/restaurants/kith-and-kin-coffee.webp' WHERE key = 'coffee';
