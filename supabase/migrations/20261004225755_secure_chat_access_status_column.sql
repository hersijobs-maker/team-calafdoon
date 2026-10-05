/*
# Secure chat_access_status column from user writes

## Purpose
The chat_access_status column on profiles must only be modifiable by admin
SECURITY DEFINER functions, never by the user directly. This revokes
UPDATE privilege on that specific column from the authenticated role,
so even if RLS allowed it, the user couldn't change their own chat status.
*/

-- Revoke column-level UPDATE on chat_access_status from authenticated and anon
REVOKE UPDATE (chat_access_status) ON public.profiles FROM authenticated;
REVOKE UPDATE (chat_access_status) ON public.profiles FROM anon;
