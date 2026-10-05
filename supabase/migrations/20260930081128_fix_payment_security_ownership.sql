/*
# Fix payment security: add ownership verification to update_payment_status

## Overview
The `update_payment_status` function was callable by any authenticated user on any payment,
which would allow a user to mark their own payment as 'paid' without actually paying.
This migration adds ownership verification so only the payment owner or an admin can
update a payment record.

## Changes
1. Replace `update_payment_status` with a version that verifies the caller owns the payment
   or is an admin.
2. This prevents users from marking arbitrary payments as paid.

## Security
- Only the payment owner or an admin can update a payment's status.
- In production, the 'paid' status should only be set by a Stripe webhook edge function
  using the service role key (which bypasses RLS and function checks).
*/

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
DECLARE
  v_payment_owner uuid;
BEGIN
  -- Get the payment's owner
  SELECT user_id INTO v_payment_owner FROM public.payments WHERE id = p_payment_id;

  IF v_payment_owner IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  -- Verify caller is the payment owner or an admin
  IF auth.uid() != v_payment_owner AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you can only update your own payments';
  END IF;

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
