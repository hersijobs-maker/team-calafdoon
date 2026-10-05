/*
# Fix voice message playback for recipients

## Root Cause
The storage SELECT policy for voice-messages used a nested EXISTS subquery
joining chat_messages → chat_conversations. Both tables have RLS enabled,
creating a 3-level RLS chain (storage.objects → chat_messages → chat_conversations)
that causes the recipient's createSignedUrl call to fail.

## Fix
1. Create a SECURITY DEFINER function that checks voice message access
   WITHOUT triggering RLS on intermediate tables.
2. Replace the complex SELECT policy with one that calls this function.
3. Add an index on chat_messages.audio_url for faster lookups.
*/

-- 1. Create SECURITY DEFINER function to check voice message access
-- This bypasses RLS on chat_messages and chat_conversations
CREATE OR REPLACE FUNCTION public.can_access_voice_message(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  folder text;
BEGIN
  IF file_path IS NULL OR file_path = '' THEN
    RETURN false;
  END IF;

  -- Check if the file is in the user's own folder (sender access)
  folder := (storage.foldername(file_path))[1];
  IF folder = auth.uid()::text THEN
    RETURN true;
  END IF;

  -- Check if user is a participant in a conversation with this voice message
  IF EXISTS (
    SELECT 1
    FROM chat_messages cm
    JOIN chat_conversations c ON c.id = cm.conversation_id
    WHERE cm.audio_url = file_path
      AND cm.message_type = 'voice'
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_voice_message(text) TO authenticated;

-- 2. Add index for faster audio_url lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_audio_url
  ON chat_messages(audio_url)
  WHERE audio_url IS NOT NULL;

-- 3. Replace the old SELECT policy with the simpler function-based one
DROP POLICY IF EXISTS "voice_msgs_select_participants" ON storage.objects;

CREATE POLICY "voice_msgs_select_participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND public.can_access_voice_message(name)
  );
