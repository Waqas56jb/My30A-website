-- Guest app content seed: Explore 30A, Public Information, service catalog.
-- Idempotent: every insert is ON CONFLICT DO NOTHING so re-running never duplicates.

INSERT INTO explore_categories (key, label, tone, icon, target, sort_order) VALUES
  ('restaurants', 'Restaurants',        'sand',  'UtensilsCrossed', 'guide?c=restaurants', 1),
  ('beaches',     'Beaches',            'sea',   'Umbrella',        'guide?c=beaches',     2),
  ('activities',  'Activities',         'leaf',  'Mountain',        'guide?c=all',         3),
  ('wellness',    'Wellness',           'olive', 'Leaf',            'guide?c=all',         4),
  ('shopping',    'Shopping',           'pink',  'ShoppingBag',     'guide?c=shopping',    5),
  ('family',      'Family & Kids',      'cyan',  'Users',           'guide?c=family',      6),
  ('essentials',  'Local Essentials',   'lime',  'Paintbrush',      'guide?c=all',         7),
  ('info',        'Public Information', 'peach', 'Info',            'info',                8)
ON CONFLICT (key) DO NOTHING;

INSERT INTO explore_guides
  (slug, title, kind, detail_slug, image_url, price_from, vendor_count, place, filters, is_pick, sort_order)
VALUES
  ('golf-cart-rentals', 'Golf Cart Rentals',          'vendors',    NULL,      '/image11.png',  'From $120/day',     '3 vendors',      'Rosemary Beach', '{all,family}',         false, 1),
  ('on-the-water',      'On The Water',               'vendors',    NULL,      '/image3.png',   'From $400/day',     '3 vendors',      'Grayton Beach',  '{all,family}',         false, 2),
  ('photography',       'Photography',                'vendors',    NULL,      '/image12.png',  'From $120/day',     '3 vendors',      'Seaside',        '{all}',                false, 3),
  ('beach-bonfires',    'Beach Bonfire',              'vendors',    NULL,      '/image6.png',   'From $120/day',     '3 vendors',      'Rosemary Beach', '{all,beaches,family}', false, 4),
  ('bike-rentals',      'Bike Rentals',               'vendors',    NULL,      '/image1.png',   'From $35/day',      '3 vendors',      'Seagrove Beach', '{all,bikes}',          false, 5),
  ('wellness-spa',      'Wellness & Spa',             'vendors',    NULL,      '/image7.png',   'From $120/day',     '3 vendors',      'Alys Beach',     '{all}',                false, 6),
  ('pescado',           'Pescado Rooftop Bar',        'restaurant', 'pescado', '/image10.png',  'Seafood · Rooftop', 'Rosemary Beach', 'Rosemary Beach', '{restaurants}',        false, 7),
  ('dinner-rosemary',   'Dinner Near Rosemary Beach', 'restaurant', 'pescado', '/2.png',        'Coastal dining',    'Inlet Beach',    'Inlet Beach',    '{restaurants}',        true,  8),
  ('rosemary',          'Rosemary Beach Access',      'beach',      'rosemary','/image1.png',   'Public access',     'Rosemary Beach', 'Rosemary Beach', '{beaches}',            false, 9),
  ('inlet-beach',       'Inlet Beach',                'beach',      'inlet',   '/cover.png',    'Public access',     'Inlet Beach',    'Inlet Beach',    '{beaches}',            false, 10),
  ('shopping',          'Boutiques & Markets',        'vendors',    NULL,      '/image2.png',   'Open daily',        '6 shops',        'Seaside',        '{shopping}',           false, 11),
  ('family',            'Family Activities',          'vendors',    NULL,      '/homecover.png','From $25',          '4 vendors',      'WaterColor',     '{family}',             false, 12),
  ('sunset-tonight',    'Perfect Sunset Spot Tonight','beach',      'inlet',   '/1.png',        'Sunset',            'Inlet Beach',    'Inlet Beach',    '{beaches}',            true,  13),
  ('sunset-walk',       'Sunset Beach Walk',          'beach',      'rosemary','/3.png',        'Sunset',            'Inlet Beach',    'Inlet Beach',    '{beaches}',            true,  14)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO explore_vendors
  (guide_slug, slug, kind, name, place, community, rating, review_count, description, about, services,
   map_name, map_line1, map_line2, website_url, booking_url, image_url, price_from, sort_order)
VALUES
  -- Beach bonfires
  ('beach-bonfires', 'bonfire-co', 'vendor', '30A Bonfire Co.', 'Rosemary Beach, FL', 'Rosemary Beach', 5.0, 258,
   'Private Beach Bonfire Setups For Families And Groups.',
   'We handle everything - from setup to cleanup - so you can relax and enjoy quality time with the people who matter most. Perfect for families, couples, and groups celebrating life on 30A.',
   '{"Sunrise bonfire","chair setup","S’mores add-on","Family friendly"}',
   'Rosemary Beach', '30A, FL, 32461', 'Near the beach access on E. Kingston Rd.',
   'https://example.com/30a-bonfire-co', 'https://example.com/30a-bonfire-co/book', '/image6.png', 120, 1),
  ('beach-bonfires', 'emerald-fire', 'vendor', 'Emerald Coast Bonfires', 'Seaside, FL', 'Seaside', 4.9, 142,
   'Sunset Bonfires With Chairs, Blankets And S’mores Kits.',
   'Sunset bonfires on the sand with Adirondack chairs, cozy blankets and s’mores kits for everyone.',
   '{"Sunset bonfire","Blankets","S’mores kit","Music setup"}',
   'Seaside', '30A, FL, 32459', 'Central Square beach access.',
   'https://example.com/emerald-coast-bonfires', NULL, '/image12.png', 150, 2),
  ('beach-bonfires', 'seaside-fire', 'vendor', 'Seaside Fire & S’mores', 'Alys Beach, FL', 'Alys Beach', 5.0, 96,
   'Full-Service Bonfire Experiences Right On The Sand.',
   'Full-service bonfire experiences including permits, setup, attendant and cleanup.',
   '{"Permit included","Attendant","Cleanup","Group friendly"}',
   'Alys Beach', '30A, FL, 32461', 'West beach access.',
   'https://example.com/seaside-fire', NULL, '/image5.png', 120, 3),
  -- Golf carts
  ('golf-cart-rentals', 'coastal-carts', 'vendor', 'Coastal Carts 30A', 'Rosemary Beach, FL', 'Rosemary Beach', 4.9, 311,
   'Street-Legal Golf Carts Delivered To Your Door.',
   'Clean, street-legal 4 and 6 seater carts delivered and picked up at your rental.',
   '{"4-seater","6-seater","Delivery","Weekly rates"}',
   'Rosemary Beach', '30A, FL, 32461', 'Delivery across 30A.',
   'https://example.com/coastal-carts', NULL, '/image11.png', 120, 1),
  ('golf-cart-rentals', 'beach-buggy', 'vendor', 'Beach Buggy Rentals', 'Seagrove Beach, FL', 'Seagrove Beach', 4.8, 187,
   'Lifted Carts And Family Buggies For The Week.',
   'Lifted carts with coolers and bluetooth speakers. Multi-day discounts.',
   '{"Lifted carts","Coolers","Bluetooth","Multi-day discount"}',
   'Seagrove Beach', '30A, FL, 32459', 'Off Hwy 30A near Seagrove.',
   'https://example.com/beach-buggy', NULL, '/image11.png', 135, 2),
  ('golf-cart-rentals', 'emerald-carts', 'vendor', 'Emerald Cart Co.', 'Inlet Beach, FL', 'Inlet Beach', 4.7, 92,
   'Affordable Carts With Free Delivery.',
   'Budget-friendly carts with free delivery to Inlet Beach and Rosemary Beach rentals.',
   '{"Free delivery","Daily rates","Child seats"}',
   'Inlet Beach', '30A, FL, 32461', 'Inlet Beach Access.',
   'https://example.com/emerald-carts', NULL, '/image11.png', 120, 3),
  -- On the water
  ('on-the-water', 'grayton-pontoons', 'vendor', 'Grayton Pontoons', 'Grayton Beach, FL', 'Grayton Beach', 5.0, 204,
   'Pontoon Boat Rentals On Western Lake.',
   'Half and full day pontoon rentals on Western Lake with captains available.',
   '{"Half day","Full day","Captain available","Tubing"}',
   'Grayton Beach', '30A, FL, 32459', 'Western Lake boat launch.',
   'https://example.com/grayton-pontoons', NULL, '/image3.png', 400, 1),
  ('on-the-water', 'yolo-paddle', 'vendor', 'YOLO Paddle & Kayak', 'Seaside, FL', 'Seaside', 4.9, 156,
   'Paddleboards And Kayaks Delivered To The Beach.',
   'Paddleboards and kayaks delivered to your beach access with quick lessons.',
   '{"Paddleboards","Kayaks","Lessons","Delivery"}',
   'Seaside', '30A, FL, 32459', 'Seaside beach access.',
   'https://example.com/yolo-paddle', NULL, '/image3.png', 45, 2),
  ('on-the-water', 'gulf-charters', 'vendor', 'Gulf Sunset Charters', 'Inlet Beach, FL', 'Inlet Beach', 4.8, 77,
   'Private Sunset Cruises And Dolphin Tours.',
   'Private sunset cruises and dolphin tours departing from Panama City Beach marinas.',
   '{"Sunset cruise","Dolphin tour","Private charter"}',
   'Inlet Beach', '30A, FL, 32461', 'Departs Lake Powell.',
   'https://example.com/gulf-charters', NULL, '/image3.png', 450, 3),
  -- Photography
  ('photography', 'sandy-lens', 'vendor', 'Sandy Lens Photography', 'Seaside, FL', 'Seaside', 5.0, 189,
   'Family Beach Sessions At Golden Hour.',
   'Family and couples beach sessions at sunrise or golden hour with fast turnaround.',
   '{"Family session","Golden hour","Digital gallery"}',
   'Seaside', '30A, FL, 32459', 'Sessions across 30A.',
   'https://example.com/sandy-lens', NULL, '/image12.png', 120, 1),
  ('photography', 'thirty-a-portraits', 'vendor', '30A Portraits', 'Rosemary Beach, FL', 'Rosemary Beach', 4.9, 121,
   'Lifestyle And Vacation Portraits.',
   'Relaxed lifestyle portraits at Rosemary Beach and Alys Beach.',
   '{"Lifestyle","Couples","Prints"}',
   'Rosemary Beach', '30A, FL, 32461', 'Meets at Barrett Square.',
   'https://example.com/30a-portraits', NULL, '/image12.png', 150, 2),
  ('photography', 'dune-studio', 'vendor', 'Dune Studio', 'Grayton Beach, FL', 'Grayton Beach', 4.8, 64,
   'Drone And Beach Photography.',
   'Beach and drone photography for families and events.',
   '{"Drone","Events","Family"}',
   'Grayton Beach', '30A, FL, 32459', 'Grayton Beach State Park.',
   'https://example.com/dune-studio', NULL, '/image12.png', 120, 3),
  -- Bikes
  ('bike-rentals', 'butterfly-bikes', 'vendor', 'Butterfly Bike Rentals', 'Seagrove Beach, FL', 'Seagrove Beach', 4.9, 402,
   'Beach Cruisers Delivered To Your Rental.',
   'Beach cruisers, kids bikes and trailers delivered to your rental.',
   '{"Cruisers","Kids bikes","Trailers","Delivery"}',
   'Seagrove Beach', '30A, FL, 32459', 'Free delivery on 30A.',
   'https://example.com/butterfly-bikes', NULL, '/image1.png', 35, 1),
  ('bike-rentals', 'big-daddys', 'vendor', 'Big Daddy’s Bikes', 'Seaside, FL', 'Seaside', 4.8, 268,
   'Cruisers And E-Bikes By The Day Or Week.',
   'Cruisers and e-bikes with helmets and locks included.',
   '{"E-bikes","Cruisers","Helmets","Weekly"}',
   'Seaside', '30A, FL, 32459', 'Next to Seaside town center.',
   'https://example.com/big-daddys', NULL, '/image1.png', 40, 2),
  ('bike-rentals', 'rb-cycles', 'vendor', 'Rosemary Beach Cycles', 'Rosemary Beach, FL', 'Rosemary Beach', 4.7, 133,
   'Premium Bikes And Guided Rides.',
   'Premium bikes plus guided sunrise rides on the 30A trail.',
   '{"Premium bikes","Guided rides","Repairs"}',
   'Rosemary Beach', '30A, FL, 32461', 'Barrett Square.',
   'https://example.com/rb-cycles', NULL, '/image1.png', 45, 3),
  -- Wellness & spa
  ('wellness-spa', 'alys-spa', 'vendor', 'Alys Beach Spa', 'Alys Beach, FL', 'Alys Beach', 5.0, 210,
   'Massage And Facials In Your Rental.',
   'In-home massage and facials by licensed therapists.',
   '{"Massage","Facials","Couples"}',
   'Alys Beach', '30A, FL, 32461', 'In-home service.',
   'https://example.com/alys-spa', NULL, '/image7.png', 120, 1),
  ('wellness-spa', 'salt-yoga', 'vendor', 'Salt Yoga 30A', 'Seaside, FL', 'Seaside', 4.9, 95,
   'Sunrise Beach Yoga And Private Classes.',
   'Sunrise beach yoga and private family classes.',
   '{"Beach yoga","Private class","Mats included"}',
   'Seaside', '30A, FL, 32459', 'Seaside pavilion.',
   'https://example.com/salt-yoga', NULL, '/image7.png', 25, 2),
  ('wellness-spa', 'gulf-glow', 'vendor', 'Gulf Glow Wellness', 'WaterColor, FL', 'WaterColor', 4.8, 58,
   'IV Hydration And Recovery.',
   'Mobile IV hydration and recovery treatments.',
   '{"IV hydration","Recovery","Mobile"}',
   'WaterColor', '30A, FL, 32459', 'Mobile service.',
   'https://example.com/gulf-glow', NULL, '/image7.png', 150, 3),
  -- Shopping
  ('shopping', 'seaside-market', 'vendor', 'Seaside Farmers Market', 'Seaside, FL', 'Seaside', 4.9, 320,
   'Saturday Market With Local Makers.',
   'Saturday morning market with local produce, art and food.',
   '{"Produce","Art","Coffee"}',
   'Seaside', '30A, FL, 32459', 'Seaside amphitheater.',
   'https://example.com/seaside-market', NULL, '/image2.png', 0, 1),
  ('shopping', 'rb-boutiques', 'vendor', 'Rosemary Beach Boutiques', 'Rosemary Beach, FL', 'Rosemary Beach', 4.8, 144,
   'Coastal Fashion And Home Goods.',
   'A walkable collection of coastal boutiques around Barrett Square.',
   '{"Fashion","Home goods","Gifts"}',
   'Rosemary Beach', '30A, FL, 32461', 'Barrett Square.',
   'https://example.com/rb-boutiques', NULL, '/image2.png', 0, 2),
  ('shopping', 'alys-shops', 'vendor', 'The Shops at Alys', 'Alys Beach, FL', 'Alys Beach', 4.8, 88,
   'Curated Design And Apparel.',
   'Design-forward apparel and home shops in Alys Beach.',
   '{"Apparel","Design","Gifts"}',
   'Alys Beach', '30A, FL, 32461', 'Alys Beach town center.',
   'https://example.com/alys-shops', NULL, '/image2.png', 0, 3),
  -- Family
  ('family', 'gulf-place-kids', 'vendor', 'Gulf Place Kids Camp', 'Santa Rosa Beach, FL', 'Santa Rosa Beach', 4.9, 118,
   'Half-Day Beach Camps For Ages 5-12.',
   'Supervised half-day beach camps with games and crafts.',
   '{"Ages 5-12","Half day","Crafts"}',
   'Santa Rosa Beach', '30A, FL, 32459', 'Gulf Place.',
   'https://example.com/gulf-place-kids', NULL, '/homecover.png', 25, 1),
  ('family', 'seacrest-minigolf', 'vendor', 'Seacrest Mini Golf', 'Seacrest, FL', 'Seacrest', 4.7, 76,
   'Family Mini Golf And Ice Cream.',
   'Family mini golf with an ice cream shop next door.',
   '{"Mini golf","Ice cream","All ages"}',
   'Seacrest', '30A, FL, 32461', 'Seacrest Beach.',
   'https://example.com/seacrest-minigolf', NULL, '/homecover.png', 12, 2),
  ('family', 'watercolor-kayak-kids', 'vendor', 'WaterColor Kids Kayak', 'WaterColor, FL', 'WaterColor', 4.8, 54,
   'Guided Family Kayak Tours.',
   'Guided family kayak tours on Western Lake.',
   '{"Guided tour","Kids welcome","Life vests"}',
   'WaterColor', '30A, FL, 32459', 'WaterColor Boathouse.',
   'https://example.com/watercolor-kayak-kids', NULL, '/homecover.png', 45, 3)
ON CONFLICT (slug) DO NOTHING;

-- Restaurant and beach detail pages
INSERT INTO explore_vendors
  (guide_slug, slug, kind, name, subtitle, place, community, cuisine, rating, review_count, description, about,
   tags, hours, hours_today, website_url, booking_url, image_url, sort_order)
VALUES
  ('pescado', 'pescado', 'restaurant', 'Pescado Rooftop Bar', 'Seafood • Coastal • Rooftop',
   'Rosemary Beach, FL', 'Rosemary Beach', 'Seafood', 5.0, 258,
   'An elevated rooftop dining experience with fresh seafood, handcrafted cocktails, and panoramic Gulf views.',
   'Elevated rooftop dining with fresh seafood, cocktails, and panoramic Gulf views.',
   '{"Sunset views","Cocktails","Reservations recommended","Rooftop","Date night"}',
   'Mon - Sat, 4:00 - 10:00 PM', '4:00 PM — 10:00 PM',
   'https://www.pescado30a.com', 'https://resy.com', '/image10.png', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO explore_vendors
  (guide_slug, slug, kind, name, place, community, rating, review_count, description,
   amenities, rules, map_name, map_line1, map_line2, directions_url, image_url, sort_order)
VALUES
  ('rosemary', 'rosemary', 'beach', 'Rosemary Beach Access', 'Rosemary Beach, FL', 'Rosemary Beach', 5.0, 258,
   'Welcome to Rosemary Beach Access, a beautiful public access point to the sugar-white sands and emerald waters of 30A. Stroll down the boardwalk, relax by the gulf, and enjoy the best of Florida’s Gulf Coast.',
   '{"Beach Access","Nearby Parking","Restrooms Nearby","Outdoor Showers","Bike Racks","Family Friendly"}',
   '{"No glass containers on the beach.","Leave no trace. Please dispose of trash in designated bins.","Swim near a lifeguard and follow flag warnings.","Respect private property and stay off dunes.","Check local beach conditions and advisories before your visit."}',
   'Rosemary Beach', '30A, FL, 32461', 'Near the beach access on E. Kingston Rd.',
   'https://maps.google.com/?q=Rosemary+Beach+Access', '/image1.png', 1),
  ('inlet-beach', 'inlet', 'beach', 'Inlet Beach Access', 'Inlet Beach, FL', 'Inlet Beach', 4.9, 173,
   'Inlet Beach is the quiet eastern end of 30A with wide sugar-white sand, a regional access with parking, and one of the best sunset views on the coast.',
   '{"Beach Access","Nearby Parking","Restrooms Nearby","Outdoor Showers","Family Friendly"}',
   '{"No glass containers on the beach.","Leave no trace. Please dispose of trash in designated bins.","Swim near a lifeguard and follow flag warnings.","Respect private property and stay off dunes."}',
   'Inlet Beach', '30A, FL, 32461', 'Regional access at Orange St.',
   'https://maps.google.com/?q=Inlet+Beach+Regional+Access', '/cover.png', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public_info_sections (key, title, sort_order, items) VALUES
  ('rules', 'Beach Rules', 1, '{
    "No glass containers on the beach.",
    "Stay off the dunes and use designated beach access paths.",
    "Follow beach flag warnings before entering the water.",
    "Dispose of trash properly and leave no trace.",
    "Respect private property and posted access restrictions.",
    "Check local rules before bringing pets, fires, tents, or large setups."
  }'),
  ('parking', 'Parking', 2, '{
    "Public parking is available at regional beach accesses; arrive early in season.",
    "Do not park on private streets, lawns, or in front of beach access paths.",
    "Golf carts and bikes have designated racks at most accesses."
  }'),
  ('access', 'Beach Access', 3, '{
    "Regional and neighborhood accesses are marked with blue signs along 30A.",
    "Many accesses include boardwalks, showers, and restrooms.",
    "Some communities restrict access to residents and guests."
  }'),
  ('safety', 'Safety', 4, '{
    "Double red flags mean the water is closed to the public.",
    "Rip currents are common; swim near lifeguards when possible.",
    "Use sunscreen and stay hydrated, especially midday."
  }'),
  ('weather', 'Weather', 5, '{
    "Summer afternoons often bring short thunderstorms; check the radar before heading out.",
    "Hurricane season runs June through November.",
    "Water temperatures are warmest from June to September."
  }'),
  ('transport', 'Transportation', 6, '{
    "Nearest airports: ECP (Panama City), VPS (Destin), PNS (Pensacola).",
    "The 30A bike path runs the full length of the highway.",
    "Book airport transfers in the Services tab."
  }'),
  ('services', 'Local Services', 7, '{
    "Grocery: Publix at Water Sound Town Center.",
    "Urgent care and pharmacies are available in Santa Rosa Beach and Inlet Beach.",
    "Ask Vitoria for vetted local vendors."
  }'),
  ('emergency', 'Emergency Helplines', 8, '{
    "Emergency: 911",
    "Walton County Sheriff (non-emergency): (850) 892-8111",
    "South Walton Fire District: (850) 267-1298",
    "Beach conditions hotline: (850) 892-8111"
  }')
ON CONFLICT (key) DO NOTHING;

INSERT INTO service_catalog (key, kind, name, sub, price, unit, tone, icon, sort_order) VALUES
  ('full',    'grocery_package',  'Full Pack',   'Up to 70 items',          229, '+ Publix',   NULL,    NULL,       1),
  ('large',   'grocery_package',  'Large Pack',  '71-120 items',            379, '+ Publix',   NULL,    NULL,       2),
  ('xl',      'grocery_package',  'XL Pack',     'Over $1,000 in items',    229, '+ Publix',   NULL,    NULL,       3),
  ('bulk',    'grocery_package',  'Bulk Order',  '121-200 items',           379, '/ $1k block',NULL,    NULL,       4),
  ('rush',    'grocery_addon',    'Rush',        'Same-day service',        50,  NULL,         'green', 'Zap',      1),
  ('holiday', 'grocery_addon',    'Holiday',     'Weekend',                 50,  NULL,         'blue',  'Calendar', 2),
  ('bags',    'grocery_stocking', 'Leave In Bags', 'Everything left in bags by the kitchen', 0, NULL, NULL, NULL, 1),
  ('full-kitchen', 'grocery_stocking', 'Full Kitchen Organization', 'Put away in fridge, pantry & cabinets', 30, NULL, NULL, NULL, 2),
  ('cold',    'grocery_stocking', 'Refrigerated Items Only', 'Cold items stored, rest left in bags', 15, NULL, NULL, NULL, 3),
  ('transfer-holiday', 'transfer_addon', 'Holiday add-on', 'Holiday / peak date surcharge', 40, NULL, NULL, NULL, 1)
ON CONFLICT (key) DO NOTHING;
