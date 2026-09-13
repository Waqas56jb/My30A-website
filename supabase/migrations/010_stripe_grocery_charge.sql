-- The service fee is authorized/captured via stripe_payment_intent_id (known up front). The
-- exact Publix grocery total is only known at delivery, so it's charged separately, off-session,
-- against the guest's saved card — tracked here so admin/guest can see that charge.
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS stripe_grocery_payment_intent_id text;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS grocery_payment_status payment_status DEFAULT 'pending';
