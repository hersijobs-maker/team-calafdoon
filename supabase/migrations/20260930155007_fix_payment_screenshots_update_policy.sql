-- Add an UPDATE (write) policy for payment-screenshots storage bucket
-- This is required for upsert: true to work when the file already exists.
-- Without it, Supabase tries to UPDATE the existing object and fails with
-- "new row violates row-level security policy"
CREATE POLICY "payment_screenshots_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
