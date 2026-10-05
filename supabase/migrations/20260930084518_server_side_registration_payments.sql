/*
# Move registration payment control to the server

1. Problem
   - `create_payment(p_user_id, p_amount, ...)` accepted the owner AND the amount from
     the browser, so any caller could attach a payment to a stranger's registration or
     register for one cent.
   - `update_payment_status(p_payment_id, 'paid')` authorised the payment's own owner,
     so a user could mark their registration fee paid without paying.

2. New tables
   - `app_config`: single-row server-side settings.
     - `id` (int, primary key, always 1)
     - `registration_fee` (numeric) - the fee of record
     - `currency` (text)
     - `updated_at` (timestamptz)
     Readable by signed-in users so the payment page can display the fee.
     Writable by no client role.

3. New functions
   - `create_my_registration_payment()`: takes no arguments. Owner comes from
     `auth.uid()`, amount and currency come from `app_config`. Reuses the caller's
     existing pending payment instead of creating duplicates.
   - `cancel_my_payment(p_payment_id)`: lets a user cancel only their own pending payment.

4. Removed functions
   - `create_payment(uuid, numeric, text, text, text)`
   - `update_payment_status(uuid, text, text, text)`
     The `paid` status is now written only by the `confirm-registration-payment`
     edge function, which runs with the service role.

5. Security notes
   1. No client role can set a payment to `paid` any more.
   2. Write privileges on `payments` and `approval_history` are revoked from the
      client roles; those tables are written only through definer functions and the
      service role.
*/

CREATE TABLE IF NOT EXISTS public.app_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_fee numeric(10,2) NOT NULL DEFAULT 25.00 CHECK (registration_fee > 0),
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_config (id, registration_fee, currency)
VALUES (1, 25.00, 'USD')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_select_authenticated" ON public.app_config;
CREATE POLICY "app_config_select_authenticated" ON public.app_config FOR SELECT
  TO authenticated USING (true);

REVOKE ALL ON public.app_config FROM anon, authenticated;
GRANT SELECT ON public.app_config TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.approval_history FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.create_payment(uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.update_payment_status(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.create_my_registration_payment()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_fee numeric(10,2);
  v_currency text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE user_id = v_uid AND status = 'paid'
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    RETURN v_payment_id;
  END IF;

  SELECT registration_fee, currency INTO v_fee, v_currency
  FROM public.app_config WHERE id = 1;

  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE user_id = v_uid AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    UPDATE public.payments
    SET amount = v_fee, currency = v_currency, updated_at = now()
    WHERE id = v_payment_id;
    RETURN v_payment_id;
  END IF;

  INSERT INTO public.payments (user_id, amount, currency, provider, status)
  VALUES (v_uid, v_fee, v_currency, 'stripe', 'pending')
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_my_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.payments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_payment_id
    AND user_id = v_uid
    AND status = 'pending';
END;
$function$;
