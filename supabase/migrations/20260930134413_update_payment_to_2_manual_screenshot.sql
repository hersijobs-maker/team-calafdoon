-- 1. Add screenshot column to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_screenshot_url text;

-- 2. Update the amount default to $2.00 and provider to 'manual'
ALTER TABLE public.payments ALTER COLUMN amount SET DEFAULT 2.00;
ALTER TABLE public.payments ALTER COLUMN provider SET DEFAULT 'manual';

-- 3. Add 'pending_verification' to the status check constraint
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'pending_verification', 'paid', 'failed', 'cancelled'));

-- 4. Update create_my_registration_payment to create $2 payments
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
  VALUES (v_uid, 2.00, 'USD', 'pending', 'manual')
  RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_my_registration_payment() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_registration_payment() TO authenticated;

-- 5. Add UPDATE policy so users can update their own payment (to add screenshot)
CREATE POLICY "payments_update_own"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Create payment-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policies for payment-screenshots
CREATE POLICY "payment_screenshots_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "payment_screenshots_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "payment_screenshots_select_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-screenshots' AND public.is_admin());

-- 8. Admin function to approve/reject payment
CREATE OR REPLACE FUNCTION public.admin_verify_payment(
  p_payment_id uuid,
  p_approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin bool;
  v_user_id uuid;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT user_id INTO v_user_id FROM public.payments WHERE id = p_payment_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF p_approved THEN
    UPDATE public.payments
    SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = p_payment_id;
  ELSE
    UPDATE public.payments
    SET status = 'failed', updated_at = now()
    WHERE id = p_payment_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_verify_payment(uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_payment(uuid, boolean) TO authenticated;
