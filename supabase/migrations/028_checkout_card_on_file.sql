-- Checkout: the guest's card is verified (Stripe SetupIntent, 3-D Secure when the bank asks) BEFORE a
-- transfer or grocery order is submitted, and the booking is created with that card attached.
-- Transfers within 6 days get an authorization hold right away; later trips get it 5 days before
-- pickup (daily job). The saved card covers anything the hold can't (holiday fee, expired hold).
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS card_label text;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS card_label text;
