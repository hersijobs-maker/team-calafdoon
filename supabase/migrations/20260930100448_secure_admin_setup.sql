/*
# Team Calafdoon: secure first-admin setup

Creates a one-time, key-protected function that promotes a normal user
to admin. It only works when NO admin account exists yet, and requires
a secret setup key that the website owner sets directly in the database.

Usage (from the Supabase SQL editor or this MCP):
  SELECT public.setup_first_admin('YOUR_SECRET_KEY_HERE', 'admin@teamcalafdoon.com');

The owner sets the key by running:
  UPDATE public.app_settings SET value = 'your-chosen-secret-key' WHERE key = 'admin_setup_key';

If app_settings doesn't exist, this migration creates it.
*/

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('admin_setup_key', 'calafdoon-admin-2026-setup')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.setup_first_admin(p_setup_key text, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_admin_count int;
  v_target_profile record;
  v_stored_key text;
BEGIN
  -- Check the setup key
  SELECT value INTO v_stored_key FROM public.app_settings WHERE key = 'admin_setup_key';
  IF v_stored_key IS NULL OR v_stored_key != p_setup_key THEN
    RAISE EXCEPTION 'Invalid setup key';
  END IF;

  -- Only allow if no admin exists yet
  SELECT count(*) INTO v_existing_admin_count
  FROM public.profiles WHERE is_admin = true;

  IF v_existing_admin_count > 0 THEN
    RAISE EXCEPTION 'An admin account already exists. This function can only be used once.';
  END IF;

  -- Find the user by email
  SELECT id, email, full_name INTO v_target_profile
  FROM public.profiles WHERE email = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found with email: %', p_email;
  END IF;

  -- Promote to admin and approve
  UPDATE public.profiles
  SET is_admin = true,
      registration_status = 'approved',
      approved_at = now(),
      rejected_at = NULL
  WHERE id = v_target_profile.id;

  -- Invalidate the key so it can never be reused
  UPDATE public.app_settings SET value = 'USED-' || gen_random_uuid()::text WHERE key = 'admin_setup_key';

  RETURN v_target_profile.id::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.setup_first_admin(text, text) FROM authenticated, anon;
