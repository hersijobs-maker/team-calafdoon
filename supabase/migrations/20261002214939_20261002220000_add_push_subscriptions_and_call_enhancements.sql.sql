/*
# Add Push Subscription Table and Call Signaling Enhancements

1. New Tables
- `push_subscriptions`: Stores Web Push subscription endpoints per user.
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to profiles.id, NOT NULL) — the user who subscribed
  - `endpoint` (text, NOT NULL) — the push service endpoint URL
  - `p256dh` (text, NOT NULL) — subscriber public key
  - `auth` (text, NOT NULL) — subscriber auth secret
  - `created_at` (timestamptz, default now())
  - Unique constraint on (user_id, endpoint) to prevent duplicate subscriptions.

2. Modified Tables
- `call_signals`: Added two nullable columns:
  - `call_id` (uuid, nullable) — groups signals belonging to the same call session
  - `is_video` (boolean, default false) — whether the call includes video

3. Security
- Enable RLS on `push_subscriptions`.
- Users can only SELECT, INSERT, and DELETE their own push subscriptions.
- UPDATE is not granted (subscriptions are immutable; delete + re-insert to change).
- Added DELETE policy to `call_signals` for cleanup by participants (already existed
  but now also covers the new columns — no change needed).

4. Important Notes
- Push subscriptions are per-device/browser. A user may have multiple subscriptions.
- The edge function `send-call-push` reads from this table to deliver call alerts.
- The `call_id` column on `call_signals` helps group related signals and prevent
  stale signals from a previous call from being processed by a new call session.
- The `is_video` flag on `call_signals` lets the callee know whether to show a video
  call UI before accepting.
*/

-- ============================================================
-- push_subscriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON public.push_subscriptions(user_id, endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_select_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_select_own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_sub_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_insert_own"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_sub_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_delete_own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;

-- ============================================================
-- call_signals enhancements
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_signals' AND column_name = 'call_id'
  ) THEN
    ALTER TABLE public.call_signals ADD COLUMN call_id uuid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_signals' AND column_name = 'is_video'
  ) THEN
    ALTER TABLE public.call_signals ADD COLUMN is_video boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS call_signals_call_id_idx ON public.call_signals(call_id);

-- ============================================================
-- Store VAPID public key in app_settings for client access
-- ============================================================
INSERT INTO public.app_settings (key, value)
VALUES ('vapid_public_key', '')
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to read app_settings (needed for VAPID key)
DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_select_authenticated"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.app_settings TO authenticated;
