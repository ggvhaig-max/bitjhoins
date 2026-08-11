/*
# Restrict sponsor management to superadmins

1. Overview
- Replaces the broad authenticated write policies on `sponsors` with server-enforced superadmin checks.

2. Security
- Public visitors and signed-in users can still read active and inactive sponsor rows as needed by the admin panel.
- Only authenticated users whose `user_profiles.role` is `superadmin` can insert, update, or delete sponsor banners.
- The restriction is enforced by RLS and does not depend on the user interface.

3. Important Notes
- Existing sponsor banners are preserved.
- Administrators can continue managing exchange rates but cannot manage third-party advertising.
*/

DROP POLICY IF EXISTS "admin_insert_sponsors" ON sponsors;
CREATE POLICY "superadmin_insert_sponsors"
ON sponsors FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));

DROP POLICY IF EXISTS "admin_update_sponsors" ON sponsors;
CREATE POLICY "superadmin_update_sponsors"
ON sponsors FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));

DROP POLICY IF EXISTS "admin_delete_sponsors" ON sponsors;
CREATE POLICY "superadmin_delete_sponsors"
ON sponsors FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));