/*
# Create payment-proofs storage bucket

1. Storage
- Creates a public bucket `payment-proofs` for storing customer payment comprobante files (JPG, PNG, PDF).
- Public read so the admin can view uploaded proofs from the dashboard.
- Authenticated + anon can upload.
2. Security
- Bucket is public for reads (admin needs to view proofs).
- INSERT (upload) allowed for anon + authenticated (customers are not signed-in users).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_payment_proofs" ON storage.objects;
CREATE POLICY "anon_read_payment_proofs" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "anon_insert_payment_proofs" ON storage.objects;
CREATE POLICY "anon_insert_payment_proofs" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "anon_update_payment_proofs" ON storage.objects;
CREATE POLICY "anon_update_payment_proofs" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'payment-proofs') WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "anon_delete_payment_proofs" ON storage.objects;
CREATE POLICY "anon_delete_payment_proofs" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'payment-proofs');