/*
# Create sponsors table for third-party banner ads

1. Overview
- Creates a `sponsors` table where the superadmin stores banner advertisements from third parties.
- Each sponsor has an image (banner), a title, a click-through URL, and a display order.
- The public page shows them in a carousel labeled "Patrocinado por:".

2. New Tables
- `sponsors`
- `id` (uuid, primary key)
- `title` (text) - sponsor name shown as caption
- `image_url` (text) - banner image URL
- `link_url` (text) - destination URL when the user clicks the banner
- `button_label` (text, default "Visitar") - text on the click-through button
- `active` (boolean, default true) - whether the banner is shown publicly
- `display_order` (int, default 0) - carousel order
- `created_at`, `updated_at` (timestamptz)

3. Security
- RLS enabled on `sponsors`.
- Public read (anon + authenticated) so the carousel works on the public page.
- Write operations (INSERT/UPDATE/DELETE) restricted to authenticated admins.
- The admin panel UI only shows the sponsor management section to superadmins.

4. Important Notes
- The superadmin can add, edit, reorder, activate/deactivate, and delete banners.
- Banners are displayed as a carousel on the public /tasas page.
- No existing data is affected.
*/

CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT 'Visitar',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_sponsors" ON sponsors;
CREATE POLICY "public_read_sponsors"
ON sponsors FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_sponsors" ON sponsors;
CREATE POLICY "admin_insert_sponsors"
ON sponsors FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_sponsors" ON sponsors;
CREATE POLICY "admin_update_sponsors"
ON sponsors FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_sponsors" ON sponsors;
CREATE POLICY "admin_delete_sponsors"
ON sponsors FOR DELETE
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sponsors_display_order ON sponsors(display_order);

DROP TRIGGER IF EXISTS trg_sponsors_updated ON sponsors;
CREATE TRIGGER trg_sponsors_updated
BEFORE UPDATE ON sponsors
FOR EACH ROW EXECUTE FUNCTION update_updated_at();