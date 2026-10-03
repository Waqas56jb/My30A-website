-- Vitoria chat threads are separate per context: the free app (home_id NULL) and each Host Version
-- property the guest opened through its QR code. House info from one never shows up in another.
ALTER TABLE vitoria_messages ADD COLUMN IF NOT EXISTS home_id uuid REFERENCES host_homes (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_vitoria_messages_guest_home ON vitoria_messages (guest_id, home_id, created_at);
