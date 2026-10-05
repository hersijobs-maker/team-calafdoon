/*
# Extend Chat Unlock Payment System: Access Types, Duration, Selected Users

## Purpose
Enhances the existing chat unlock payment system so the admin can choose:
1. Requested User Only — user can chat only with the specific person they requested
2. All Approved Users — user can chat with all approved users
3. Selected Users — admin manually picks specific users the payment unlocks

The admin also chooses a duration (1, 2, 3, 6, 12 months, or custom).
Chat access automatically expires after the end date.

## Changes to existing tables

### chat_unlock_payments — new columns
- chat_access_type (text, nullable) — 'requested_only' | 'all_approved' | 'selected_users'
- access_start_date (timestamptz, nullable)
- access_end_date (timestamptz, nullable)
- access_duration_months (int, nullable)

### chat_access — new columns
- access_type (text, nullable)
- start_date (timestamptz, nullable)
- end_date (timestamptz, nullable)

## New table
### chat_access_selected_users
Stores specific users selected by admin when access_type = 'selected_users'.
- id (uuid, PK)
- chat_access_id (uuid, FK to chat_access.id ON DELETE CASCADE)
- selected_user_id (uuid, FK to auth.users ON DELETE CASCADE)
- created_at (timestamptz)

## RPC functions
- admin_approve_chat_payment(p_payment_id, p_access_type, p_duration_months, p_custom_end_date, p_selected_user_ids)
- admin_reject_chat_payment(p_payment_id)
- get_chat_access_status(p_target_user_id) — checks expiry, access type, selected users
- get_all_chat_unlock_payments() — now includes access type columns
- get_my_chat_access_summary() — returns user's current access info
- get_approved_users_for_selection() — admin only, returns approved users for selection

## Security
- Only admin can call approve/reject functions
- Users cannot modify access_type, selected_users, duration, or expiry
- chat_access_selected_users has no user INSERT/UPDATE/DELETE policies
*/

-- ============================================================
-- 1. Add columns to chat_unlock_payments
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_unlock_payments' AND column_name = 'chat_access_type') THEN
    ALTER TABLE public.chat_unlock_payments ADD COLUMN chat_access_type text CHECK (chat_access_type IN ('requested_only', 'all_approved', 'selected_users'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_unlock_payments' AND column_name = 'access_start_date') THEN
    ALTER TABLE public.chat_unlock_payments ADD COLUMN access_start_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_unlock_payments' AND column_name = 'access_end_date') THEN
    ALTER TABLE public.chat_unlock_payments ADD COLUMN access_end_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_unlock_payments' AND column_name = 'access_duration_months') THEN
    ALTER TABLE public.chat_unlock_payments ADD COLUMN access_duration_months int;
  END IF;
END $$;

-- ============================================================
-- 2. Add columns to chat_access
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_access' AND column_name = 'access_type') THEN
    ALTER TABLE public.chat_access ADD COLUMN access_type text CHECK (access_type IN ('requested_only', 'all_approved', 'selected_users'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_access' AND column_name = 'start_date') THEN
    ALTER TABLE public.chat_access ADD COLUMN start_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_access' AND column_name = 'end_date') THEN
    ALTER TABLE public.chat_access ADD COLUMN end_date timestamptz;
  END IF;
END $$;

-- ============================================================
-- 3. Create chat_access_selected_users table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_access_selected_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_access_id uuid NOT NULL REFERENCES public.chat_access(id) ON DELETE CASCADE,
  selected_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_access_selected_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_access_selected" ON public.chat_access_selected_users;
CREATE POLICY "select_own_chat_access_selected"
  ON public.chat_access_selected_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.chat_access WHERE chat_access.id = chat_access_id AND chat_access.user_id = auth.uid())
  );

-- ============================================================
-- 4. admin_approve_chat_payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_chat_payment(
  p_payment_id uuid,
  p_access_type text,
  p_duration_months int,
  p_custom_end_date timestamptz,
  p_selected_user_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.chat_unlock_payments;
  v_is_admin boolean;
  v_start_date timestamptz := now();
  v_end_date timestamptz;
  v_access_id uuid;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_access_type NOT IN ('requested_only', 'all_approved', 'selected_users') THEN
    RAISE EXCEPTION 'Invalid access type';
  END IF;

  SELECT * INTO v_payment FROM public.chat_unlock_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;

  IF p_duration_months IS NOT NULL AND p_duration_months > 0 THEN
    v_end_date := v_start_date + make_interval(months => p_duration_months);
  ELSIF p_custom_end_date IS NOT NULL THEN
    v_end_date := p_custom_end_date;
  ELSE
    v_end_date := v_start_date + interval '1 month';
  END IF;

  UPDATE public.chat_unlock_payments
  SET status = 'approved',
      admin_id = auth.uid(),
      admin_action_at = now(),
      chat_access_type = p_access_type,
      access_start_date = v_start_date,
      access_end_date = v_end_date,
      access_duration_months = p_duration_months,
      updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.chat_access (user_id, target_user_id, payment_id, status, access_type, start_date, end_date)
  VALUES (
    v_payment.user_id,
    v_payment.target_user_id,
    p_payment_id,
    'unlocked',
    p_access_type,
    v_start_date,
    v_end_date
  )
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET
    status = 'unlocked',
    payment_id = p_payment_id,
    access_type = p_access_type,
    start_date = v_start_date,
    end_date = v_end_date
  RETURNING id INTO v_access_id;

  IF p_access_type = 'selected_users' THEN
    DELETE FROM public.chat_access_selected_users WHERE chat_access_id = v_access_id;
    IF p_selected_user_ids IS NOT NULL THEN
      INSERT INTO public.chat_access_selected_users (chat_access_id, selected_user_id)
      SELECT v_access_id, unnest(p_selected_user_ids)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- ============================================================
-- 5. admin_reject_chat_payment
-- ============================================================
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
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
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
-- 6. get_chat_access_status — checks access type, expiry, selected users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_chat_access_status(p_target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access public.chat_access;
  v_has_pending boolean;
  v_is_selected boolean;
BEGIN
  SELECT * INTO v_access
  FROM public.chat_access
  WHERE user_id = auth.uid() AND target_user_id = p_target_user_id;

  IF FOUND AND v_access.status = 'unlocked' THEN
    IF v_access.end_date IS NOT NULL AND now() > v_access.end_date THEN
      RETURN 'locked';
    END IF;

    IF v_access.access_type = 'all_approved' THEN
      RETURN 'unlocked';
    ELSIF v_access.access_type = 'requested_only' THEN
      IF v_access.target_user_id = p_target_user_id THEN
        RETURN 'unlocked';
      END IF;
      RETURN 'locked';
    ELSIF v_access.access_type = 'selected_users' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.chat_access_selected_users
        WHERE chat_access_id = v_access.id AND selected_user_id = p_target_user_id
      ) INTO v_is_selected;

      IF v_is_selected OR v_access.target_user_id = p_target_user_id THEN
        RETURN 'unlocked';
      END IF;
      RETURN 'locked';
    ELSE
      IF v_access.target_user_id = p_target_user_id THEN
        RETURN 'unlocked';
      END IF;
      RETURN 'locked';
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.chat_unlock_payments
    WHERE user_id = auth.uid()
      AND target_user_id = p_target_user_id
      AND status = 'pending'
  ) INTO v_has_pending;

  IF v_has_pending THEN
    RETURN 'pending';
  END IF;

  RETURN 'locked';
END;
$$;

-- ============================================================
-- 7. get_my_chat_access_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_chat_access_summary()
RETURNS TABLE(
  access_type text,
  target_user_id uuid,
  start_date timestamptz,
  end_date timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.access_type,
    ca.target_user_id,
    ca.start_date,
    ca.end_date,
    ca.status
  FROM public.chat_access ca
  WHERE ca.user_id = auth.uid() AND ca.status = 'unlocked'
  ORDER BY ca.start_date DESC;
END;
$$;

-- ============================================================
-- 8. get_all_chat_unlock_payments — with new columns
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_chat_unlock_payments()
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
  admin_id uuid,
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
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
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
    p.admin_id,
    p.admin_action_at,
    p.chat_access_type,
    p.access_start_date,
    p.access_end_date,
    p.access_duration_months,
    p.created_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  JOIN public.profiles t ON t.id = p.target_user_id
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================
-- 9. get_approved_users_for_selection (admin only)
-- ============================================================
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
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url
  FROM public.profiles p
  WHERE p.registration_status = 'approved' AND p.is_admin = false
  ORDER BY p.full_name;
END;
$$;

-- ============================================================
-- 10. Grant execute
-- ============================================================
GRANT EXECUTE ON FUNCTION public.admin_approve_chat_payment(uuid, text, int, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_chat_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_access_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_chat_unlock_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_chat_access_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_users_for_selection() TO authenticated;
