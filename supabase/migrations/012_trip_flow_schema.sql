-- Trip flow v2: arrived/picked-up timestamps, guest secret links, cancellation/no-show fees,
-- round trips, on-the-spot payment links, vehicle name visibility, per-trip chat, SMS/call
-- audit logs, guest credits, and the free public-info layer (beach accesses, parks, emergency).

ALTER TABLE transfers ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS picked_up_at timestamptz;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS guest_token text UNIQUE;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS cancellation_fee numeric(10, 2) DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS no_show_fee numeric(10, 2) DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS round_trip_group_id uuid;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS discount_percent numeric(5, 2) DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS pay_link_url text;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS tip_paid_via text;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS tip_requested_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_transfers_round_trip_group ON transfers (round_trip_group_id);

-- Secret link token so guests without an account can open their trip chat / tip page.
CREATE OR REPLACE FUNCTION public.set_transfer_guest_token()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.guest_token IS NULL THEN
    NEW.guest_token := md5(gen_random_uuid()::text || clock_timestamp()::text);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transfers_set_guest_token ON transfers;
CREATE TRIGGER transfers_set_guest_token
  BEFORE INSERT ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_transfer_guest_token();
UPDATE transfers
SET guest_token = md5(gen_random_uuid()::text || clock_timestamp()::text || id::text)
WHERE guest_token IS NULL;

-- Admin can hide the model name from guests ("Private transfer · Up to 4 passengers").
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;

-- Per-trip chat. Guests post via the app or the secret link; drivers from their dashboard;
-- admin sees everything forever. Rows are never deleted.
CREATE TABLE IF NOT EXISTS trip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES transfers (id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('guest', 'driver', 'admin', 'system')),
  sender_id uuid REFERENCES profiles (id),
  sender_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_messages_transfer ON trip_messages (transfer_id, created_at);

-- Every SMS the system sends (or would have sent when Twilio isn't configured yet).
CREATE TABLE IF NOT EXISTS sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid REFERENCES transfers (id) ON DELETE SET NULL,
  grocery_order_id uuid REFERENCES grocery_orders (id) ON DELETE SET NULL,
  to_phone text,
  body text NOT NULL,
  kind text,
  status text NOT NULL DEFAULT 'queued',
  provider_sid text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_log_transfer ON sms_log (transfer_id, created_at);

-- Masked calls routed through the Twilio number (populated by the voice status webhook).
CREATE TABLE IF NOT EXISTS call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid REFERENCES transfers (id) ON DELETE SET NULL,
  direction text CHECK (direction IN ('guest_to_driver', 'driver_to_guest', 'unknown')),
  from_phone text,
  to_phone text,
  twilio_call_sid text UNIQUE,
  status text,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_log_transfer ON call_log (transfer_id, created_at);

-- "$25 credit on next booking" when My30A Host cancels.
CREATE TABLE IF NOT EXISTS guest_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  guest_email text,
  guest_phone text,
  amount numeric(10, 2) NOT NULL,
  reason text,
  transfer_id uuid REFERENCES transfers (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'void')),
  used_transfer_id uuid REFERENCES transfers (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_guest_credits_guest ON guest_credits (guest_id, status);

-- Free public layer: beach accesses, parks & playgrounds, emergency numbers. Facts, never
-- partners, never behind a paywall (is_public_info is implicit — separate table).
CREATE TABLE IF NOT EXISTS public_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  section_title text NOT NULL,
  name text NOT NULL,
  community text,
  details text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_places_section ON public_places (section_key, sort_order);

ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_places ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON trip_messages, sms_log, call_log, guest_credits, public_places
  TO anon, authenticated;
GRANT ALL ON trip_messages, sms_log, call_log, guest_credits, public_places TO service_role;

CREATE POLICY trip_messages_admin_all ON trip_messages
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));
CREATE POLICY trip_messages_participants_select ON trip_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transfers t
    WHERE t.id = trip_messages.transfer_id AND (t.driver_id = auth.uid() OR t.guest_id = auth.uid())
  ));
CREATE POLICY trip_messages_participants_insert ON trip_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM transfers t
    WHERE t.id = trip_messages.transfer_id AND (t.driver_id = auth.uid() OR t.guest_id = auth.uid())
  ));

CREATE POLICY sms_log_admin_all ON sms_log
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));
CREATE POLICY call_log_admin_all ON call_log
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));

CREATE POLICY guest_credits_admin_all ON guest_credits
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));
CREATE POLICY guest_credits_own_select ON guest_credits
  FOR SELECT TO authenticated USING (guest_id = auth.uid());

CREATE POLICY public_places_select ON public_places
  FOR SELECT TO authenticated USING (true);
CREATE POLICY public_places_admin_write ON public_places
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));
