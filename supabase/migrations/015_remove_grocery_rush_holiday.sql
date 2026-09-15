-- Client asked to remove the "Rush" and "Holiday" grocery add-ons. Deactivate rather than delete so
-- past grocery_orders rows that already recorded these in their addons snapshot stay intact and
-- readable in the admin panel.
UPDATE service_catalog
SET is_active = false
WHERE kind = 'grocery_addon' AND key IN ('rush', 'holiday');
