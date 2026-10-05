/*
# Add Call Event Columns to chat_messages

1. Modified Tables
- `chat_messages`: Adds columns to support WhatsApp-style call event messages
  inserted directly into conversations alongside regular text messages.
  - `message_type` (text, NOT NULL, default 'text') — 'text' for regular messages, 'call_event' for call events
  - `call_status` (text, nullable) — for call_event rows: 'missed', 'declined', 'answered', 'ended', 'failed'
  - `call_duration_seconds` (int, nullable) — for answered/ended calls, the duration in seconds
  - `call_history_id` (uuid, nullable, FK to call_history.id) — links the call event to its call_history row for dedup

2. Security
- No new policies needed. The existing chat_messages SELECT/INSERT/UPDATE policies
  already cover these columns since they're on the same table.
- A partial unique index on call_history_id ensures only one call_event message
  is ever created per call_history row, preventing duplicate notifications even
  if multiple status updates arrive.

3. Important Notes
- Regular text messages have message_type='text' and NULL call_* columns.
- Call events have message_type='call_event', content set to a label string,
  and call_status/call_duration_seconds populated.
- The unique index on (call_history_id) WHERE call_history_id IS NOT NULL
  guarantees exactly one chat message per call, even if both users try to insert.
- The caller inserts the call event at terminal status. The callee sees it
  via the existing realtime subscription on chat_messages INSERT events.
- Existing rows default to message_type='text' so all current messages are unaffected.
*/

-- Add message_type column (default 'text' so existing rows are untouched)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND column_name = 'message_type'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN message_type text NOT NULL DEFAULT 'text';
  END IF;
END $$;

-- Add call_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND column_name = 'call_status'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN call_status text;
  END IF;
END $$;

-- Add call_duration_seconds column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND column_name = 'call_duration_seconds'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN call_duration_seconds int;
  END IF;
END $$;

-- Add call_history_id column with FK to call_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND column_name = 'call_history_id'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN call_history_id uuid REFERENCES public.call_history(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Partial unique index: one call event message per call_history row
-- This prevents duplicate call event messages even if multiple status updates fire
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_call_history_unique
  ON public.chat_messages (call_history_id)
  WHERE call_history_id IS NOT NULL;