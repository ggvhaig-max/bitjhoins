/*
# Restrict sponsor banner uploads

1. Overview
- Limits sponsor banner files to common web image formats and a maximum size of 5 MB.
- Enforces the restrictions in Supabase Storage so direct API requests cannot bypass the upload form.

2. Modified Storage Bucket
- `sponsor-banners`
- `file_size_limit`: 5 MB
- `allowed_mime_types`: JPEG, PNG, WebP, GIF, and SVG images

3. Security
- Upload validation is enforced at the storage boundary in addition to the form validation.
- Existing banner files are preserved.
*/

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE id = 'sponsor-banners';