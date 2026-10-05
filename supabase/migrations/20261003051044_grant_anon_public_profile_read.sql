/*
# Grant anon limited SELECT on profiles for public stories display

Guests need to see the username and avatar of users who post public stories.
We grant SELECT only on non-sensitive columns (id, full_name, avatar_url)
and add an RLS policy that only exposes approved profiles to anon.
*/

-- Grant column-level SELECT to anon on non-sensitive profile fields
GRANT SELECT (id, full_name, avatar_url) ON public.profiles TO anon;

-- Add anon SELECT policy: only approved, non-admin profiles are visible to guests
DROP POLICY IF EXISTS "profiles_select_anon_public" ON public.profiles;
CREATE POLICY "profiles_select_anon_public"
  ON public.profiles FOR SELECT
  TO anon
  USING (registration_status = 'approved' AND is_admin = false);
