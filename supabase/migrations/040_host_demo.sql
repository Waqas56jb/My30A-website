-- Demo host account (public, read-only) so prospective hosts can try the dashboard before buying.
ALTER TABLE host_subscriptions ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
