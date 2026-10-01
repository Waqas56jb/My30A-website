-- Partner registration: a business (restaurant, bar, coffee shop or Local Guide service) fills in
-- the public form at my30ahost.com/partners/join; the admin reviews it in Admin → Partners and on
-- approval it is listed automatically in the right Explore category (an explore_vendors row).
CREATE TABLE IF NOT EXISTS partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- restaurant | bar | coffee (Dining guide) or vendor (Local Guide, category in guide_slug)
  listing_type text NOT NULL CHECK (listing_type IN ('restaurant', 'bar', 'coffee', 'vendor')),
  guide_slug text,

  business_name text NOT NULL,
  description text NOT NULL,
  website_url text,
  phone text NOT NULL,
  email text NOT NULL,
  contact_name text,
  address text,
  community text,
  hours text,
  cuisine text,
  instagram text,
  photo_url text,

  admin_note text,
  vendor_id uuid REFERENCES explore_vendors (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON partner_requests (status, created_at DESC);

ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.partner_requests TO service_role;
