-- Host version as a product: property managers get their own login (role 'host').
-- Alone in its file: a new enum value can't be used in the same transaction that adds it.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'host';
