/*
# Create Private Chat System

1. New Tables
- `chat_conversations`: Stores one-to-one conversation pairs between approved members.
  - `id` (uuid, primary key)
  - `user1_id` (uuid, FK to profiles.id, NOT NULL) — the user who initiated the chat
  - `user2_id` (uuid, FK to profiles.id, NOT NULL) — the recipient
  - `created_at` (timestamptz, default now())
  - Unique constraint on (user1_id, user2_id) prevents duplicate conversations.

- `chat_messages`: Stores individual messages within a conversation.
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, FK to chat_conversations.id, NOT NULL, ON DELETE CASCADE)
  - `sender_id` (uuid, FK to profiles.id, NOT NULL, DEFAULT auth.uid()) — who sent the message
  - `content` (text, NOT NULL) — the message text
  - `read_at` (timestamptz, nullable) — when the recipient read the message (NULL = unread)
  - `created_at` (timestamptz, default now())

2. Indexes
- `chat_conversations_user1_idx` on user1_id for fast lookup of initiated conversations
- `chat_conversations_user2_idx` on user2_id for fast lookup of received conversations
- `chat_messages_conversation_idx` on conversation_id for fast message retrieval
- `chat_messages_sender_idx` on sender_id

3. Security (RLS)
- `chat_conversations`: Only participants (user1_id or user2_id) can SELECT, INSERT.
  INSERT requires the authenticated user is one of the two participants AND the other
  participant is an approved member (checked via EXISTS on profiles).
- `chat_messages`: Only participants of the conversation can SELECT. INSERT requires
  the sender is a participant AND is an approved member. UPDATE only allows marking
  read_at (the recipient updates read status).

4. Important Notes
- Both participants must be approved members to send/receive messages.
- RLS ensures users can only see conversations they are part of.
- The read_at column tracks whether a message has been read by the recipient.
- No private messages are exposed in the public member directory (separate table).
*/

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate conversations between the same pair
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_pair_unique'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD CONSTRAINT chat_conversations_pair_unique UNIQUE (user1_id, user2_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chat_conversations_user1_idx ON public.chat_conversations(user1_id);
CREATE INDEX IF NOT EXISTS chat_conversations_user2_idx ON public.chat_conversations(user2_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_idx ON public.chat_messages(sender_id);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_conversations: SELECT — user must be a participant
DROP POLICY IF EXISTS "chat_conv_select_participant" ON public.chat_conversations;
CREATE POLICY "chat_conv_select_participant"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- chat_conversations: INSERT — user must be a participant AND the other user must be approved
DROP POLICY IF EXISTS "chat_conv_insert_participant" ON public.chat_conversations;
CREATE POLICY "chat_conv_insert_participant"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user1_id AND p.registration_status = 'approved'
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user2_id AND p.registration_status = 'approved'
      )
    )
  );

-- chat_messages: SELECT — user must be a participant of the conversation
DROP POLICY IF EXISTS "chat_msg_select_participant" ON public.chat_messages;
CREATE POLICY "chat_msg_select_participant"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- chat_messages: INSERT — sender must be a participant AND approved
DROP POLICY IF EXISTS "chat_msg_insert_participant" ON public.chat_messages;
CREATE POLICY "chat_msg_insert_participant"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.registration_status = 'approved'
    )
  );

-- chat_messages: UPDATE — only the recipient can mark read_at (no content changes)
DROP POLICY IF EXISTS "chat_msg_update_recipient" ON public.chat_messages;
CREATE POLICY "chat_msg_update_recipient"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Grant base table privileges
GRANT SELECT, INSERT ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT UPDATE ON public.chat_messages TO authenticated;
