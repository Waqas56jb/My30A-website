-- image10.png/image11.png carry their own baked-in marketing text ("Eat" / "Move"), which showed
-- through as ghost text behind the tile's own label — swap those two tiles to plain photos.
UPDATE explore_categories SET image_url = '/image7.png' WHERE key = 'restaurants';
UPDATE explore_categories SET image_url = '/image6.png' WHERE key = 'golf-outdoor';
UPDATE explore_categories SET image_url = '/image2.png' WHERE key = 'weddings-photography';
UPDATE explore_categories SET image_url = '/image12.png' WHERE key = 'arts-culture';
UPDATE explore_categories SET image_url = '/image7.png' WHERE key = 'local-essentials';
UPDATE explore_categories SET image_url = '/homecover.png' WHERE key = 'info';
