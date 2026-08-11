/*
# Create sponsor-banners storage bucket

1. Overview
- Creates a public-read storage bucket named `sponsor-banners` where superadmins upload banner image files for sponsors.
- Public visitors can read (view) the images so the carousel works on the public page.
- Only authenticated superadmins can upload, overwrite, or delete banner files.

2. Storage Bucket
- `sponsor-banners` (public = true so images are served via public URLs)

3. Security
- SELECT (read) on storage.objects: public (anon + authenticated) so the carousel can display banners.
- INSERT: only authenticated users whose user_profiles.role = 'superadmin'.
- UPDATE: only authenticated superadmins, restricted to objects they manage.
- DELETE: only authenticated superadmins.

4. Important Notes
- The bucket is public so image URLs are accessible without signed URLs — appropriate for advertising banners that are meant to be publicly visible.
- Upload restrictions are enforced at the storage policy level, not just in the UI.
- No existing data is affected.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor-banners', 'sponsor-banners', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_sponsor_banners" ON storage.objects;
CREATE POLICY "public_read_sponsor_banners"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'sponsor-banners');

DROP POLICY IF EXISTS "superadmin_insert_sponsor_banners" ON storage.objects;
CREATE POLICY "superadmin_insert_sponsor_banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sponsor-banners'
  AND EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin')
);

DROP POLICY IF EXISTS "superadmin_update_sponsor_banners" ON storage.objects;
CREATE POLICY "superadmin_update_sponsor_banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sponsor-banners'
  AND EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin')
)
WITH CHECK (
  bucket_id = 'sponsor-banners'
  AND EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin')
);

DROP POLICY IF EXISTS "superadmin_delete_sponsor_banners" ON storage.objects;
CREATE POLICY "superadmin_delete_sponsor_banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sponsor-banners'
  AND EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin')
);