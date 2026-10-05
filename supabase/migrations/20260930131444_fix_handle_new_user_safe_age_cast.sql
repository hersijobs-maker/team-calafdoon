-- Fix: Make the handle_new_user trigger robust against non-integer age values.
-- The form uses <input type="number"> which can send decimal strings like "25.5".
-- The cast NULLIF(...->>'age', '')::int fails on non-integer strings, which rolls back
-- the entire auth.users insert and causes a "Database error creating new user" error.
-- Fix: use a regex check to only cast to int when the value is a valid integer string.
-- Also handle the case where age is a decimal by truncating to integer.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_age_str text;
  v_age_int int;
BEGIN
  v_age_str := NEW.raw_user_meta_data->>'age';

  -- Only cast to int if the string is a valid integer
  -- This handles: NULL, '', '25', '25.5' (truncates to 25), 'abc' (becomes NULL)
  IF v_age_str IS NOT NULL AND v_age_str ~ '^\d+$' THEN
    v_age_int := v_age_str::int;
  ELSIF v_age_str IS NOT NULL AND v_age_str ~ '^\d+\.\d+$' THEN
    -- Decimal: truncate to integer
    v_age_int := substring(v_age_str from '^\d+')::int;
  ELSE
    v_age_int := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, phone, age, gender, country, city,
    marital_status, looking_for, bio
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_age_int,
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

-- Ensure the trigger is still attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
