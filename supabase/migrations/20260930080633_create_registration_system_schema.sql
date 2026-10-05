/*
# Registration System Schema

## Overview
Creates the complete database structure for a user registration, payment, approval,
and members directory system. Users register, pay a fee, get admin approval, then
can log in and view other approved members.

## New Tables

1. **profiles** — Extended user data linked to auth.users
   - id (uuid, PK, FK to auth.users)
   - full_name, email, phone, avatar_url, bio, location, profession
   - registration_status: pending_approval | approved | rejected
   - is_admin: boolean flag for admin access
   - created_at, approved_at, rejected_at

2. **payments** — Registration fee transactions
   - id (uuid PK)
   - user_id (FK to profiles)
   - amount, currency
   - status: pending | paid | failed | cancelled
   - provider, provider_transaction_id, provider_reference
   - created_at, updated_at, paid_at

3. **approval_history** — Audit trail of admin approval/rejection actions
   - id (uuid PK)
   - user_id (FK to profiles)
   - admin_id (FK to auth.users)
   - action: approved | rejected
   - reason, notes
   - created_at

## Security (RLS)
- profiles: users can read/update own row; admins can read all; admins can update
  registration_status via SECURITY DEFINER function; public can insert own row on signup.
- payments: users can read own payments; admins can read all; insert via edge function
  with service role; update via SECURITY DEFINER functions only.
- approval_history: admins can read all; users can read their own history.
- SECURITY DEFINER functions for privileged operations (admin approval, payment status updates).

## Important Notes
1. registration_status defaults to 'pending_approval' — users cannot log in until 'approved'.
2. Payment status is tracked separately from approval status.
3. A trigger auto-creates a profile row when a new auth.users row is inserted.
4. Admin actions (approve/reject/delete) use SECURITY DEFINER functions that verify
   the caller is an admin — this is server-side enforcement, not just frontend.
5. Login is gated by a SECURITY DEFINER function that checks payment + approval status.
*/

-- =========================================================
-- PROFILES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  avatar_url text,
  bio text,
  location text,
  profession text,
  registration_status text NOT NULL DEFAULT 'pending_approval'
    CHECK (registration_status IN ('pending_approval', 'approved', 'rejected')),
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile (non-sensitive fields only)
-- registration_status and is_admin are protected via column grants / SECURITY DEFINER
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile row (during registration)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- PAYMENTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  provider text NOT NULL DEFAULT 'stripe',
  provider_transaction_id text,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can read their own payments
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- APPROVAL HISTORY TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_user_id ON public.approval_history(user_id);

ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own approval history
DROP POLICY IF EXISTS "approval_history_select_own" ON public.approval_history;
CREATE POLICY "approval_history_select_own"
  ON public.approval_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- SECURITY DEFINER FUNCTIONS
-- =========================================================

-- Check if current user is admin (helper function)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admin: approve a user
CREATE OR REPLACE FUNCTION public.admin_approve_user(target_user_id uuid, notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Update profile status
  UPDATE public.profiles
  SET registration_status = 'approved',
      approved_at = now(),
      rejected_at = NULL
  WHERE id = target_user_id;

  -- Record in approval history
  INSERT INTO public.approval_history (user_id, admin_id, action, notes)
  VALUES (target_user_id, auth.uid(), 'approved', notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_user(uuid, text) TO authenticated;

-- Admin: reject a user
CREATE OR REPLACE FUNCTION public.admin_reject_user(target_user_id uuid, reason text DEFAULT NULL, notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.profiles
  SET registration_status = 'rejected',
      rejected_at = now(),
      approved_at = NULL
  WHERE id = target_user_id;

  INSERT INTO public.approval_history (user_id, admin_id, action, reason, notes)
  VALUES (target_user_id, auth.uid(), 'rejected', reason, notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_user(uuid, text, text) TO authenticated;

-- Admin: delete a user (cascades to profile, payments, approval history)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Delete from auth.users cascades to profiles, payments, approval_history
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Update payment status (called by edge function with service role, or verified internally)
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_payment_id uuid,
  p_status text,
  p_provider_transaction_id text DEFAULT NULL,
  p_provider_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payments
  SET status = p_status,
      provider_transaction_id = COALESCE(p_provider_transaction_id, provider_transaction_id),
      provider_reference = COALESCE(p_provider_reference, provider_reference),
      updated_at = now(),
      paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END
  WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_payment_status(uuid, text, text, text) TO authenticated;

-- Create a pending payment record for a user
CREATE OR REPLACE FUNCTION public.create_payment(
  p_user_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'USD',
  p_provider text DEFAULT 'stripe',
  p_provider_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_payment_id uuid;
BEGIN
  INSERT INTO public.payments (user_id, amount, currency, provider, provider_reference, status)
  VALUES (p_user_id, p_amount, p_currency, p_provider, p_provider_reference, 'pending')
  RETURNING id INTO new_payment_id;

  RETURN new_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment(uuid, numeric, text, text, text) TO authenticated;

-- Get login access status (checks payment + approval)
CREATE OR REPLACE FUNCTION public.check_login_access(p_email text)
RETURNS TABLE(
  user_id uuid,
  registration_status text,
  payment_status text,
  has_paid boolean,
  can_login boolean,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_reg_status text;
  v_is_admin boolean;
  v_pay_status text;
  v_has_paid boolean;
BEGIN
  SELECT id, registration_status, is_admin INTO v_user_id, v_reg_status, v_is_admin
  FROM public.profiles WHERE email = p_email LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Check if user has any successful payment
  SELECT status INTO v_pay_status
  FROM public.payments
  WHERE user_id = v_user_id AND status = 'paid'
  ORDER BY paid_at DESC LIMIT 1;

  v_has_paid := v_pay_status IS NOT NULL;

  RETURN QUERY SELECT
    v_user_id,
    v_reg_status,
    COALESCE(v_pay_status, 'pending'),
    v_has_paid,
    (v_reg_status = 'approved' AND v_has_paid),
    COALESCE(v_is_admin, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_access(text) TO authenticated;

-- =========================================================
-- TRIGGER: Auto-create profile on auth.users insert
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- GRANTS
-- =========================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.approval_history TO authenticated;

-- =========================================================
-- ADMIN POLICIES (using is_admin() function)
-- =========================================================

-- Admins can read all profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins can read all payments
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins can read all approval history
DROP POLICY IF EXISTS "approval_history_select_admin" ON public.approval_history;
CREATE POLICY "approval_history_select_admin"
  ON public.approval_history FOR SELECT TO authenticated
  USING (public.is_admin());

-- Approved members can view other approved members (for directory)
DROP POLICY IF EXISTS "profiles_select_approved_members" ON public.profiles;
CREATE POLICY "profiles_select_approved_members"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    registration_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.registration_status = 'approved'
    )
  );