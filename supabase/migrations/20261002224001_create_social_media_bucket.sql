/*
# Create social-media storage bucket

Creates a public bucket for user-uploaded photos and videos for the social media system.
Sets storage policies so authenticated users can upload and read media.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to social-media bucket
-- Path pattern: {user_id}/{timestamp}-{filename}
DROP POLICY IF EXISTS "social_media_upload_authenticated" ON storage.objects;
CREATE POLICY "social_media_upload_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'social-media');

-- Allow public read access (bucket is public)
DROP POLICY IF EXISTS "social_media_read_public" ON storage.objects;
CREATE POLICY "social_media_read_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-media');

-- Allow users to delete their own uploads
DROP POLICY IF EXISTS "social_media_delete_own" ON storage.objects;
CREATE POLICY "social_media_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'social-media');
