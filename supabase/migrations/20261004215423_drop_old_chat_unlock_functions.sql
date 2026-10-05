-- Drop existing functions that have signature changes
DROP FUNCTION IF EXISTS public.admin_approve_chat_payment(uuid);
DROP FUNCTION IF EXISTS public.admin_reject_chat_payment(uuid);
DROP FUNCTION IF EXISTS public.get_chat_access_status(uuid);
DROP FUNCTION IF EXISTS public.get_all_chat_unlock_payments();
