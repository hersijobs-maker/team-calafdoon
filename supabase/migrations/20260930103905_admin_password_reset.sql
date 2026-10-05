-- Secure admin password reset function (Team Calafdoon)
-- Allows the website owner to reset the admin password using a secret key.
-- The key is stored in app_settings and rotated after each use.

-- Insert a reset key (owner should change this via SQL)
INSERT INTO public.app_settings (key, value)
VALUES ('admin_reset_key', 'calafdoon-reset-2026')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reset_admin_password(
  p_reset_key text,
  p_email text,
  p_new_password text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_stored_key text;
  v_target_id uuid;
  v_is_admin bool;
BEGIN
  -- Verify the reset key
  SELECT value INTO v_stored_key FROM public.app_settings WHERE key = 'admin_reset_key';
  IF v_stored_key IS NULL OR v_stored_key != p_reset_key THEN
    RAISE EXCEPTION 'Invalid reset key';
  END IF;

  -- Validate password length
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  -- Find the admin account by email
  SELECT id, is_admin INTO v_target_id, v_is_admin
  FROM public.profiles WHERE email = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No account found with email: %', p_email;
  END IF;

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'This account is not an admin';
  END IF;

  -- Update the password in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now(),
      email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = v_target_id;

  -- Rotate the key so it can never be reused
  UPDATE public.app_settings
  SET value = 'USED-' || gen_random_uuid()::text
  WHERE key = 'admin_reset_key';

  -- Generate a new random key for next time and store it
  INSERT INTO public.app_settings (key, value)
  VALUES ('admin_reset_key', 'reset-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN v_target_id::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reset_admin_password FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_admin_password TO authenticated;
