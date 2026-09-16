-- The one restaurant and two beach vendor rows left over from the original Figma mockup were
-- never client data. Their guide cards were retired in 017, but these vendor rows stayed active,
-- so Vitoria kept presenting "Pescado Rooftop Bar" as the only vetted restaurant. Retire them too.
UPDATE explore_vendors SET is_active = false
WHERE slug IN ('pescado', 'rosemary', 'inlet') AND kind IN ('restaurant', 'beach');
