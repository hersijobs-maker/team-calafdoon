-- Make the payment-screenshots bucket public so getPublicUrl() works
-- (RLS policies still control who can upload/read via the API)
UPDATE storage.buckets SET public = true WHERE id = 'payment-screenshots';

-- Add file size limit and allowed mime types
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = '{"image/jpeg","image/png","image/webp"}'
WHERE id = 'payment-screenshots';

-- Add a DELETE policy so upsert (which deletes then inserts) works
CREATE POLICY "payment_screenshots_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
