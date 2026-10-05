/*
# Fix get_pending_chat_payment_count to only count global pending requests

The old function counted ALL pending rows in chat_unlock_payments, including
legacy per-conversation payments. Now it only counts is_global=true pending
requests, which are the ones the admin needs to approve in the new system.
*/

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
  WHERE status = 'pending' AND is_global = true;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_chat_payment_count() TO authenticated;
