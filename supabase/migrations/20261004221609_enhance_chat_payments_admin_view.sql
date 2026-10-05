-- Drop and recreate get_all_chat_unlock_payments with avatar_url and admin_name
DROP FUNCTION IF EXISTS public.get_all_chat_unlock_payments();

CREATE OR REPLACE FUNCTION public.get_all_chat_unlock_payments()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  target_user_id uuid,
  user_name text,
  user_avatar_url text,
  target_name text,
  target_avatar_url text,
  amount numeric,
  currency text,
  transaction_id text,
  screenshot_url text,
  status text,
  admin_id uuid,
  admin_name text,
  admin_action_at timestamptz,
  chat_access_type text,
  access_start_date timestamptz,
  access_end_date timestamptz,
  access_duration_months int,
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
    u.avatar_url AS user_avatar_url,
    t.full_name AS target_name,
    t.avatar_url AS target_avatar_url,
    p.amount,
    p.currency,
    p.transaction_id,
    p.screenshot_url,
    p.status,
    p.admin_id,
    a.full_name AS admin_name,
    p.admin_action_at,
    p.chat_access_type,
    p.access_start_date,
    p.access_end_date,
    p.access_duration_months,
    p.created_at
  FROM public.chat_unlock_payments p
  JOIN public.profiles u ON u.id = p.user_id
  JOIN public.profiles t ON t.id = p.target_user_id
  LEFT JOIN public.profiles a ON a.id = p.admin_id
  ORDER BY p.created_at DESC;
END;
$$;

-- New function: get selected user names for a chat access record
CREATE OR REPLACE FUNCTION public.get_chat_access_selected_user_names(p_payment_id uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text
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
    casu.selected_user_id AS user_id,
    pr.full_name,
    pr.avatar_url
  FROM public.chat_access_selected_users casu
  JOIN public.chat_access ca ON ca.id = casu.chat_access_id
  JOIN public.chat_unlock_payments cup ON cup.id = ca.payment_id
  JOIN public.profiles pr ON pr.id = casu.selected_user_id
  WHERE cup.id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_chat_unlock_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_access_selected_user_names(uuid) TO authenticated;
