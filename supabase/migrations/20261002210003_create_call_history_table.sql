/*
# Create Call History Table

1. New Tables
- `call_history`: Stores a permanent record of every WebRTC voice call attempt.
  - `id` (uuid, primary key)
  - `caller_id` (uuid, FK to profiles.id, NOT NULL) — the user who initiated the call
  - `callee_id` (uuid, FK to profiles.id, NOT NULL) — the user receiving the call
  - `status` (text, NOT NULL, default 'initiated') — one of:
      'initiated'    — call started, ringing
      'answered'     — callee accepted, call connected
      'missed'       — callee did not answer (timeout or offline)
      'declined'     — callee actively declined
      'failed'       — technical error
      'ended'        — call completed normally after being answered
  - `duration_seconds` (int, nullable) — call duration if answered, null otherwise
  - `created_at` (timestamptz, default now()) — when the call was initiated
  - `answered_at` (timestamptz, nullable) — when the callee accepted
  - `ended_at` (timestamptz, nullable) — when the call ended
  - `seen_by_callee` (boolean, default false) — whether the callee has seen the missed call notification

2. Security (RLS)
- Enable RLS on call_history.
- Both caller and callee can SELECT rows where they are a participant.
- Both caller and callee can INSERT rows where they are a participant.
- Both caller and callee can UPDATE rows where they are a participant (for status updates and seen flag).
- DELETE is not granted — call history is permanent.

3. Indexes
- Index on callee_id for fast "my missed calls" queries.
- Index on caller_id for fast "my outgoing calls" queries.
- Index on created_at descending for history page sorting.

4. Important Notes
- The caller inserts a row with status='initiated' when starting a call.
- When the callee answers, the row is updated to status='answered' with answered_at.
- When the call ends normally, status='ended' with ended_at and duration_seconds.
- If the callee declines, status='declined'.
- If the call times out (caller cancels while ringing), status='missed'.
- If the callee is offline/busy and sends a 'busy' signal, status='missed'.
- The seen_by_callee flag is set to true when the callee views their missed call notification,
  preventing duplicate notifications.
*/

CREATE TABLE IF NOT EXISTS public.call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'initiated',
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  seen_by_callee boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS call_history_callee_idx ON public.call_history(callee_id);
CREATE INDEX IF NOT EXISTS call_history_caller_idx ON public.call_history(caller_id);
CREATE INDEX IF NOT EXISTS call_history_created_at_idx ON public.call_history(created_at DESC);

ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- SELECT: both participants can read their call history
DROP POLICY IF EXISTS "call_history_select_participant" ON public.call_history;
CREATE POLICY "call_history_select_participant"
  ON public.call_history FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- INSERT: both participants can insert (caller creates the row)
DROP POLICY IF EXISTS "call_history_insert_participant" ON public.call_history;
CREATE POLICY "call_history_insert_participant"
  ON public.call_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

-- UPDATE: both participants can update (status changes, seen flag)
DROP POLICY IF EXISTS "call_history_update_participant" ON public.call_history;
CREATE POLICY "call_history_update_participant"
  ON public.call_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

GRANT SELECT, INSERT, UPDATE ON public.call_history TO authenticated;

-- Add to realtime publication so users get live updates for missed call notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_history;