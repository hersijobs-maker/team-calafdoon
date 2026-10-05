/*
# Fix voice-messages storage SELECT policy

## Problem
The previous SELECT policy on storage.objects for the voice-messages bucket
required a chat_messages row to already exist referencing the audio file
before anyone could read it. But createSignedUrl is called *before* the
chat_message row is inserted — so the policy denied access, the signed URL
came back empty, and voice messages never appeared in the chat.

## Fix
- Updated SELECT policy: a user can read a voice-messages object if EITHER:
  1. The file is in their own folder (path starts with their user_id), OR
  2. The file is referenced by a chat_message in a conversation they participate in.
- This lets the sender call createSignedUrl immediately after upload (own folder),
  and lets the recipient access files from their conversations.
- INSERT, UPDATE, DELETE policies are unchanged.
*/

DROP POLICY IF EXISTS "voice_msgs_select_participants" ON storage.objects;

CREATE POLICY "voice_msgs_select_participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.chat_messages cm
        WHERE cm.audio_url IS NOT NULL
          AND cm.audio_url LIKE '%' || storage.objects.name
          AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = cm.conversation_id
              AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
          )
      )
    )
  );
