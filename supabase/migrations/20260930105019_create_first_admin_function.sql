-- Create first admin account from scratch (Team Calafdoon)
-- Creates a new auth user + admin profile in one shot, protected by a setup key.
-- Only works if NO admin account exists yet (first-run only).

CREATE OR REPLACE FUNCTION public.create_first_admin(
  p_setup_key text,
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_stored_key text;
  v_existing_admin_count int;
  v_new_user_id uuid;
BEGIN
  -- Verify the setup key
  SELECT value INTO v_stored_key FROM public.app_settings WHERE key = 'admin_setup_key';
  IF v_stored_key IS NULL OR v_stored_key != p_setup_key THEN
    RAISE EXCEPTION 'Invalid setup key';
  END IF;

  -- Only allow if no admin exists yet
  SELECT count(*) INTO v_existing_admin_count FROM public.profiles WHERE is_admin = true;
  IF v_existing_admin_count > 0 THEN
    RAISE EXCEPTION 'An admin account already exists. Use the reset page instead.';
  END IF;

  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  -- Check email not already in use
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(p_email)) THEN
    RAISE EXCEPTION 'An account with this email already exists';
  END IF;

  -- Create auth user
  v_new_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name)
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', lower(p_email)),
    'email',
    now(), now(), now()
  );

  -- Create admin profile
  INSERT INTO public.profiles (
    id, full_name, email, is_admin, registration_status, created_at, approved_at
  ) VALUES (
    v_new_user_id, p_full_name, lower(p_email), true, 'approved', now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    is_admin = true,
    registration_status = 'approved',
    approved_at = now();

  -- Invalidate the setup key so it can never be reused
  UPDATE public.app_settings
  SET value = 'USED-' || gen_random_uuid()::text
  WHERE key = 'admin_setup_key';

  RETURN v_new_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_first_admin FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_first_admin TO authenticated;
