/*
# Keep the sign-up trigger working after the function grant cleanup

The previous migration revoked EXECUTE on every function in `public` from PUBLIC.
`handle_new_user` is the trigger that creates a profile row when an account is
created, and it runs in the context of the authentication service role, so that role
needs EXECUTE explicitly. No client role is granted anything here.
*/

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
