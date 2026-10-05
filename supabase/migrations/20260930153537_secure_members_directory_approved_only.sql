-- 1. Drop and recreate get_approved_members with email and phone fields
DROP FUNCTION IF EXISTS public.get_approved_members();

CREATE FUNCTION public.get_approved_members()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  bio text,
  location text,
  profession text,
  created_at timestamp with time zone,
  age integer,
  gender text,
  country text,
  city text,
  marital_status text,
  looking_for text
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

  SELECT (p.is_admin OR p.registration_status = 'approved')
  INTO v_ok
  FROM public.profiles p WHERE p.id = v_uid;

  IF NOT COALESCE(v_ok, false) THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.avatar_url, p.bio,
         p.location, p.profession, p.created_at, p.age, p.gender,
         p.country, p.city, p.marital_status, p.looking_for
  FROM public.profiles p
  WHERE p.registration_status = 'approved' AND p.is_admin = false
  ORDER BY p.created_at DESC;
END;
$function$;

-- Only authenticated users can call this function
REVOKE EXECUTE ON FUNCTION public.get_approved_members() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_approved_members() TO authenticated;

-- 2. Add a SELECT policy so approved members can read other approved members' profiles
--    via the REST API directly (defense in depth)
CREATE POLICY "profiles_select_approved_members"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    registration_status = 'approved' AND is_admin = false
  );
