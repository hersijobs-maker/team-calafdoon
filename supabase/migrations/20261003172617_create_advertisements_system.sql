/*
# Create Advertisements System

## Purpose
Allows the admin to upload, manage, and display advertisements (images, videos, GIFs) on the homepage.
Admins can create ads with title, description, media, clickable button text and link, and toggle active/inactive.

## New Tables
- `advertisements`
  - `id` (uuid, PK)
  - `title` (text, not null) — ad title
  - `description` (text, nullable) — ad description/body
  - `media_url` (text, not null) — URL to the uploaded media file
  - `media_type` (text, not null) — 'image' | 'video' | 'gif'
  - `button_text` (text, nullable) — CTA button label
  - `button_link` (text, nullable) — CTA button URL
  - `is_active` (boolean, default true) — whether the ad is displayed on homepage
  - `sort_order` (int, default 0) — ordering for display
  - `created_by` (uuid, FK to auth.users) — admin who created the ad
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Storage
- Create `advertisements` storage bucket (public read for active display, admin-only write)

## Security
- RLS enabled on `advertisements`
- Public (anon, authenticated) can SELECT active ads only
- Only admin users (is_admin = true) can INSERT, UPDATE, DELETE
- Storage bucket: public read, admin-only write via policies
*/

CREATE TABLE IF NOT EXISTS advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
  button_text text,
  button_link text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Public can read active ads only
DROP POLICY IF EXISTS "public_read_active_ads" ON advertisements;
CREATE POLICY "public_read_active_ads"
  ON advertisements FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admins can read all ads (including inactive)
DROP POLICY IF EXISTS "admin_read_all_ads" ON advertisements;
CREATE POLICY "admin_read_all_ads"
  ON advertisements FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admins can insert ads
DROP POLICY IF EXISTS "admin_insert_ads" ON advertisements;
CREATE POLICY "admin_insert_ads"
  ON advertisements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admins can update ads
DROP POLICY IF EXISTS "admin_update_ads" ON advertisements;
CREATE POLICY "admin_update_ads"
  ON advertisements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admins can delete ads
DROP POLICY IF EXISTS "admin_delete_ads" ON advertisements;
CREATE POLICY "admin_delete_ads"
  ON advertisements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Create storage bucket for advertisement media
INSERT INTO storage.buckets (id, name, public)
VALUES ('advertisements', 'advertisements', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, admin-only write
DROP POLICY IF EXISTS "public_read_ad_media" ON storage.objects;
CREATE POLICY "public_read_ad_media"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'advertisements');

DROP POLICY IF EXISTS "admin_upload_ad_media" ON storage.objects;
CREATE POLICY "admin_upload_ad_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'advertisements'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "admin_update_ad_media" ON storage.objects;
CREATE POLICY "admin_update_ad_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'advertisements'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "admin_delete_ad_media" ON storage.objects;
CREATE POLICY "admin_delete_ad_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'advertisements'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Index for sorting active ads
CREATE INDEX IF NOT EXISTS idx_advertisements_active_sort
  ON advertisements (is_active, sort_order, created_at DESC);
