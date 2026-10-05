-- Admin create/edit member functions (Team Calafdoon)
-- Both verify the caller is an admin before proceeding.

-- Create a new auth user + profile from the admin dashboard.
-- Uses the Supabase auth admin API to create the user, then
-- the profile row is populated by the existing trigger or directly here.
CREATE OR REPLACE FUNCTION public.admin_create_member(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text DEFAULT '',
  p_age int DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_profession text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_looking_for text DEFAULT NULL,
  p_registration_status text DEFAULT 'approved'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin bool;
  v_new_user_id uuid;
  v_status text;
BEGIN
  -- Verify caller is admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Validate status
  v_status := COALESCE(p_registration_status, 'approved');
  IF v_status NOT IN ('pending_approval','approved','rejected','blocked') THEN
    RAISE EXCEPTION 'Invalid registration status';
  END IF;

  -- Validate minimum inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  -- Create the auth user (email confirmation off)
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

  -- Insert profile (the trigger may also try, so ON CONFLICT handles it)
  INSERT INTO public.profiles (
    id, full_name, email, phone, age, gender, country, city,
    marital_status, profession, bio, looking_for,
    registration_status, is_admin, created_at,
    approved_at
  ) VALUES (
    v_new_user_id, p_full_name, lower(p_email), COALESCE(p_phone, ''),
    p_age, p_gender, p_country, p_city,
    p_marital_status, p_profession, p_bio, p_looking_for,
    v_status, false, now(),
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    marital_status = EXCLUDED.marital_status,
    profession = EXCLUDED.profession,
    bio = EXCLUDED.bio,
    looking_for = EXCLUDED.looking_for,
    registration_status = EXCLUDED.registration_status;

  RETURN v_new_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_create_member FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_member TO authenticated;

-- Edit an existing member's profile fields (not password).
CREATE OR REPLACE FUNCTION public.admin_edit_member(
  p_target_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_age int DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_profession text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_looking_for text DEFAULT NULL,
  p_registration_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin bool;
  v_status text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_registration_status IS NOT NULL THEN
    v_status := p_registration_status;
    IF v_status NOT IN ('pending_approval','approved','rejected','blocked') THEN
      RAISE EXCEPTION 'Invalid registration status';
    END IF;
  END IF;

  -- Prevent editing own admin account
  IF p_target_user_id = v_admin_id THEN
    RAISE EXCEPTION 'Cannot edit your own admin account here';
  END IF;

  UPDATE public.profiles SET
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    age = COALESCE(p_age, age),
    gender = COALESCE(p_gender, gender),
    country = COALESCE(p_country, country),
    city = COALESCE(p_city, city),
    marital_status = COALESCE(p_marital_status, marital_status),
    profession = COALESCE(p_profession, profession),
    bio = COALESCE(p_bio, bio),
    looking_for = COALESCE(p_looking_for, looking_for),
    registration_status = COALESCE(p_registration_status, registration_status),
    approved_at = CASE
      WHEN COALESCE(p_registration_status, registration_status) = 'approved' AND approved_at IS NULL THEN now()
      ELSE approved_at
    END,
    rejected_at = CASE
      WHEN COALESCE(p_registration_status, registration_status) = 'rejected' AND rejected_at IS NULL THEN now()
      ELSE rejected_at
    END
  WHERE id = p_target_user_id AND is_admin = false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_edit_member FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_member TO authenticated;
