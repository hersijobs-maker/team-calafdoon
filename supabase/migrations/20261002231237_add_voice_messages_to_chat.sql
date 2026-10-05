/*
# Add Voice Messaging to Chat System

1. Modified Tables
- `chat_messages`: Adds columns to support WhatsApp-style voice messages.
  - `message_type` now supports 'voice' in addition to 'text' and 'call_event'.
  - `audio_url` (text, nullable) — public URL of the uploaded audio file in Supabase Storage.
  - `audio_duration_seconds` (int, nullable) — duration of the voice message in seconds.

2. New Storage Bucket
- `voice-messages`: Private bucket for storing recorded voice message audio files.
  - Files are stored under `{sender_id}/{message_id}.webm` (or .mp4).
  - Only conversation participants can read (download) voice messages.
  - Only the sender can upload to their own folder.

3. Security
- `chat_messages`: The existing SELECT/INSERT/UPDATE RLS policies already cover
  the new columns since they're on the same table. No new policies needed.
  - SELECT: only conversation participants can see messages (including audio_url).
  - INSERT: only approved conversation participants can insert messages.
  - UPDATE: only participants can update (e.g., mark read_at).
- `voice-messages` bucket:
  - SELECT: only authenticated users who are participants in the conversation
    that owns the message can read the audio file.
  - INSERT: only authenticated users can upload to their own folder path (`{user_id}/...`).
  - UPDATE: only the file owner can update.
  - DELETE: only the file owner can delete.

4. Important Notes
- Voice messages use message_type='voice', with audio_url and audio_duration_seconds populated.
- The content column is set to a fallback text like "🔊 Voice message" for conversation list previews.
- Existing text and call_event messages are completely unaffected.
- The message_type column already exists; we only widen its allowed values by adding a CHECK constraint.
- Audio files are served via Supabase Storage authenticated URLs, not public URLs, ensuring privacy.
*/

-- Add audio_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN audio_url text;
  END IF;
END $$;

-- Add audio_duration_seconds column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND column_name = 'audio_duration_seconds'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN audio_duration_seconds int;
  END IF;
END $$;

-- Update message_type CHECK to allow 'voice' (drop old constraint if exists, add new one)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'chat_messages'
    AND constraint_name = 'chat_messages_message_type_check'
  ) THEN
    ALTER TABLE public.chat_messages
      DROP CONSTRAINT chat_messages_message_type_check;
  END IF;
END $$;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN ('text', 'call_event', 'voice'));

-- Grant storage access to authenticated role for the voice-messages bucket
-- (Bucket creation and policies handled via storage schema below)

-- Create the voice-messages storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for voice-messages bucket
-- SELECT: only conversation participants can download a voice message
DROP POLICY IF EXISTS "voice_msgs_select_participants" ON storage.objects;
CREATE POLICY "voice_msgs_select_participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND EXISTS (
      SELECT 1 FROM public.chat_messages cm
      WHERE cm.audio_url IS NOT NULL
      AND cm.audio_url LIKE '%' || storage.objects.name
      AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = cm.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
      )
    )
  );

-- INSERT: only authenticated users can upload to their own folder (path starts with their user id)
DROP POLICY IF EXISTS "voice_msgs_insert_own" ON storage.objects;
CREATE POLICY "voice_msgs_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: only the file owner can update
DROP POLICY IF EXISTS "voice_msgs_update_own" ON storage.objects;
CREATE POLICY "voice_msgs_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: only the file owner can delete
DROP POLICY IF EXISTS "voice_msgs_delete_own" ON storage.objects;
CREATE POLICY "voice_msgs_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
