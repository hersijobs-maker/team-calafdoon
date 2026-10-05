/*
# Team Calafdoon: add marriage matching fields and blocked status

1. New profile columns: age, gender, country, city, marital_status, looking_for
2. Registration status: add 'blocked' to allowed values
3. Updated functions: admin_approve_user (no payment check), admin_block_user (new),
   admin_unblock_user (new), my_login_access (no payment, checks blocked),
   get_approved_members (returns new fields, no payment check), handle_new_user (stores new fields)
4. Column-level UPDATE grant extended to include new user-content columns
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS looking_for text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_registration_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_registration_status_check
  CHECK (registration_status IN ('pending_approval', 'approved', 'rejected', 'blocked'));

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, bio, location, profession,
              age, gender, country, city, marital_status, looking_for)
  ON public.profiles TO authenticated;

ALTER TABLE public.approval_history
  DROP CONSTRAINT IF EXISTS approval_history_action_check;
ALTER TABLE public.approval_history
  ADD CONSTRAINT approval_history_action_check
  CHECK (action IN ('approved', 'rejected', 'blocked', 'unblocked'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, age, gender, country, city, marital_status, looking_for, bio)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'age', '')::int,
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'country',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'marital_status',
    NEW.raw_user_meta_data->>'looking_for',
    NEW.raw_user_meta_data->>'bio'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

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
  UPDATE public.profiles
  SET registration_status = 'approved', approved_at = now(), rejected_at = NULL
  WHERE id = target_user_id;
  INSERT INTO public.approval_history (user_id, admin_id, action, notes)
  VALUES (target_user_id, auth.uid(), 'approved', notes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reject_user(target_user_id uuid, reason text DEFAULT NULL::text, notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE public.profiles
  SET registration_status = 'rejected', rejected_at = now(), approved_at = NULL
  WHERE id = target_user_id;
  INSERT INTO public.approval_history (user_id, admin_id, action, reason, notes)
  VALUES (target_user_id, auth.uid(), 'rejected', reason, notes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_block_user(target_user_id uuid, reason text DEFAULT NULL::text, notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE public.profiles
  SET registration_status = 'blocked', rejected_at = now()
  WHERE id = target_user_id;
  INSERT INTO public.approval_history (user_id, admin_id, action, reason, notes)
  VALUES (target_user_id, auth.uid(), 'blocked', reason, notes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_unblock_user(target_user_id uuid, notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE public.profiles
  SET registration_status = 'pending_approval', rejected_at = NULL, approved_at = NULL
  WHERE id = target_user_id;
  INSERT INTO public.approval_history (user_id, admin_id, action, notes)
  VALUES (target_user_id, auth.uid(), 'unblocked', notes);
END;
$function$;

DROP FUNCTION IF EXISTS public.my_login_access();

CREATE FUNCTION public.my_login_access()
RETURNS TABLE(user_id uuid, registration_status text, can_login boolean, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_reg_status text;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT p.registration_status, p.is_admin INTO v_reg_status, v_is_admin
  FROM public.profiles p WHERE p.id = v_uid;
  IF v_reg_status IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT
    v_uid, v_reg_status,
    (v_reg_status = 'approved' OR COALESCE(v_is_admin, false)),
    COALESCE(v_is_admin, false);
END;
$function$;

DROP FUNCTION IF EXISTS public.get_approved_members();

CREATE FUNCTION public.get_approved_members()
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, bio text, location text, profession text,
  created_at timestamptz, age integer, gender text, country text, city text,
  marital_status text, looking_for text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT (p.is_admin OR p.registration_status = 'approved') INTO v_ok
  FROM public.profiles p WHERE p.id = v_uid;
  IF NOT COALESCE(v_ok, false) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.bio, p.location, p.profession,
         p.created_at, p.age, p.gender, p.country, p.city, p.marital_status, p.looking_for
  FROM public.profiles p
  WHERE p.registration_status = 'approved' AND p.is_admin = false
  ORDER BY p.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_login_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unblock_user(uuid, text) TO authenticated;
