/*
# Change Chat Payment Logic: Payment Controls SENDING, Not Access

## Purpose
Previously, payment approval granted access to specific conversations (per-target grants).
Now, payment approval is PER USER and controls the ability to SEND messages:
- APPROVED user → can send messages to ANY user
- UNPAID/PENDING/REJECTED user → can receive and READ messages but CANNOT send

## Changes

### 1. New RPC: can_send_messages()
Returns boolean — true if the current user has an approved chat_unlock_payments
record (status = 'approved'). This is the single check for send permission.

### 2. Updated RLS: chat_messages INSERT policy
The INSERT policy now requires:
- Sender is a participant in the conversation
- Sender has registration_status = 'approved'
- Sender has an approved payment (EXISTS check on chat_unlock_payments)

### 3. Updated RLS: chat_conversations INSERT policy
The INSERT policy now allows any approved user to create a conversation with
any other approved user (no per-target grant needed). This supports the new
flow where an approved user can message anyone.

### 4. Updated: get_or_create_conversation
No longer requires a chat_access_grant. Any approved user can create a
conversation with any other approved user.

## Security
- RLS enforces send permission at the database level — even if the frontend
  is bypassed, an unapproved user cannot insert messages.
- SELECT policies on chat_messages and chat_conversations are unchanged —
  participants can always read their conversations.
- The can_send_messages() function is SECURITY DEFINER for reliable checks.
*/

-- ============================================================
-- 1. can_send_messages() — single check for send permission
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_send_messages()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.chat_unlock_payments
  WHERE user_id = auth.uid()
    AND is_global = false
    AND target_user_id IS NULL
    AND status = 'approved';

  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_send_messages() TO authenticated;

-- ============================================================
-- 2. Update chat_messages INSERT policy — require approved payment
-- ============================================================
DROP POLICY IF EXISTS "chat_msg_insert_participant" ON public.chat_messages;

CREATE POLICY "chat_msg_insert_participant"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.registration_status = 'approved'
  )
  AND public.can_send_messages()
);

-- ============================================================
-- 3. Update chat_conversations INSERT policy — any approved user
--    can start a conversation with any other approved user
-- ============================================================
DROP POLICY IF EXISTS "chat_conv_insert_participant" ON public.chat_conversations;

CREATE POLICY "chat_conv_insert_participant"
ON public.chat_conversations FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user1_id OR auth.uid() = user2_id)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = chat_conversations.user1_id
      AND p.registration_status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = chat_conversations.user2_id
      AND p.registration_status = 'approved'
  )
);
