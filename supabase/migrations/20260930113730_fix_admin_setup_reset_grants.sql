-- Fix: Allow anon role to call setup and reset functions
-- These pages are public (visited before login), so they need anon access.
-- Security is enforced by the secret setup/reset keys stored in app_settings,
-- which are validated inside the functions and rotated after each use.

GRANT EXECUTE ON FUNCTION public.create_first_admin(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_admin_password(text, text, text) TO anon, authenticated;
