-- Grocery prices per the client's price sheet (Sep 2026). Large and XL were wrong and the XL/Bulk
-- descriptions were swapped; Rush (same-day) and Holiday add-ons are offered again.
UPDATE service_catalog SET price = 229, sub = 'Up to 70 items', unit = '+ Publix', sort_order = 1 WHERE kind = 'grocery_package' AND key = 'full';
UPDATE service_catalog SET price = 329, sub = '71-120 items', unit = '+ Publix', sort_order = 2 WHERE kind = 'grocery_package' AND key = 'large';
UPDATE service_catalog SET price = 379, sub = '121-200 items', unit = '+ Publix', sort_order = 3 WHERE kind = 'grocery_package' AND key = 'xl';
UPDATE service_catalog SET price = 379, sub = 'Over $1,000 in items', unit = '/ $1k block', sort_order = 4 WHERE kind = 'grocery_package' AND key = 'bulk';
UPDATE service_catalog SET price = 50, name = 'Rush', sub = 'Same-day, any pack', is_active = true WHERE kind = 'grocery_addon' AND key = 'rush';
UPDATE service_catalog SET price = 75, name = 'Holiday', sub = 'Holiday weekend', is_active = true WHERE kind = 'grocery_addon' AND key = 'holiday';

-- Bulk is priced per started $1,000 of groceries: blocks are set from the cart total at checkout
-- and re-counted from the real receipt at delivery.
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS package_blocks integer NOT NULL DEFAULT 1;
