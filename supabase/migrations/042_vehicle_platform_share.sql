-- Per-vehicle My30A share when an owner (or co-owner) drives their own car. NULL = the Settings
-- default (platform_fee_percent). The driving owner gets the rest (e.g. 25 → owner-driver 75%).
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5, 2) CHECK (platform_fee_percent IS NULL OR (platform_fee_percent >= 0 AND platform_fee_percent <= 100));
