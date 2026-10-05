-- Revoke EXECUTE from anon and PUBLIC on the voice message access function
REVOKE EXECUTE ON FUNCTION public.can_access_voice_message(text) FROM anon, PUBLIC;
