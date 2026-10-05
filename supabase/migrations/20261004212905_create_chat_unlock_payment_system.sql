/*
# Chat Unlock Payment System (EVC Plus + Admin Approval)

## Purpose
Creates a per-conversation payment system where users must pay $1 via EVC Plus
to unlock chat with another user. Admin verifies the payment and approves/rejects it.
Chat access is only granted when payment_status = approved.

## New Tables

### chat_unlock_payments
Stores payment requests for unlocking chat access.
- id (uuid, PK)
- user_id (uuid, FK to auth.users) — the paying user
- target_user_id (uuid, FK to auth.users) — the user they want to chat with
- amount (numeric, default 1.00) — payment amount
- currency (text, default 'USD')
- transaction_id (text, not null) — EVC Plus transaction ID entered by user
- screenshot_url (text, nullable) — optional payment screenshot
- status (text, not null, default 'pending') — 'pending' | 'approved' | 'rejected'
- admin_id (uuid, nullable, FK to auth.users) — admin who approved/rejected
- admin_action_at (timestamptz, nullable) — when admin acted
- created_at (timestamptz)
- updated_at (timestamptz)

### chat_access
Tracks whether a user has unlocked chat access with a specific target user.
- id (uuid, PK)
- user_id (uuid, FK to auth.users) — the paying user
- target_user_id (uuid, FK to auth.users) — the user they unlocked chat with
- payment_id (uuid, FK to chat_unlock_payments) — the approved payment
- status (text, not null, default 'locked') — 'locked' | 'unlocked'
- created_at (timestamptz)
- Unique constraint on (user_id, target_user_id) to prevent duplicates

## Security
- RLS enabled on both tables
- Users can only see their own payment records and chat_access records
- Only admin can approve/reject payments (via SECURITY DEFINER functions)
- Only admin can update chat_access status (via SECURITY DEFINER functions)
- Users can INSERT payment requests (with ownership check)
- Users can SELECT their own records
- Users CANNOT update status themselves — only the admin RPC functions can

## RPC Functions
- admin_approve_chat_payment(p_payment_id uuid): Approves a pending payment, creates/updates chat_access to unlocked
- admin_reject_chat_payment(p_payment_id uuid): Rejects a pending payment, ensures chat_access stays locked
- get_chat_access_status(p_target_user_id uuid): Returns the current access status for the current user toward a target user
- get_pending_chat_payments(): Returns all pending payments with user info (admin only)
*/

-- ============================================================
-- 1. chat_unlock_payments table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_unlock_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 1.00,
  currency text NOT NULL DEFAULT 'USD',
  transaction_id text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_action_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_unlock_payments ENABLE ROW LEVEL SECURITY;

-- Users can read their own payment records
DROP POLICY IF EXISTS "select_own_chat_unlock_payments" ON public.chat_unlock_payments;
CREATE POLICY "select_own_chat_unlock_payments"
  ON public.chat_unlock_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own payment requests
DROP POLICY IF EXISTS "insert_own_chat_unlock_payments" ON public.chat_unlock_payments;
CREATE POLICY "insert_own_chat_unlock_payments"
  ON public.chat_unlock_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin can read all payment records
DROP POLICY IF EXISTS "admin_read_all_chat_unlock_payments" ON public.chat_unlock_payments;
CREATE POLICY "admin_read_all_chat_unlock_payments"
  ON public.chat_unlock_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- No UPDATE or DELETE policy for users — only admin RPC functions (SECURITY DEFINER) can change status

-- Index for querying pending payments
CREATE INDEX IF NOT EXISTS idx_chat_unlock_payments_status ON public.chat_unlock_payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_unlock_payments_user_target ON public.chat_unlock_payments (user_id, target_user_id);

-- ============================================================
-- 2. chat_access table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.chat_unlock_payments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked')),
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: one access record per (user, target) pair
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_access_user_target_unique'
  ) THEN
    ALTER TABLE public.chat_access
      ADD CONSTRAINT chat_access_user_target_unique UNIQUE (user_id, target_user_id);
  END IF;
END $$;

ALTER TABLE public.chat_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own access records
DROP POLICY IF EXISTS "select_own_chat_access" ON public.chat_access;
CREATE POLICY "select_own_chat_access"
  ON public.chat_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for users — only SECURITY DEFINER functions manage this

-- ============================================================
-- 3. RPC: admin_approve_chat_payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_chat_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.chat_unlock_payments;
  v_is_admin boolean;
BEGIN
  -- Check admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Get the payment
  SELECT * INTO v_payment FROM public.chat_unlock_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;

  -- Update payment status
  UPDATE public.chat_unlock_payments
  SET status = 'approved',
      admin_id = auth.uid(),
      admin_action_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  -- Insert or update chat_access to unlocked
  INSERT INTO public.chat_access (user_id, target_user_id, payment_id, status)
  VALUES (v_payment.user_id, v_payment.target_user_id, p_payment_id, 'unlocked')
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET status = 'unlocked', payment_id = p_payment_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 4. RPC: admin_reject_chat_payment
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
  -- Check admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Get the payment
  SELECT * INTO v_payment FROM public.chat_unlock_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;

  -- Update payment status
  UPDATE public.chat_unlock_payments
  SET status = 'rejected',
      admin_id = auth.uid(),
      admin_action_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  -- Ensure chat_access stays locked
  INSERT INTO public.chat_access (user_id, target_user_id, payment_id, status)
  VALUES (v_payment.user_id, v_payment.target_user_id, p_payment_id, 'locked')
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET status = 'locked', payment_id = p_payment_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 5. RPC: get_chat_access_status
-- Returns 'unlocked', 'locked', or 'pending' for current user toward a target
-- ============================================================
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
  -- Check if there's an existing access record
  SELECT status INTO v_access_status
  FROM public.chat_access
  WHERE user_id = auth.uid() AND target_user_id = p_target_user_id;

  IF v_access_status = 'unlocked' THEN
    RETURN 'unlocked';
  END IF;

  -- Check if there's a pending payment
  SELECT EXISTS(
    SELECT 1 FROM public.chat_unlock_payments
    WHERE user_id = auth.uid()
      AND target_user_id = p_target_user_id
      AND status = 'pending'
  ) INTO v_pending_exists;

  IF v_pending_exists THEN
    RETURN 'pending';
  END IF;

  RETURN 'locked';
END;
$$;

-- ============================================================
-- 6. RPC: get_pending_chat_payments (admin only)
-- Returns all pending payments with user profile info
-- ============================================================
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
    p.created_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  JOIN public.profiles t ON t.id = p.target_user_id
  WHERE p.status = 'pending'
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================
-- 7. RPC: get_all_chat_unlock_payments (admin only, all statuses)
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
    p.created_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  JOIN public.profiles t ON t.id = p.target_user_id
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================
-- 8. Grant execute to authenticated
-- ============================================================
GRANT EXECUTE ON FUNCTION public.admin_approve_chat_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_chat_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_access_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_chat_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_chat_unlock_payments() TO authenticated;

-- ============================================================
-- 9. Storage: reuse payment-screenshots bucket for chat unlock screenshots
--    (already exists with admin write + user upload policies)
-- ============================================================

-- Enable realtime for chat_unlock_payments
ALTER TABLE public.chat_unlock_payments REPLICA IDENTITY FULL;
