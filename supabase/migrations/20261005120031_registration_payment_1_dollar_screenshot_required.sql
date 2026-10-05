/*
# Registration Payment: $1 Fee with Required Screenshot

## Overview
Changes the registration fee from $2 (and app_config value of $25) to $1,
and adds a backend-enforced requirement that users must upload a payment
screenshot before their registration appears in the admin approval queue.

## Changes

### 1. Update fee to $1.00
- Update `app_config.registration_fee` to 1.00
- Update `create_my_registration_payment()` to create $1 payments

### 2. Add `draft` registration status
- Add 'draft' to the registration_status CHECK constraint on profiles
- Users start as 'draft' and only move to 'pending_approval' after
  submitting payment proof

### 3. New function: `submit_registration_payment(p_screenshot_url text)`
- SECURITY DEFINER function callable by authenticated users
- Requires a non-null, non-empty screenshot URL
- Creates/updates a payment record with status 'pending_verification'
  and the screenshot URL
- Updates the user's profile registration_status from 'draft' to 'pending_approval'
- Raises an exception if no screenshot URL is provided
- This is the ONLY way a user can enter the admin approval queue

### 4. Update `handle_new_user()` trigger
- New profiles default to 'draft' instead of 'pending_approval'
- They only become 'pending_approval' after payment proof is submitted

### 5. Admin pending list filtering
- The admin dashboard already loads all profiles with registration_status =
  'pending_approval'. Since new users now start as 'draft', they will NOT
  appear in the pending list until they call submit_registration_payment().

## Security
- The screenshot requirement is enforced in the SECURITY DEFINER function:
  it raises an exception if p_screenshot_url is null or empty.
- A user cannot directly UPDATE their own registration_status (column-level
  privilege restrictions already in place from earlier migrations).
- A user cannot directly UPDATE payments.status (only through the function).
- Direct API/DB requests without a screenshot will fail with an exception.
*/

-- 1. Update fee to $1.00
UPDATE public.app_config SET registration_fee = 1.00, currency = 'USD', updated_at = now() WHERE id = 1;

-- 2. Update payment default amount to $1.00
ALTER TABLE public.payments ALTER COLUMN amount SET DEFAULT 1.00;

-- 3. Update create_my_registration_payment to create $1 payments
CREATE OR REPLACE FUNCTION public.create_my_registration_payment()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_existing
  FROM public.payments
  WHERE user_id = v_uid AND status IN ('pending', 'pending_verification')
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.payments (user_id, amount, currency, status, provider)
  VALUES (v_uid, 1.00, 'USD', 'pending', 'manual')
  RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_my_registration_payment() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_registration_payment() TO authenticated;

-- 4. Add 'draft' to registration_status CHECK constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_registration_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_registration_status_check
  CHECK (registration_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'blocked'));

-- 5. Update default to 'draft'
ALTER TABLE public.profiles ALTER COLUMN registration_status SET DEFAULT 'draft';

-- 6. Update handle_new_user to set 'draft' status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, registration_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'draft'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. New function: submit_registration_payment — the ONLY path to pending_approval
CREATE OR REPLACE FUNCTION public.submit_registration_payment(p_screenshot_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_current_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_screenshot_url IS NULL OR btrim(p_screenshot_url) = '' THEN
    RAISE EXCEPTION 'Payment screenshot is required. Fadlan marka hore soo geli screenshot-ka lacag bixinta $1.';
  END IF;

  -- Get current registration status
  SELECT registration_status INTO v_current_status
  FROM public.profiles WHERE id = v_uid;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Only allow submission from draft, pending_approval, or rejected
  IF v_current_status NOT IN ('draft', 'pending_approval', 'rejected') THEN
    RAISE EXCEPTION 'Cannot submit payment proof in current status: %', v_current_status;
  END IF;

  -- Find or create a pending payment
  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE user_id = v_uid AND status IN ('pending', 'pending_verification', 'failed')
  ORDER BY created_at DESC LIMIT 1;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.payments (user_id, amount, currency, status, provider, payment_screenshot_url)
    VALUES (v_uid, 1.00, 'USD', 'pending_verification', 'manual', p_screenshot_url)
    RETURNING id INTO v_payment_id;
  ELSE
    UPDATE public.payments
    SET payment_screenshot_url = p_screenshot_url,
        status = 'pending_verification',
        updated_at = now()
    WHERE id = v_payment_id;
  END IF;

  -- Move user to pending_approval so admin can see them
  UPDATE public.profiles
  SET registration_status = 'pending_approval',
      rejected_at = NULL
  WHERE id = v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_registration_payment(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_registration_payment(text) TO authenticated;

-- 8. Grant UPDATE on payments.screenshot_url and status for the function (SECURITY DEFINER handles this)
-- The existing payments_update_own policy allows users to update their own payment rows,
-- but the submit_registration_payment function runs as SECURITY DEFINER (owner) so it
-- bypasses RLS. No additional grants needed.

-- 9. Update existing 'pending_approval' users who don't have payment to 'draft'
-- (only affects users created before this migration who haven't paid)
UPDATE public.profiles
SET registration_status = 'draft'
WHERE registration_status = 'pending_approval'
  AND is_admin = false
  AND NOT EXISTS (
    SELECT 1 FROM public.payments
    WHERE payments.user_id = profiles.id
      AND payments.payment_screenshot_url IS NOT NULL
      AND payments.status IN ('pending_verification', 'paid')
  );
