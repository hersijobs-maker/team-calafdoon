/*
# Fix ambiguous user_id in get_admin_chat_access_list

The RETURNS TABLE column "user_id" conflicts with the unqualified "user_id"
in the LATERAL subquery's WHERE clause. Fix by aliasing the subquery column.
*/

DROP FUNCTION IF EXISTS public.get_admin_chat_access_list();

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
    SELECT cp.id, cp.status, cp.amount, cp.transaction_id, cp.screenshot_url, cp.created_at
    FROM public.chat_unlock_payments cp
    WHERE cp.user_id = pr.id AND cp.is_global = true
    ORDER BY cp.created_at DESC LIMIT 1
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
