-- Guest app: new enum values (must be committed before use elsewhere)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE grocery_status ADD VALUE IF NOT EXISTS 'requested';
