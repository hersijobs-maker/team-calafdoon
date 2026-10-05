/*
# Language Settings System

## Purpose
Adds a multi-language system to TeamCalafdoon. The admin can set the website's
default language (Somali, English, Arabic). Each user can also choose their own
preferred language. Arabic triggers RTL layout.

## Changes
1. app_settings: insert a default language key ('default_language' = 'so')
2. profiles: add preferred_language column (text, default NULL)
3. RPC: get_default_language() — returns the default language from app_settings
4. RPC: set_default_language(p_language) — admin-only, updates app_settings
5. RPC: set_user_language(p_language) — sets the current user's preferred language
6. Security: only admin can set default language; any authenticated user can set their own

## Supported languages
- 'so' = Somali (default)
- 'en' = English
- 'ar' = Arabic (RTL)
*/

-- 1. Insert default language setting if not exists
INSERT INTO public.app_settings (key, value)
SELECT 'default_language', 'so'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE key = 'default_language'
);

-- 2. Add preferred_language column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;

-- 3. get_default_language — anyone can read (for the website to work)
CREATE OR REPLACE FUNCTION public.get_default_language()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  SELECT value INTO v_value FROM public.app_settings WHERE key = 'default_language';
  RETURN COALESCE(v_value, 'so');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_language() TO anon, authenticated;

-- 4. set_default_language — admin only
CREATE OR REPLACE FUNCTION public.set_default_language(p_language text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_language NOT IN ('so', 'en', 'ar') THEN
    RAISE EXCEPTION 'Unsupported language';
  END IF;

  INSERT INTO public.app_settings (key, value)
  VALUES ('default_language', p_language)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_language(text) TO authenticated;

-- 5. set_user_language — any authenticated user can set their own
CREATE OR REPLACE FUNCTION public.set_user_language(p_language text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_language NOT IN ('so', 'en', 'ar') THEN
    RAISE EXCEPTION 'Unsupported language';
  END IF;

  UPDATE public.profiles SET preferred_language = p_language WHERE id = auth.uid();
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_language(text) TO authenticated;
