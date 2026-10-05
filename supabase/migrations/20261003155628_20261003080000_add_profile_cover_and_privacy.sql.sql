/*
# Add cover photo and profile detail privacy columns

1. New Columns on `public.profiles`
   - `cover_photo_url` (text, nullable) — URL of the user's cover/banner image stored in Supabase Storage.
   - `family_info` (text, nullable) — Optional free-text family information the user chooses to share.
   - `show_gender` (boolean, default true) — Whether the user's gender is visible to others.
   - `show_age` (boolean, default true) — Whether the user's age is visible to others.
   - `show_marital_status` (boolean, default true) — Whether the user's marital status is visible to others.
   - `show_phone` (boolean, default false) — Whether the user's phone number is visible to others.
   - `show_location` (boolean, default true) — Whether the user's country/city is visible to others.

2. Security Changes
   - Re-grant UPDATE on `public.profiles` to include the new user-editable columns:
     `cover_photo_url`, `family_info`, `show_gender`, `show_age`, `show_marital_status`,
     `show_phone`, `show_location`.
   - These columns contain no privileged data (no admin flags, no status fields) so they are
     safe for user self-edit. The existing `profiles_update_own` RLS policy already ensures
     a user can only UPDATE their own row (auth.uid() = id).
   - SELECT on profiles is unchanged — existing policies allow users to read their own row
     and approved members' rows. The frontend will respect the `show_*` flags to decide
     which fields to display to other users.

3. Notes
   - No data is lost — all new columns are nullable or have safe defaults.
   - The `avatars` storage bucket already exists for profile pictures; a new `cover-photos`
     bucket will be created in a separate migration.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_photo_url text,
  ADD COLUMN IF NOT EXISTS family_info text,
  ADD COLUMN IF NOT EXISTS show_gender boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_age boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_marital_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_location boolean NOT NULL DEFAULT true;

-- Expand the column-level UPDATE grant to include the new user-editable columns.
-- The previous grant covered: full_name, phone, avatar_url, bio, location, profession.
-- We re-grant the full safe set in one statement.
GRANT UPDATE (
  full_name, phone, avatar_url, bio, location, profession,
  age, gender, country, city, marital_status, looking_for,
  cover_photo_url, family_info,
  show_gender, show_age, show_marital_status, show_phone, show_location
) ON public.profiles TO authenticated;