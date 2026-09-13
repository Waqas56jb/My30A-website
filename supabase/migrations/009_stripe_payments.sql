-- Stripe payments: guests authorize a card up front (manual-capture PaymentIntent) and staff
-- capture it on completion, exactly like the existing cash/card-on-file flow but real.

-- New enum value must be committed before any query can use it (Postgres restriction), so this
-- migration only adds the value; nothing here references 'authorized' yet.
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'authorized';

-- One Stripe Customer per guest, reused across all their bookings.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
