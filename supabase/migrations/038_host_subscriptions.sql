-- Host Version subscription (per property, monthly / semi-annual / annual via Stripe Billing).
-- A host signs up on my30ahost.com/hosts, pays through Stripe Checkout, then manages their own
-- properties (My Home info, logo, QR codes) and sees guest activity in their dashboard (/host).
CREATE TABLE IF NOT EXISTS host_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly', 'semiannual', 'annual')),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 500),
  -- pending (signed up, not paid yet) | active | trialing | past_due | canceled | incomplete | unpaid
  status text NOT NULL DEFAULT 'pending',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  unit_amount numeric(10, 2),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE host_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.host_subscriptions TO service_role;

-- Which host owns a property (NULL = managed by My30A Host in Admin, like before).
ALTER TABLE host_homes ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_host_homes_owner ON host_homes (owner_id);

-- Guest activity per property, shown to the host as counts and topics (never private content).
-- kind: joined | opened | vitoria | transfer | grocery ; topic: wifi, door, checkout, … for vitoria
CREATE TABLE IF NOT EXISTS host_home_events (
  id bigserial PRIMARY KEY,
  home_id uuid NOT NULL REFERENCES host_homes (id) ON DELETE CASCADE,
  guest_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  kind text NOT NULL,
  topic text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_host_home_events_home ON host_home_events (home_id, created_at DESC);
ALTER TABLE host_home_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.host_home_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.host_home_events_id_seq TO service_role;

-- Plan prices per property (Admin → Settings). The client's first idea: $14.99/month.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS host_price_monthly numeric(10, 2) NOT NULL DEFAULT 14.99;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS host_price_semiannual numeric(10, 2) NOT NULL DEFAULT 79.99;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS host_price_annual numeric(10, 2) NOT NULL DEFAULT 149.99;
