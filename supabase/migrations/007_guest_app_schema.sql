-- Guest app: self-signup guests, stay/booking link, Explore 30A content, saved places,
-- Vitoria chat log, service catalog, and guest-originated transfer/grocery requests.
-- Everything here is additive; no existing rows are modified or removed.

-- Guests self-signup with role metadata. Staff are admin-created and have their roles set
-- explicitly right after creation, so the default '{}' path never affects them.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, roles)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'guest' THEN ARRAY['guest']::user_role[]
      ELSE '{}'::user_role[]
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Guest-originated requests: link back to the guest account and keep the price breakdown.
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES profiles (id);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS base_price numeric(10, 2);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_transfers_guest_id ON transfers (guest_id);

ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES profiles (id);
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS stocking text;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE grocery_orders ADD COLUMN IF NOT EXISTS list_file_url text;
CREATE INDEX IF NOT EXISTS idx_grocery_orders_guest_id ON grocery_orders (guest_id);

-- Assignment happens after the fact for guest requests (no-op if already nullable).
ALTER TABLE transfers ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE grocery_orders ALTER COLUMN shopper_id DROP NOT NULL;

-- The guest's current stay (one active booking per guest).
CREATE TABLE IF NOT EXISTS guest_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities (id),
  property_address text,
  check_in date,
  check_out date,
  guests_count int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_bookings_guest_id ON guest_bookings (guest_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_bookings_active
  ON guest_bookings (guest_id) WHERE is_active;

-- Explore 30A: category tiles on the Explore home screen.
CREATE TABLE IF NOT EXISTS explore_categories (
  key text PRIMARY KEY,
  label text NOT NULL,
  tone text,
  icon text,
  target text NOT NULL DEFAULT 'guide?c=all',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Explore 30A: Local Guide cards. kind decides the detail screen:
--   vendors    -> /explore/vendors/:slug (list of explore_vendors with guide_slug = slug)
--   restaurant -> /explore/restaurant/:detail_slug
--   beach      -> /explore/beach/:detail_slug
CREATE TABLE IF NOT EXISTS explore_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'vendors' CHECK (kind IN ('vendors', 'restaurant', 'beach')),
  detail_slug text,
  image_url text,
  price_from text,
  vendor_count text,
  place text,
  filters text[] NOT NULL DEFAULT '{all}',
  is_pick boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Explore 30A: vendors, restaurants and beaches (one table, kind-specific optional fields).
CREATE TABLE IF NOT EXISTS explore_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_slug text REFERENCES explore_guides (slug) ON DELETE SET NULL,
  slug text UNIQUE NOT NULL,
  kind text NOT NULL DEFAULT 'vendor' CHECK (kind IN ('vendor', 'restaurant', 'beach')),
  name text NOT NULL,
  subtitle text,
  place text,
  community text,
  cuisine text,
  rating numeric(2, 1),
  review_count int NOT NULL DEFAULT 0,
  description text,
  about text,
  services text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  amenities text[] NOT NULL DEFAULT '{}',
  rules text[] NOT NULL DEFAULT '{}',
  hours text,
  hours_today text,
  map_name text,
  map_line1 text,
  map_line2 text,
  phone text,
  website_url text,
  booking_url text,
  directions_url text,
  image_url text,
  price_from numeric(10, 2),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_explore_vendors_guide_slug ON explore_vendors (guide_slug);

CREATE TABLE IF NOT EXISTS saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES explore_vendors (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (guest_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_places_guest_id ON saved_places (guest_id);

CREATE TABLE IF NOT EXISTS vitoria_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  model text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vitoria_messages_guest_id ON vitoria_messages (guest_id, created_at);

CREATE TABLE IF NOT EXISTS public_info_sections (
  key text PRIMARY KEY,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  items text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Prices the guest app quotes from (grocery packages/add-ons/stocking, transfer add-ons).
CREATE TABLE IF NOT EXISTS service_catalog (
  key text PRIMARY KEY,
  kind text NOT NULL CHECK (
    kind IN ('grocery_package', 'grocery_addon', 'grocery_stocking', 'transfer_addon')
  ),
  name text NOT NULL,
  sub text,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  unit text,
  tone text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guest_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitoria_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_info_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  guest_bookings, explore_categories, explore_guides, explore_vendors,
  saved_places, vitoria_messages, public_info_sections, service_catalog
  TO anon, authenticated;
GRANT ALL ON
  guest_bookings, explore_categories, explore_guides, explore_vendors,
  saved_places, vitoria_messages, public_info_sections, service_catalog
  TO service_role;

-- Own-row tables
CREATE POLICY guest_bookings_own_all ON guest_bookings
  FOR ALL TO authenticated
  USING (guest_id = auth.uid() OR has_role('admin'))
  WITH CHECK (guest_id = auth.uid() OR has_role('admin'));

CREATE POLICY saved_places_own_all ON saved_places
  FOR ALL TO authenticated
  USING (guest_id = auth.uid() OR has_role('admin'))
  WITH CHECK (guest_id = auth.uid() OR has_role('admin'));

CREATE POLICY vitoria_messages_own_all ON vitoria_messages
  FOR ALL TO authenticated
  USING (guest_id = auth.uid() OR has_role('admin'))
  WITH CHECK (guest_id = auth.uid() OR has_role('admin'));

-- Content tables: everyone signed in can read, admin writes
CREATE POLICY explore_categories_select ON explore_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY explore_categories_admin_write ON explore_categories
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));

CREATE POLICY explore_guides_select ON explore_guides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY explore_guides_admin_write ON explore_guides
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));

CREATE POLICY explore_vendors_select ON explore_vendors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY explore_vendors_admin_write ON explore_vendors
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));

CREATE POLICY public_info_sections_select ON public_info_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY public_info_sections_admin_write ON public_info_sections
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));

CREATE POLICY service_catalog_select ON service_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY service_catalog_admin_write ON service_catalog
  FOR ALL TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));

-- Guests may read their own requests directly (defense in depth; the API uses the
-- service role, which bypasses RLS).
CREATE POLICY transfers_guest_select ON transfers
  FOR SELECT TO authenticated USING (guest_id = auth.uid());
CREATE POLICY grocery_orders_guest_select ON grocery_orders
  FOR SELECT TO authenticated USING (guest_id = auth.uid());
CREATE POLICY communities_guest_select ON communities
  FOR SELECT TO authenticated USING (has_role('guest'));
