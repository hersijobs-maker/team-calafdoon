-- Simple, robust pending count function
CREATE OR REPLACE FUNCTION public.get_pending_chat_payment_count()
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
  WHERE status = 'pending';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_chat_payment_count() TO authenticated;
