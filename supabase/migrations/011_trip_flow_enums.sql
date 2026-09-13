-- Trip flow v2 enum values (must be committed before use — Postgres restriction).
-- Driver flow: assigned → started (on the way) → arrived → picked_up → completed
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'no_show';

-- Guest paid the host directly via Zelle; driver just confirms it.
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'zelle';
