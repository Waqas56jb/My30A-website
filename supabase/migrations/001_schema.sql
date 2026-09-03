-- My30A ops schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'partner', 'driver', 'shopper');
CREATE TYPE airport_code AS ENUM ('ECP', 'VPS', 'PNS');
CREATE TYPE vehicle_type AS ENUM ('4pax', '6pax', '14pax');
CREATE TYPE comp_type AS ENUM ('fixed', 'percentage', 'hourly');
CREATE TYPE payment_method AS ENUM ('card_on_file', 'card', 'apple_pay', 'google_pay', 'cash');
CREATE TYPE payment_status AS ENUM ('pending', 'captured', 'failed', 'refunded');
CREATE TYPE trip_status AS ENUM ('assigned', 'started', 'completed', 'cancelled', 'refunded');
CREATE TYPE grocery_status AS ENUM ('assigned', 'shopping', 'on_the_way', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payout_status AS ENUM ('pending', 'paid');
CREATE TYPE payout_method AS ENUM ('zelle', 'cash', 'stripe');

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  roles user_role[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_fee_percent numeric(5, 2) DEFAULT 20,
  default_owner_fee_percent numeric(5, 2) DEFAULT 20,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  zone text,
  default_airport airport_code,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE transfer_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities (id),
  airport airport_code,
  vehicle_type vehicle_type,
  base_price numeric(10, 2),
  created_at timestamptz DEFAULT now(),
  UNIQUE (community_id, airport, vehicle_type)
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles (id),
  make text,
  model text,
  year int,
  vehicle_type vehicle_type,
  capacity int,
  plate text,
  owner_fee_percent numeric(5, 2) DEFAULT 20,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE compensation_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles (id),
  type comp_type,
  value numeric(10, 2),
  effective_from date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number bigserial UNIQUE,
  guest_name text,
  guest_phone text,
  guest_email text,
  pickup_address text,
  dropoff_address text,
  community_id uuid REFERENCES communities (id),
  airport airport_code,
  direction text CHECK (direction IN ('to_airport', 'from_airport')),
  vehicle_type vehicle_type,
  passengers int,
  bags int,
  flight_number text,
  scheduled_at timestamptz,
  driver_id uuid REFERENCES profiles (id),
  vehicle_id uuid REFERENCES vehicles (id),
  vehicle_owner_id uuid REFERENCES profiles (id),
  customer_charge numeric(10, 2),
  is_custom_price boolean DEFAULT false,
  payment_method payment_method,
  payment_status payment_status DEFAULT 'pending',
  stripe_payment_intent_id text,
  cash_expected numeric(10, 2),
  cash_reported numeric(10, 2),
  driver_payout numeric(10, 2) DEFAULT 0,
  tip_amount numeric(10, 2) DEFAULT 0,
  owner_fee numeric(10, 2) DEFAULT 0,
  my30ahost_amount numeric(10, 2) DEFAULT 0,
  comp_snapshot jsonb,
  owner_fee_percent_snapshot numeric(5, 2),
  status trip_status DEFAULT 'assigned',
  started_at timestamptz,
  completed_at timestamptz,
  is_flagged boolean DEFAULT false,
  flag_reason text,
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE trip_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid REFERENCES transfers (id) ON DELETE CASCADE,
  status trip_status,
  updated_by uuid REFERENCES profiles (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE grocery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigserial UNIQUE,
  guest_name text,
  guest_phone text,
  guest_email text,
  delivery_address text,
  community_id uuid REFERENCES communities (id),
  package text,
  items jsonb,
  delivery_time timestamptz,
  shopper_id uuid REFERENCES profiles (id),
  service_fee numeric(10, 2),
  grocery_total numeric(10, 2) DEFAULT 0,
  customer_charge numeric(10, 2),
  payment_method payment_method,
  payment_status payment_status DEFAULT 'pending',
  stripe_payment_intent_id text,
  shopper_payout numeric(10, 2) DEFAULT 0,
  tip_amount numeric(10, 2) DEFAULT 0,
  my30ahost_amount numeric(10, 2) DEFAULT 0,
  comp_snapshot jsonb,
  receipt_url text,
  kitchen_photo_url text,
  status grocery_status DEFAULT 'assigned',
  started_at timestamptz,
  delivered_at timestamptz,
  is_flagged boolean DEFAULT false,
  flag_reason text,
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE grocery_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES grocery_orders (id) ON DELETE CASCADE,
  status grocery_status,
  updated_by uuid REFERENCES profiles (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles (id),
  trip_earnings numeric(10, 2) DEFAULT 0,
  tip_earnings numeric(10, 2) DEFAULT 0,
  total_amount numeric(10, 2) DEFAULT 0,
  cash_collected numeric(10, 2) DEFAULT 0,
  cash_owed_to_admin numeric(10, 2) DEFAULT 0,
  payment_method payout_method,
  period_start date,
  period_end date,
  status payout_status DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid REFERENCES payouts (id) ON DELETE CASCADE,
  transfer_id uuid REFERENCES transfers (id),
  grocery_order_id uuid REFERENCES grocery_orders (id),
  trip_earnings numeric(10, 2) DEFAULT 0,
  tip_earnings numeric(10, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles (id),
  message text,
  transfer_id uuid REFERENCES transfers (id),
  grocery_order_id uuid REFERENCES grocery_orders (id),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE gps_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid REFERENCES transfers (id),
  driver_id uuid REFERENCES profiles (id),
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transfer_pricing_community_id ON transfer_pricing (community_id);
CREATE INDEX idx_vehicles_owner_id ON vehicles (owner_id);
CREATE INDEX idx_compensation_agreements_user_id ON compensation_agreements (user_id);
CREATE INDEX idx_compensation_agreements_created_by ON compensation_agreements (created_by);
CREATE INDEX idx_transfers_community_id ON transfers (community_id);
CREATE INDEX idx_transfers_driver_id ON transfers (driver_id);
CREATE INDEX idx_transfers_vehicle_id ON transfers (vehicle_id);
CREATE INDEX idx_transfers_vehicle_owner_id ON transfers (vehicle_owner_id);
CREATE INDEX idx_transfers_created_by ON transfers (created_by);
CREATE INDEX idx_trip_status_log_transfer_id ON trip_status_log (transfer_id);
CREATE INDEX idx_trip_status_log_updated_by ON trip_status_log (updated_by);
CREATE INDEX idx_grocery_orders_community_id ON grocery_orders (community_id);
CREATE INDEX idx_grocery_orders_shopper_id ON grocery_orders (shopper_id);
CREATE INDEX idx_grocery_orders_created_by ON grocery_orders (created_by);
CREATE INDEX idx_grocery_status_log_order_id ON grocery_status_log (order_id);
CREATE INDEX idx_grocery_status_log_updated_by ON grocery_status_log (updated_by);
CREATE INDEX idx_payouts_user_id ON payouts (user_id);
CREATE INDEX idx_payout_items_payout_id ON payout_items (payout_id);
CREATE INDEX idx_payout_items_transfer_id ON payout_items (transfer_id);
CREATE INDEX idx_payout_items_grocery_order_id ON payout_items (grocery_order_id);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_transfer_id ON notifications (transfer_id);
CREATE INDEX idx_notifications_grocery_order_id ON notifications (grocery_order_id);
CREATE INDEX idx_gps_points_transfer_id ON gps_points (transfer_id);
CREATE INDEX idx_gps_points_driver_id ON gps_points (driver_id);

CREATE INDEX idx_transfers_driver_id_status ON transfers (driver_id, status);
CREATE INDEX idx_grocery_orders_shopper_id_status ON grocery_orders (shopper_id, status);
CREATE INDEX idx_notifications_user_id_is_read ON notifications (user_id, is_read);
CREATE INDEX idx_compensation_agreements_user_id_effective_from ON compensation_agreements (user_id, effective_from DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_points ENABLE ROW LEVEL SECURITY;

INSERT INTO settings (id) VALUES (1);
