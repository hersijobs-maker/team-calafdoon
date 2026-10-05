/*
# Global Chat Access Management System

## Purpose
Replaces the per-conversation chat unlock model with a global, one-time chat access
that the admin manages. Users pay once, admin approves, and chat is permanently
ACTIVE until the admin explicitly disables it.

## Changes to existing tables
- `profiles`: Add `chat_access_status` column with values:
  - 'locked' (default — new users can't chat)
  - 'pending_payment' (user submitted payment, waiting admin approval)
  - 'active' (admin approved — chat works)
  - 'disabled' (admin disabled — chat blocked, no new payment needed to re-enable)

- `chat_unlock_payments`: Add `is_global` boolean column. Global payments (no specific
  target_user_id) have is_global=true. Legacy per-conversation payments remain unchanged.

## New RPC Functions
- `submit_chat_payment_request(p_transaction_id, p_amount, p_screenshot_url)`:
  Creates a global payment request and sets profile.chat_access_status = 'pending_payment'.
  Enforces: only one pending request at a time per user.
- `admin_approve_chat_access(p_payment_id)`:
  Approves payment, sets chat_access_status = 'active', sends notification.
- `admin_reject_chat_access(p_payment_id)`:
  Rejects payment, sets chat_access_status = 'locked'.
- `admin_disable_chat_access(p_user_id)`:
  Sets chat_access_status = 'disabled', sends notification.
- `admin_enable_chat_access(p_user_id)`:
  Sets chat_access_status = 'active' (no payment needed), sends notification.
- `get_admin_chat_access_list()`:
  Returns all non-admin users with their chat_access_status and payment info.
- `get_my_chat_access_status()`:
  Returns the current user's global chat_access_status.

## Security
- All admin functions are SECURITY DEFINER with is_admin check.
- Users can only submit their own payment request.
- Column-level protection: chat_access_status is NOT user-writable.
- Notifications inserted into connection_notifications table.
*/

-- ============================================================
-- 1. Add chat_access_status to profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'chat_access_status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN chat_access_status text NOT NULL DEFAULT 'locked'
      CHECK (chat_access_status IN ('locked', 'pending_payment', 'active', 'disabled'));
  END IF;
END $$;

-- Update existing approved users to 'active' so we don't break their chat
UPDATE public.profiles SET chat_access_status = 'active'
WHERE registration_status = 'approved' AND is_admin = false
  AND chat_access_status = 'locked';

-- Admins always have active chat
UPDATE public.profiles SET chat_access_status = 'active'
WHERE is_admin = true;

-- ============================================================
-- 2. Add is_global to chat_unlock_payments
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_unlock_payments' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE public.chat_unlock_payments ADD COLUMN is_global boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Make target_user_id nullable for global payments
ALTER TABLE public.chat_unlock_payments ALTER COLUMN target_user_id DROP NOT NULL;

-- ============================================================
-- 3. submit_chat_payment_request — user submits global payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_chat_payment_request(
  p_transaction_id text,
  p_amount numeric DEFAULT 1.00,
  p_screenshot_url text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_pending boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check no pending global payment exists
  SELECT EXISTS(
    SELECT 1 FROM public.chat_unlock_payments
    WHERE user_id = v_user_id AND is_global = true AND status = 'pending'
  ) INTO v_existing_pending;

  IF v_existing_pending THEN
    RAISE EXCEPTION 'Hadda waxaa jira codsi sugita ah';
  END IF;

  -- Insert global payment request
  INSERT INTO public.chat_unlock_payments (user_id, target_user_id, amount, transaction_id, screenshot_url, status, is_global)
  VALUES (v_user_id, NULL, p_amount, p_transaction_id, p_screenshot_url, 'pending', true);

  -- Update profile status to pending_payment
  UPDATE public.profiles SET chat_access_status = 'pending_payment' WHERE id = v_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_chat_payment_request(text, numeric, text) TO authenticated;

-- ============================================================
-- 4. admin_approve_chat_access — approve and activate
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_chat_access(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_payment public.chat_unlock_payments;
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

  -- Approve the payment
  UPDATE public.chat_unlock_payments
  SET status = 'approved', admin_id = auth.uid(), admin_action_at = now(), updated_at = now()
  WHERE id = p_payment_id;

  -- Activate chat access globally
  UPDATE public.profiles SET chat_access_status = 'active' WHERE id = v_payment.user_id;

  -- Send notification
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (v_payment.user_id, auth.uid(), 'chat_access_approved', NULL);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_chat_access(uuid) TO authenticated;

-- ============================================================
-- 5. admin_reject_chat_access — reject, back to locked
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reject_chat_access(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_payment public.chat_unlock_payments;
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
  SET status = 'rejected', admin_id = auth.uid(), admin_action_at = now(), updated_at = now()
  WHERE id = p_payment_id;

  -- Set back to locked
  UPDATE public.profiles SET chat_access_status = 'locked' WHERE id = v_payment.user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_chat_access(uuid) TO authenticated;

-- ============================================================
-- 6. admin_disable_chat_access — disable an active user
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_disable_chat_access(p_user_id uuid)
RETURNS boolean
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

  UPDATE public.profiles SET chat_access_status = 'disabled' WHERE id = p_user_id AND is_admin = false;

  -- Send notification
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (p_user_id, auth.uid(), 'chat_access_disabled', NULL);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_disable_chat_access(uuid) TO authenticated;

-- ============================================================
-- 7. admin_enable_chat_access — re-enable without payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_enable_chat_access(p_user_id uuid)
RETURNS boolean
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

  UPDATE public.profiles SET chat_access_status = 'active' WHERE id = p_user_id AND is_admin = false;

  -- Send notification
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (p_user_id, auth.uid(), 'chat_access_approved', NULL);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enable_chat_access(uuid) TO authenticated;

-- ============================================================
-- 8. get_admin_chat_access_list — all users with chat access info
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_chat_access_list()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  email text,
  chat_access_status text,
  payment_id uuid,
  payment_status text,
  amount numeric,
  transaction_id text,
  screenshot_url text,
  payment_created_at timestamptz
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
    pr.id AS user_id,
    pr.full_name,
    pr.avatar_url,
    pr.email,
    pr.chat_access_status,
    cup.id AS payment_id,
    cup.status AS payment_status,
    cup.amount,
    cup.transaction_id,
    cup.screenshot_url,
    cup.created_at AS payment_created_at
  FROM public.profiles pr
  LEFT JOIN LATERAL (
    SELECT * FROM public.chat_unlock_payments
    WHERE user_id = pr.id AND is_global = true
    ORDER BY created_at DESC LIMIT 1
  ) cup ON true
  WHERE pr.is_admin = false
  ORDER BY
    CASE pr.chat_access_status
      WHEN 'pending_payment' THEN 0
      WHEN 'locked' THEN 1
      WHEN 'disabled' THEN 2
      WHEN 'active' THEN 3
    END,
    pr.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_chat_access_list() TO authenticated;

-- ============================================================
-- 9. get_my_chat_access_status — current user's global status
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_chat_access_status()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT pr.chat_access_status INTO v_status FROM public.profiles pr WHERE pr.id = auth.uid();
  RETURN COALESCE(v_status, 'locked');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_chat_access_status() TO authenticated;

-- ============================================================
-- 10. Add notification type values to connection_notifications
--     The type column is text so new types work without ALTER.
-- ============================================================
