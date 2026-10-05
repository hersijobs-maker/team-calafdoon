/*
# Harden login status checks, the members directory and function grants

1. Problems addressed
   - `check_login_access(p_email)` accepted ANY email and returned whether the
     account existed plus its registration status, payment status and administrator
     flag, to anyone holding the public key. An account enumeration oracle.
   - The `profiles_select_approved_members` policy is row level, and row level access
     is all-column access, so every approved member could read every other member's
     email address and phone number through the data API.
   - `admin_approve_user` activated an account without ever checking that the
     registration fee had actually been paid.
   - Every SECURITY DEFINER function was still executable by `anon`, because Postgres
     grants EXECUTE to PUBLIC by default and an earlier revoke targeted only `anon`.

2. New functions
   - `my_login_access()`: returns the CALLER's own registration status, payment status
     and whether they may sign in. No email parameter, keyed on `auth.uid()`.
   - `get_approved_members()`: returns only directory-safe columns
     (id, full_name, avatar_url, bio, location, profession, created_at) and only to a
     caller who is themselves approved and paid.

3. Removed
   - `check_login_access(text)`
   - policy `profiles_select_approved_members`

4. Security notes
   1. EXECUTE is revoked from PUBLIC and anon on every function in `public`, then
      granted to `authenticated` only for the functions the application calls.
   2. Contact details are no longer reachable by other members at all.
   3. Approval now requires a confirmed payment, enforced in the database.
*/

DROP FUNCTION IF EXISTS public.check_login_access(text);

CREATE OR REPLACE FUNCTION public.my_login_access()
RETURNS TABLE(user_id uuid, registration_status text, payment_status text, has_paid boolean, can_login boolean, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_reg_status text;
  v_is_admin boolean;
  v_pay_status text;
  v_has_paid boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT p.registration_status, p.is_admin INTO v_reg_status, v_is_admin
  FROM public.profiles p WHERE p.id = v_uid;

  IF v_reg_status IS NULL THEN
    RETURN;
  END IF;

  SELECT pm.status INTO v_pay_status
  FROM public.payments pm
  WHERE pm.user_id = v_uid AND pm.status = 'paid'
  ORDER BY pm.paid_at DESC LIMIT 1;

  v_has_paid := v_pay_status IS NOT NULL;

  RETURN QUERY SELECT
    v_uid,
    v_reg_status,
    COALESCE(v_pay_status, 'pending'),
    v_has_paid,
    (v_reg_status = 'approved' AND (v_has_paid OR COALESCE(v_is_admin, false))),
    COALESCE(v_is_admin, false);
END;
$function$;

DROP POLICY IF EXISTS "profiles_select_approved_members" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_approved_members()
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  location text,
  profession text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT (
    p.is_admin
    OR (
      p.registration_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.payments pm
        WHERE pm.user_id = v_uid AND pm.status = 'paid'
      )
    )
  ) INTO v_ok
  FROM public.profiles p WHERE p.id = v_uid;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.bio, p.location, p.profession, p.created_at
  FROM public.profiles p
  WHERE p.registration_status = 'approved'
    AND p.is_admin = false
    AND EXISTS (
      SELECT 1 FROM public.payments pm
      WHERE pm.user_id = p.id AND pm.status = 'paid'
    )
  ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_approve_user(target_user_id uuid, notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payments
    WHERE user_id = target_user_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'This registration cannot be approved until the registration fee is paid';
  END IF;

  UPDATE public.profiles
  SET registration_status = 'approved',
      approved_at = now(),
      rejected_at = NULL
  WHERE id = target_user_id;

  INSERT INTO public.approval_history (user_id, admin_id, action, notes)
  VALUES (target_user_id, auth.uid(), 'approved', notes);
END;
$function$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_login_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_registration_payment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_user(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
