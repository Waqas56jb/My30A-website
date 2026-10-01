-- Host version (subscription): a vacation-rental host's property in the guest app. The guest scans
-- the QR code in the house (my30ahost.com/h/<slug>), sees the host's logo on the welcome and login
-- screens, and gets a "My Home" tab with this property's info. Everything else is the normal app.
-- The slug carries a random suffix so a property's page (door code, WiFi) can't be guessed.
CREATE TABLE IF NOT EXISTS host_homes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,

  -- the host (shown on the welcome / login screens)
  host_name text NOT NULL,
  host_tagline text,
  logo_url text,

  -- the property
  home_name text NOT NULL,
  address text,
  area text,
  cover_url text,

  -- access
  wifi_network text,
  wifi_password text,
  door_code text,
  parking text,

  -- your stay
  check_in_time text,
  check_out_time text,
  max_guests int,
  pets text,

  -- [{ "icon": "tv", "label": "TV streaming", "value": "Smart TV - Netflix & Apple TV ready" }]
  instructions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- one rule per line, emoji allowed ("🚭 No smoking inside")
  rules text[] NOT NULL DEFAULT '{}',

  -- contact
  contact_label text,
  contact_phone text,

  -- follow us / plan your next stay
  instagram text,
  facebook text,
  tiktok text,
  website_url text,
  properties_label text,
  airbnb_url text,
  vrbo_url text,

  -- subscription bookkeeping (admin only)
  plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly', 'annual')),
  paid_until date,
  notes text,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE host_homes ENABLE ROW LEVEL SECURITY;

-- The property a guest entered through (set when they scan the QR code and sign in).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS host_home_id uuid REFERENCES host_homes (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_host_home ON profiles (host_home_id);
