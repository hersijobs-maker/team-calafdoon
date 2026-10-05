/*
# Create cover-photos storage bucket

1. New Storage Bucket
   - `cover-photos` — public bucket for user cover/banner photos.
   - Files are stored under `<user_id>/cover-<timestamp>.<ext>` paths.

2. Storage Policies (RLS on storage.objects)
   - SELECT: public read (anyone can view cover photos, like avatars).
   - INSERT: authenticated users can upload only to their own folder path (`<auth.uid()/...`).
   - UPDATE: authenticated users can update only their own cover photos.
   - DELETE: authenticated users can delete only their own cover photos.

3. Notes
   - The bucket is public so cover photos can be displayed via getPublicUrl,
     matching the existing `avatars` bucket pattern.
   - File size and MIME type validation is enforced client-side in the upload component.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-photos', 'cover-photos', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT: public read
DROP POLICY IF EXISTS "cover_photos_public_read" ON storage.objects;
CREATE POLICY "cover_photos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'cover-photos');

-- INSERT: authenticated users can upload to their own folder
DROP POLICY IF EXISTS "cover_photos_insert_own" ON storage.objects;
CREATE POLICY "cover_photos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cover-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: authenticated users can update their own cover photos
DROP POLICY IF EXISTS "cover_photos_update_own" ON storage.objects;
CREATE POLICY "cover_photos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cover-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'cover-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: authenticated users can delete their own cover photos
DROP POLICY IF EXISTS "cover_photos_delete_own" ON storage.objects;
CREATE POLICY "cover_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'cover-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);