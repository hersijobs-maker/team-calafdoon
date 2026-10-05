/*
# Chat Payment & Admin Approval System

## Purpose
Replaces the previous chat request system with a payment-based flow:
1. User clicks "Fariin $1" → sees payment instructions (send $1 to 617786240)
2. User uploads screenshot proof of payment → submits → status = PENDING
3. Admin sees the pending payment request in the Chats section
4. Admin reviews screenshot, then selects ONE / SEVERAL / EVERYONE to approve
5. Admin clicks Approve → selected pairs get chat access (conversation created)
6. Non-selected pairs remain locked

## New Table: chat_access_grants
- id (uuid PK)
- user_id (uuid FK profiles) — the paying user
- target_id (uuid FK profiles) — the member they can chat with
- payment_id (uuid FK chat_unlock_payments) — which payment approved this
- created_at (timestamptz)
- UNIQUE(user_id, target_id) — one grant per pair

## RPC Functions
- submit_chat_payment(p_screenshot_url): user submits payment proof. Creates
  a chat_unlock_payments row with status='pending', is_global=false, target_user_id=NULL.
  Returns the payment ID.
- get_my_payment_status(): returns the current user's latest payment request status.
- get_chat_access_for_target(p_target_id): returns boolean — does the current user
  have an active grant to chat with this target?
- get_admin_payment_requests(): returns all payment requests with user info + screenshot
  for the admin dashboard.
- admin_approve_payment_one(p_payment_id, p_target_id): approve for one specific member.
  Creates grant + conversation.
- admin_approve_payment_selected(p_payment_id, p_target_ids[]): approve for several
  members. Creates grants + conversations for each.
- admin_approve_payment_everyone(p_payment_id): approve for all eligible (approved,
  non-admin) members. Creates grants + conversations for each.
- admin_reject_payment(p_payment_id): reject the payment, status='rejected'.
- get_pending_payment_count(): returns count of pending payment requests (for admin badge).

## Security
- RLS on chat_access_grants: users can SELECT only their own grants (as user_id or target_id).
- All admin functions are SECURITY DEFINER with is_admin check.
- Payment screenshots uploaded to the existing 'payment-screenshots' storage bucket.
- Only the paying user can submit their own payment.
*/

-- ============================================================
-- 1. Create chat_access_grants table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.chat_unlock_payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_grant_pair UNIQUE (user_id, target_id),
  CONSTRAINT no_self_grant CHECK (user_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_grants_user ON public.chat_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_grants_target ON public.chat_access_grants(target_id);

ALTER TABLE public.chat_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_grants" ON public.chat_access_grants;
CREATE POLICY "select_own_grants"
ON public.chat_access_grants FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = target_id);

-- ============================================================
-- 2. submit_chat_payment — user submits payment proof
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_chat_payment(p_screenshot_url text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing record;
  v_payment_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_screenshot_url IS NULL OR p_screenshot_url = '' THEN
    RAISE EXCEPTION 'Screenshot is required';
  END IF;

  -- Check for existing pending request
  SELECT id, status INTO v_existing
  FROM public.chat_unlock_payments
  WHERE user_id = v_user_id AND is_global = false AND target_user_id IS NULL
  ORDER BY created_at DESC LIMIT 1;

  -- If already pending, don't allow duplicate
  IF v_existing.status = 'pending' THEN
    RAISE EXCEPTION 'Hadda waxaa jira codsi sugita ah';
  END IF;

  -- Insert new payment request (target_user_id is NULL until admin decides)
  INSERT INTO public.chat_unlock_payments
    (user_id, target_user_id, amount, currency, status, is_global, screenshot_url)
  VALUES
    (v_user_id, NULL, 1.00, 'USD', 'pending', false, p_screenshot_url)
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_chat_payment(text) TO authenticated;

-- ============================================================
-- 3. get_my_payment_status — current user's latest payment status
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_payment_status()
RETURNS TABLE(payment_id uuid, status text, screenshot_url text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id, status, screenshot_url, created_at
  FROM public.chat_unlock_payments
  WHERE user_id = auth.uid() AND is_global = false AND target_user_id IS NULL
  ORDER BY created_at DESC LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_payment_status() TO authenticated;

-- ============================================================
-- 4. get_chat_access_for_target — can current user chat with target?
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_chat_access_for_target(p_target_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.chat_access_grants
  WHERE user_id = auth.uid() AND target_id = p_target_id;

  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_access_for_target(uuid) TO authenticated;

-- ============================================================
-- 5. get_admin_payment_requests — all payment requests for admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_payment_requests()
RETURNS TABLE(
  payment_id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  email text,
  amount numeric,
  screenshot_url text,
  status text,
  created_at timestamptz,
  admin_action_at timestamptz
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
    p.id AS payment_id,
    p.user_id,
    u.full_name AS user_name,
    u.avatar_url AS user_avatar,
    u.email,
    p.amount,
    p.screenshot_url,
    p.status,
    p.created_at,
    p.admin_action_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  WHERE p.is_global = false AND p.target_user_id IS NULL
  ORDER BY
    CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,
    p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_payment_requests() TO authenticated;

-- ============================================================
-- 6. Helper: create or get conversation between two users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user1 uuid, p_user2 uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  SELECT id INTO v_conv_id FROM public.chat_conversations
  WHERE (user1_id = p_user1 AND user2_id = p_user2)
     OR (user1_id = p_user2 AND user2_id = p_user1)
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.chat_conversations (user1_id, user2_id)
    VALUES (p_user1, p_user2)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- ============================================================
-- 7. admin_approve_payment_one — approve for one specific member
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_payment_one(
  p_payment_id uuid,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_payment public.chat_unlock_payments;
  v_grant_exists boolean;
  v_conv_id uuid;
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

  -- Create grant
  SELECT EXISTS(SELECT 1 FROM public.chat_access_grants WHERE user_id = v_payment.user_id AND target_id = p_target_id)
    INTO v_grant_exists;
  IF NOT v_grant_exists THEN
    INSERT INTO public.chat_access_grants (user_id, target_id, payment_id)
    VALUES (v_payment.user_id, p_target_id, p_payment_id);
  END IF;

  -- Create conversation
  v_conv_id := public.get_or_create_conversation(v_payment.user_id, p_target_id);

  -- Update payment status
  UPDATE public.chat_unlock_payments
  SET status = 'approved', admin_id = auth.uid(), admin_action_at = now()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_payment_one(uuid, uuid) TO authenticated;

-- ============================================================
-- 8. admin_approve_payment_selected — approve for several members
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_payment_selected(
  p_payment_id uuid,
  p_target_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_payment public.chat_unlock_payments;
  v_grant_exists boolean;
  v_target_id uuid;
  v_conv_id uuid;
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

  FOREACH v_target_id IN ARRAY p_target_ids LOOP
    SELECT EXISTS(SELECT 1 FROM public.chat_access_grants WHERE user_id = v_payment.user_id AND target_id = v_target_id)
      INTO v_grant_exists;
    IF NOT v_grant_exists THEN
      INSERT INTO public.chat_access_grants (user_id, target_id, payment_id)
      VALUES (v_payment.user_id, v_target_id, p_payment_id);
    END IF;
    v_conv_id := public.get_or_create_conversation(v_payment.user_id, v_target_id);
  END LOOP;

  UPDATE public.chat_unlock_payments
  SET status = 'approved', admin_id = auth.uid(), admin_action_at = now()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_payment_selected(uuid, uuid[]) TO authenticated;

-- ============================================================
-- 9. admin_approve_payment_everyone — approve for all eligible members
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_payment_everyone(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_payment public.chat_unlock_payments;
  v_grant_exists boolean;
  v_target record;
  v_conv_id uuid;
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

  FOR v_target IN
    SELECT id FROM public.profiles
    WHERE is_admin = false AND registration_status = 'approved' AND id != v_payment.user_id
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.chat_access_grants WHERE user_id = v_payment.user_id AND target_id = v_target.id)
      INTO v_grant_exists;
    IF NOT v_grant_exists THEN
      INSERT INTO public.chat_access_grants (user_id, target_id, payment_id)
      VALUES (v_payment.user_id, v_target.id, p_payment_id);
    END IF;
    v_conv_id := public.get_or_create_conversation(v_payment.user_id, v_target.id);
  END LOOP;

  UPDATE public.chat_unlock_payments
  SET status = 'approved', admin_id = auth.uid(), admin_action_at = now()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_payment_everyone(uuid) TO authenticated;

-- ============================================================
-- 10. admin_reject_payment — reject the payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reject_payment(p_payment_id uuid)
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

  UPDATE public.chat_unlock_payments
  SET status = 'rejected', admin_id = auth.uid(), admin_action_at = now()
  WHERE id = p_payment_id AND status = 'pending';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_payment(uuid) TO authenticated;

-- ============================================================
-- 11. get_pending_payment_count — for admin badge
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pending_payment_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_count integer;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.chat_unlock_payments
  WHERE status = 'pending' AND is_global = false AND target_user_id IS NULL;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_payment_count() TO authenticated;

-- ============================================================
-- 12. Update chat_conversations INSERT policy to also allow
--     when a chat_access_grant exists (admin-created conversations)
-- ============================================================
-- The existing policy requires both users to be approved. That's fine.
-- The get_or_create_conversation function runs as SECURITY DEFINER
-- (admin), so it bypasses RLS. No policy change needed.

-- ============================================================
-- 13. Grant storage access for payment-screenshots bucket
-- ============================================================
-- Ensure authenticated users can upload to payment-screenshots
-- (policies should already exist from previous migrations)
