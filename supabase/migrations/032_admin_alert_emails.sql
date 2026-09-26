-- Where "new transfer / new grocery order" alert emails go (comma-separated). Editable in
-- Admin -> Settings. Starts with the owner's address from his customer account.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS alert_emails text;
UPDATE settings SET alert_emails = 'contato.welsonsantos@gmail.com' WHERE id = 1 AND alert_emails IS NULL;
