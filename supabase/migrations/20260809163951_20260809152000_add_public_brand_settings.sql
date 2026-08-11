/*
# Add editable public brand settings

1. Overview
- Adds one shared settings row for the public rate page.
- Administrators can control the displayed WhatsApp number and the public rate date without changing code.

2. New Tables
- `site_settings`
- `id` (text, primary key) - fixed `main` key for the single public configuration.
- `whatsapp_number` (text) - digits used for WhatsApp links and the visible contact number.
- `published_date` (date) - date shown as the current rate day.
- `updated_at` (timestamptz) - last modification time.

3. Security
- Row level security is enabled.
- Public visitors can read the shared settings.
- Authenticated administrators can insert, update, and delete the shared settings row.

4. Important Notes
- The existing exchange rate table remains unchanged and continues to store editable rates.
- The initial values preserve the current public page behavior.
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id text PRIMARY KEY DEFAULT 'main',
  whatsapp_number text NOT NULL DEFAULT '573024629142',
  published_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
CREATE POLICY "public_read_site_settings"
ON site_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_site_settings" ON site_settings;
CREATE POLICY "admin_insert_site_settings"
ON site_settings FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_site_settings" ON site_settings;
CREATE POLICY "admin_update_site_settings"
ON site_settings FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_site_settings" ON site_settings;
CREATE POLICY "admin_delete_site_settings"
ON site_settings FOR DELETE
TO authenticated USING (true);

INSERT INTO site_settings (id, whatsapp_number, published_date)
VALUES ('main', '573024629142', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_site_settings_updated ON site_settings;
CREATE TRIGGER trg_site_settings_updated
BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();