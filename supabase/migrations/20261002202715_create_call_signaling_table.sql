/*
# Create WebRTC Call Signaling Table

1. New Tables
- `call_signals`: Stores ephemeral signaling messages for in-app WebRTC voice calls.
  - `id` (uuid, primary key)
  - `caller_id` (uuid, FK to profiles.id, NOT NULL) — the user who initiated the call
  - `callee_id` (uuid, FK to profiles.id, NOT NULL) — the user receiving the call
  - `type` (text, NOT NULL) — signal type: 'offer', 'answer', 'ice', 'end', 'reject', 'busy'
  - `sdp` (text, nullable) — SDP payload for offer/answer signals
  - `ice` (jsonb, nullable) — ICE candidate data for 'ice' signals
  - `created_at` (timestamptz, default now())

2. Security (RLS)
- Both caller and callee can SELECT and INSERT rows.
- Only participants of the signal (caller_id or callee_id) can access rows.
- DELETE is not granted — rows are ephemeral and cleaned up by TTL or manually.

3. Realtime
- Table is added to supabase_realtime publication so both users receive
  postgres_changes INSERT events for live signaling.

4. Important Notes
- Each signal is a one-shot message: the caller inserts an 'offer', the callee
  responds with 'answer' + 'ice' signals, etc.
- The frontend filters by callee_id = auth.uid() to detect incoming signals.
- Rows should be periodically cleaned up (they are ephemeral), but no
  automatic cleanup is configured here — the app deletes old rows on call end.
*/

CREATE TABLE IF NOT EXISTS public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  sdp text,
  ice jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_signals_callee_idx ON public.call_signals(callee_id);
CREATE INDEX IF NOT EXISTS call_signals_caller_idx ON public.call_signals(caller_id);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- SELECT: both participants can read signals
DROP POLICY IF EXISTS "call_signal_select_participant" ON public.call_signals;
CREATE POLICY "call_signal_select_participant"
  ON public.call_signals FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- INSERT: both participants can insert signals
DROP POLICY IF EXISTS "call_signal_insert_participant" ON public.call_signals;
CREATE POLICY "call_signal_insert_participant"
  ON public.call_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

-- DELETE: both participants can delete their signals (cleanup)
DROP POLICY IF EXISTS "call_signal_delete_participant" ON public.call_signals;
CREATE POLICY "call_signal_delete_participant"
  ON public.call_signals FOR DELETE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

GRANT SELECT, INSERT, DELETE ON public.call_signals TO authenticated;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
