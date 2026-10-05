/*
# Revoke anon access to SECURITY DEFINER functions

## Overview
The security advisor flagged that all SECURITY DEFINER functions were executable by
the `anon` role (unauthenticated users). This migration revokes EXECUTE from `anon`
on all privileged functions so only authenticated users can call them.

## Changes
- REVOKE EXECUTE on all SECURITY DEFINER functions FROM anon
- Functions affected: is_admin, admin_approve_user, admin_reject_user, admin_delete_user,
  update_payment_status, create_payment, check_login_access

## Security
- Unauthenticated users can no longer call privileged functions via the REST API.
- All functions still have internal authorization checks (is_admin verification, ownership checks).
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_user(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_payment_status(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_payment(uuid, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_login_access(text) FROM anon;
