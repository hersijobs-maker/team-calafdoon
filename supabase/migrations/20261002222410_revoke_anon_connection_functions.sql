/*
# Revoke anon execute on connection functions

All connection-related SECURITY DEFINER functions already check auth.uid()
internally and return early if NULL, so they are safe. However, the database
linter flags them because the anon role can technically call them. This
migration revokes EXECUTE from anon and public roles, keeping only
authenticated access (which is the intended audience for this signed-in app).

Functions affected:
- get_community_visibility_mode
- set_community_visibility_mode
- get_visible_members
- send_connection_request
- respond_to_connection_request
- remove_connection
- get_my_connections
- get_pending_connection_requests
- get_connection_notifications
- can_view_profile
- mark_connection_notification_read
*/

REVOKE EXECUTE ON FUNCTION public.get_community_visibility_mode() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_community_visibility_mode(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_visible_members() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.send_connection_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.respond_to_connection_request(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_connection(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_connections() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_pending_connection_requests() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_connection_notifications() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_connection_notification_read(uuid) FROM anon, public;
