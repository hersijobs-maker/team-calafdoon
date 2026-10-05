-- Grant INSERT and UPDATE privileges on payments table to authenticated role
-- The RLS policies (payments_insert_own, payments_update_own) already exist
-- but the base table GRANT for INSERT and UPDATE was missing, so PostgREST
-- could not perform these operations even though RLS would allow them.
GRANT INSERT, UPDATE ON public.payments TO authenticated;
