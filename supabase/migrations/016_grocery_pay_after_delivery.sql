-- Grocery orders no longer place an authorization hold up front. The guest only saves a card
-- (a Stripe SetupIntent — no dollar amount reserved); the full total (service fee + the exact
-- Publix receipt, only known at delivery) is charged in one off-session charge once the shopper
-- actually delivers. card_saved_at tracks that save-card step independently of payment_status,
-- which now only changes once real money moves.
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS card_saved_at timestamptz;
