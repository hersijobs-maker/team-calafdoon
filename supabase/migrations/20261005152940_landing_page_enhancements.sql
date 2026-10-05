/*
# Landing page enhancements: new members, stats, testimonials, report/block

## Overview
Adds RPC functions and tables to support landing page sections:
- New members carousel
- Real statistics
- Testimonials (only shown if data exists)
- User report and block functionality

## New Tables
1. `testimonials` — user testimonials displayed on landing page
   - id (uuid, PK)
   - user_id (uuid, FK to profiles)
   - content (text, not null)
   - is_approved (boolean, default false — admin must approve)
   - display_name (text, optional — overrides profile name if set)
   - created_at (timestamptz)
2. `user_blocks` — user-to-user block relationships
   - id (uuid, PK)
   - blocker_id (uuid, FK to profiles)
   - blocked_id (uuid, FK to profiles)
   - created_at (timestamptz)
   - UNIQUE(blocker_id, blocked_id)
3. `user_reports` — user reports submitted to admin
   - id (uuid, PK)
   - reporter_id (uuid, FK to profiles)
   - reported_id (uuid, FK to profiles)
   - reason (text, not null)
   - status (text, default 'pending')
   - created_at (timestamptz)

## New Functions
1. `get_new_members(limit int)` — returns 8 newest approved members (id, name, avatar, city, marital_status, bio)
2. `get_site_stats()` — returns approved_count, connection_count, new_this_month_count
3. `get_approved_testimonials()` — returns approved testimonials for landing page
4. `block_user(p_blocked_id uuid)` — blocks a user (SECURITY DEFINER)
5. `report_user(p_reported_id uuid, p_reason text)` — reports a user (SECURITY DEFINER)

## Security
- All new tables have RLS enabled
- testimonials: anyone can read approved, only owner can insert, admin can read all
- user_blocks: owner-scoped CRUD
- user_reports: owner can insert + read own, admin can read all
- Functions use auth.uid() and SECURITY DEFINER where needed
*/

-- =========================================================
-- TESTIMONIALS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "testimonials_select_approved" ON public.testimonials;
CREATE POLICY "testimonials_select_approved"
  ON public.testimonials FOR SELECT TO anon, authenticated
  USING (is_approved = true);

DROP POLICY IF EXISTS "testimonials_select_admin" ON public.testimonials;
CREATE POLICY "testimonials_select_admin"
  ON public.testimonials FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "testimonials_insert_own" ON public.testimonials;
CREATE POLICY "testimonials_insert_own"
  ON public.testimonials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "testimonials_update_own" ON public.testimonials;
CREATE POLICY "testimonials_update_own"
  ON public.testimonials FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- USER BLOCKS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- =========================================================
-- USER REPORTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reports_select_own" ON public.user_reports;
CREATE POLICY "user_reports_select_own"
  ON public.user_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "user_reports_select_admin" ON public.user_reports;
CREATE POLICY "user_reports_select_admin"
  ON public.user_reports FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "user_reports_insert_own" ON public.user_reports;
CREATE POLICY "user_reports_insert_own"
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- =========================================================
-- GRANTS
-- =========================================================
GRANT SELECT, INSERT, UPDATE ON public.testimonials TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT SELECT, INSERT ON public.user_reports TO authenticated;

-- =========================================================
-- FUNCTION: get_new_members
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_new_members(p_limit int DEFAULT 8)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  marital_status text,
  bio text,
  profession text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.city,
    p.marital_status,
    p.bio,
    p.profession
  FROM public.profiles p
  WHERE p.registration_status = 'approved'
    AND p.is_admin = false
  ORDER BY p.approved_at DESC, p.created_at DESC
  LIMIT LEAST(p_limit, 20);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_new_members(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_new_members(int) TO anon, authenticated;

-- =========================================================
-- FUNCTION: get_site_stats
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_site_stats()
RETURNS TABLE(
  approved_count bigint,
  connection_count bigint,
  new_this_month bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles WHERE registration_status = 'approved' AND is_admin = false),
    (SELECT count(*) FROM public.member_connections WHERE status = 'accepted'),
    (SELECT count(*) FROM public.profiles WHERE registration_status = 'approved' AND is_admin = false AND approved_at >= date_trunc('month', now()));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_site_stats() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_stats() TO anon, authenticated;

-- =========================================================
-- FUNCTION: get_approved_testimonials
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_approved_testimonials()
RETURNS TABLE(
  id uuid,
  content text,
  display_name text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.content,
    t.display_name,
    p.full_name,
    p.avatar_url
  FROM public.testimonials t
  JOIN public.profiles p ON p.id = t.user_id
  WHERE t.is_approved = true
  ORDER BY t.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_approved_testimonials() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_testimonials() TO anon, authenticated;

-- =========================================================
-- FUNCTION: block_user
-- =========================================================
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_uid = p_blocked_id THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_uid, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Also remove any connection between them
  DELETE FROM public.member_connections
  WHERE (requester_id = v_uid AND recipient_id = p_blocked_id)
     OR (requester_id = p_blocked_id AND recipient_id = v_uid);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- =========================================================
-- FUNCTION: report_user
-- =========================================================
CREATE OR REPLACE FUNCTION public.report_user(p_reported_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_uid = p_reported_id THEN RAISE EXCEPTION 'Cannot report yourself'; END IF;
  IF btrim(p_reason) = '' THEN RAISE EXCEPTION 'Reason is required'; END IF;

  INSERT INTO public.user_reports (reporter_id, reported_id, reason)
  VALUES (v_uid, p_reported_id, p_reason);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.report_user(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text) TO authenticated;

-- =========================================================
-- FUNCTION: is_blocked_by_me (helper for profile page)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_blocked_by_me(p_blocked_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = v_uid AND blocked_id = p_blocked_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_blocked_by_me(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_by_me(uuid) TO authenticated;
