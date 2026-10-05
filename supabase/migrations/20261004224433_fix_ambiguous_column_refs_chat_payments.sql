/*
# Fix ambiguous column references in chat unlock payment RPC functions

## Problem
The `get_all_chat_unlock_payments()` function declares `RETURNS TABLE(id uuid, user_id uuid, target_user_id uuid, ...)`.
Inside the function body, the admin check query `SELECT is_admin FROM profiles WHERE id = auth.uid()`
has an ambiguous `id` — Postgres can't tell if it refers to the PL/pgSQL output variable `id` or `profiles.id`.
This causes: `ERROR: column reference "id" is ambiguous`.

The same ambiguity affects every SECURITY DEFINER function in the chat unlock system that has
output column names matching `profiles` columns (id, user_id, etc.) and references unqualified
`profiles.id` or `profiles.is_admin` in inner queries.

## Fix
Recreate all affected functions with fully-qualified column references:
- `profiles.id` instead of bare `id`
- `profiles.is_admin` instead of bare `is_admin`
- Table-aliased columns in all JOIN queries

## Functions fixed
- get_all_chat_unlock_payments()
- get_pending_chat_payments()  (legacy, may still be called)
- get_chat_access_status(uuid)
- admin_approve_chat_payment(uuid, text, int, timestamptz, uuid[])
- admin_reject_chat_payment(uuid)
- get_chat_access_selected_user_names(uuid)
- get_approved_users_for_selection()
*/

-- ============================================================
-- 1. get_all_chat_unlock_payments (admin only, all statuses)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_all_chat_unlock_payments();

CREATE OR REPLACE FUNCTION public.get_all_chat_unlock_payments()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  target_user_id uuid,
  user_name text,
  user_avatar_url text,
  target_name text,
  target_avatar_url text,
  amount numeric,
  currency text,
  transaction_id text,
  screenshot_url text,
  status text,
  admin_id uuid,
  admin_name text,
  admin_action_at timestamptz,
  chat_access_type text,
  access_start_date timestamptz,
  access_end_date timestamptz,
  access_duration_months int,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.target_user_id,
    u.full_name AS user_name,
    u.avatar_url AS user_avatar_url,
    t.full_name AS target_name,
    t.avatar_url AS target_avatar_url,
    p.amount,
    p.currency,
    p.transaction_id,
    p.screenshot_url,
    p.status,
    p.admin_id,
    a.full_name AS admin_name,
    p.admin_action_at,
    p.chat_access_type,
    p.access_start_date,
    p.access_end_date,
    p.access_duration_months,
    p.created_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  JOIN public.profiles t ON t.id = p.target_user_id
  LEFT JOIN public.profiles a ON a.id = p.admin_id
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================
-- 2. get_pending_chat_payments (admin only, pending only — legacy)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_pending_chat_payments();

CREATE OR REPLACE FUNCTION public.get_pending_chat_payments()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  target_user_id uuid,
  user_name text,
  target_name text,
  amount numeric,
  currency text,
  transaction_id text,
  screenshot_url text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.target_user_id,
    u.full_name AS user_name,
    t.full_name AS target_name,
    p.amount,
    p.currency,
    p.transaction_id,
    p.screenshot_url,
    p.status,
    p.created_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  JOIN public.profiles t ON t.id = p.target_user_id
  WHERE p.status = 'pending'
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================
-- 3. get_chat_access_status — fix ambiguous id
-- ============================================================
DROP FUNCTION IF EXISTS public.get_chat_access_status(uuid);

CREATE OR REPLACE FUNCTION public.get_chat_access_status(p_target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_status text;
  v_pending_exists boolean;
BEGIN
  SELECT ca.status INTO v_access_status
  FROM public.chat_access ca
  WHERE ca.user_id = auth.uid() AND ca.target_user_id = p_target_user_id;

  IF v_access_status = 'unlocked' THEN
    RETURN 'unlocked';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.chat_unlock_payments cup
    WHERE cup.user_id = auth.uid()
      AND cup.target_user_id = p_target_user_id
      AND cup.status = 'pending'
  ) INTO v_pending_exists;

  IF v_pending_exists THEN
    RETURN 'pending';
  END IF;

  RETURN 'locked';
END;
$$;

-- ============================================================
-- 4. admin_approve_chat_payment — fix ambiguous id + full params
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_approve_chat_payment(uuid);

CREATE OR REPLACE FUNCTION public.admin_approve_chat_payment(
  p_payment_id uuid,
  p_access_type text DEFAULT 'requested_only',
  p_duration_months int DEFAULT NULL,
  p_custom_end_date timestamptz DEFAULT NULL,
  p_selected_user_ids uuid[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.chat_unlock_payments;
  v_is_admin boolean;
  v_end_date timestamptz;
  v_access_id uuid;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_payment FROM public.chat_unlock_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;

  -- Calculate end date
  IF p_custom_end_date IS NOT NULL THEN
    v_end_date := p_custom_end_date;
  ELSIF p_duration_months IS NOT NULL THEN
    v_end_date := now() + make_interval(months => p_duration_months);
  ELSE
    v_end_date := now() + interval '3 months';
  END IF;

  -- Update payment with access details
  UPDATE public.chat_unlock_payments
  SET status = 'approved',
      admin_id = auth.uid(),
      admin_action_at = now(),
      chat_access_type = p_access_type,
      access_start_date = now(),
      access_end_date = v_end_date,
      access_duration_months = p_duration_months,
      updated_at = now()
  WHERE id = p_payment_id;

  -- Insert or update chat_access to unlocked
  INSERT INTO public.chat_access (user_id, target_user_id, payment_id, status)
  VALUES (v_payment.user_id, v_payment.target_user_id, p_payment_id, 'unlocked')
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET status = 'unlocked', payment_id = p_payment_id
  RETURNING id INTO v_access_id;

  -- If selected_users, insert into chat_access_selected_users
  IF p_access_type = 'selected_users' AND p_selected_user_ids IS NOT NULL AND array_length(p_selected_user_ids, 1) > 0 THEN
    DELETE FROM public.chat_access_selected_users WHERE chat_access_id = v_access_id;
    INSERT INTO public.chat_access_selected_users (chat_access_id, selected_user_id)
    SELECT v_access_id, unnest(p_selected_user_ids)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

-- ============================================================
-- 5. admin_reject_chat_payment — fix ambiguous id
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_reject_chat_payment(uuid);

CREATE OR REPLACE FUNCTION public.admin_reject_chat_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.chat_unlock_payments;
  v_is_admin boolean;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_payment FROM public.chat_unlock_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;

  UPDATE public.chat_unlock_payments
  SET status = 'rejected',
      admin_id = auth.uid(),
      admin_action_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.chat_access (user_id, target_user_id, payment_id, status)
  VALUES (v_payment.user_id, v_payment.target_user_id, p_payment_id, 'locked')
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET status = 'locked', payment_id = p_payment_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 6. get_chat_access_selected_user_names — fix ambiguous id
-- ============================================================
DROP FUNCTION IF EXISTS public.get_chat_access_selected_user_names(uuid);

CREATE OR REPLACE FUNCTION public.get_chat_access_selected_user_names(p_payment_id uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    casu.selected_user_id AS user_id,
    pr.full_name,
    pr.avatar_url
  FROM public.chat_access_selected_users casu
  JOIN public.chat_access ca ON ca.id = casu.chat_access_id
  JOIN public.chat_unlock_payments cup ON cup.id = ca.payment_id
  JOIN public.profiles pr ON pr.id = casu.selected_user_id
  WHERE cup.id = p_payment_id;
END;
$$;

-- ============================================================
-- 7. get_approved_users_for_selection — fix ambiguous id
-- ============================================================
DROP FUNCTION IF EXISTS public.get_approved_users_for_selection();

CREATE OR REPLACE FUNCTION public.get_approved_users_for_selection()
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.full_name,
    pr.avatar_url
  FROM public.profiles pr
  WHERE pr.registration_status = 'approved'
    AND pr.is_admin = false
  ORDER BY pr.full_name;
END;
$$;

-- ============================================================
-- 8. Re-grant execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_all_chat_unlock_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_chat_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_access_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_chat_payment(uuid, text, int, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_chat_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_access_selected_user_names(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_users_for_selection() TO authenticated;
