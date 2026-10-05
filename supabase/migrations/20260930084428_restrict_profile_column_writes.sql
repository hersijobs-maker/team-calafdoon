/*
# Restrict which profile columns a signed-in user may write

1. Problem
   The `authenticated` role held table-wide UPDATE (and INSERT) on `public.profiles`.
   Row level security only restricts WHICH ROW may be updated, never which columns, so
   any signed-in user could PATCH their own row and set `is_admin = true`,
   `registration_status = 'approved'`, `approved_at`, `rejected_at` or `email`.
   That granted full administrator control and bypassed both payment and admin approval.

2. Changes
   - Revoke table-wide INSERT and UPDATE on `public.profiles` from `authenticated` and `anon`.
   - Re-grant UPDATE only on the user-content columns:
     full_name, phone, avatar_url, bio, location, profession.
   - Drop the now-unnecessary `profiles_insert_own` policy: profile rows are created
     exclusively by the `handle_new_user` trigger, which runs with definer rights.
   - Add a unique index on lower(email) so two profiles can never claim the same
     address in different letter cases.

3. Security notes
   1. SELECT is untouched, so every existing query keeps working.
   2. `is_admin` and `registration_status` can now only change through the
      `admin_*` SECURITY DEFINER functions, which verify the caller is an administrator.
*/

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE ON public.profiles FROM anon;

GRANT UPDATE (full_name, phone, avatar_url, bio, location, profession)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email));
