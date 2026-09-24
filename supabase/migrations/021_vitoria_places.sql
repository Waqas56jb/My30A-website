-- Vitoria replies can carry structured place cards (name, area, hours looked up live on the web,
-- phone, website, partner link) that the guest app renders as rich cards under the text.
ALTER TABLE vitoria_messages ADD COLUMN IF NOT EXISTS places jsonb;
