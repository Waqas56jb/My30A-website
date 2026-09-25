-- Grocery prepayment (client decision, Sep 2026): the guest pays the Publix cart total + a buffer
-- when they order, so My30A Host never shops with its own money. At delivery one settlement charge
-- (service fee ± receipt difference) closes the order. Orders with less than the minimum notice pay
-- a rush fee that covers a Stripe Instant Payout of the prepayment to the owner's bank.

-- Policy, editable in Admin → Settings.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_buffer_percent numeric NOT NULL DEFAULT 5;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_rush_fee_percent numeric NOT NULL DEFAULT 2;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_min_notice_hours integer NOT NULL DEFAULT 72;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS grocery_instant_payouts boolean NOT NULL DEFAULT true;

-- Per order. The prepayment itself is stripe_grocery_payment_intent_id (grocery_payment_status);
-- the delivery settlement charge is stripe_payment_intent_id (payment_status).
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS cart_estimate numeric(10,2);          -- Publix cart total the guest entered
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS buffer_percent numeric;                -- buffer used for this order
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS grocery_prepaid numeric(10,2);         -- cart + buffer (credited at delivery)
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS is_rush boolean NOT NULL DEFAULT false;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS rush_fee numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS prepay_amount numeric(10,2);           -- charged at checkout (prepaid + rush fee)
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS prepaid_at timestamptz;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS settlement_amount numeric(10,2);       -- + charged / − refunded at delivery
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS instant_payout_id text;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS instant_payout_status text;            -- sent | failed | skipped
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS instant_payout_amount numeric(10,2);
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS instant_payout_error text;
