/*
# Remove unused DELETE privileges from the client roles

`anon` and `authenticated` held DELETE on `public.profiles` even though no DELETE
policy exists (row level security refuses the statement today). Removing the privilege
means a future policy change cannot accidentally make profile deletion reachable from
the browser. Account deletion stays exclusively with `admin_delete_user`.
The unused anon SELECT privileges are removed for the same reason.
*/

REVOKE DELETE ON public.profiles FROM anon, authenticated;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.payments FROM anon;
REVOKE SELECT ON public.approval_history FROM anon;
