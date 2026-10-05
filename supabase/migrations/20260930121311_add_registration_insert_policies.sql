-- Add INSERT policy on profiles so users can self-register
-- (the trigger already handles this via SECURITY DEFINER, but this is a safety net)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Add INSERT policy on payments so create_my_registration_payment can work
-- (it's SECURITY DEFINER so it runs as postgres, but add policy for completeness)
CREATE POLICY "payments_insert_own"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
