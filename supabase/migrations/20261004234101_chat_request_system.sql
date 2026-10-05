/*
# Chat Request System — replaces payment-based chat unlock

## Purpose
Replaces the global chat access / payment-based system with a simpler
per-conversation chat request model. Users send a chat request to another
member. The recipient or admin can approve/reject. Once approved, the
conversation is created and both users can chat freely — no payment required.

## New Table: chat_requests
- id (uuid PK)
- requester_id (uuid, FK profiles, NOT NULL) — who sent the request
- target_id (uuid, FK profiles, NOT NULL) — who the request is for
- status (text, NOT NULL, default 'pending') — pending/approved/rejected
- message (text, nullable) — optional message from requester
- created_at (timestamptz, default now())
- responded_at (timestamptz, nullable)
- responder_id (uuid, nullable) — who approved/rejected (admin or target)
- conversation_id (uuid, nullable, FK chat_conversations) — set when approved

## RPC Functions
- submit_chat_request(p_target_id, p_message): creates a pending request,
  prevents duplicates, sends notification to target.
- approve_chat_request(p_request_id): sets status=approved, creates conversation,
  sends notification to requester. Callable by admin OR target user.
- reject_chat_request(p_request_id): sets status=rejected, sends notification.
  Callable by admin OR target user.
- get_my_chat_requests(): returns requests WHERE target_id = auth.uid() AND
  status = 'pending' — for the recipient to see incoming requests.
- get_my_sent_chat_requests(): returns requests WHERE requester_id = auth.uid()
  — for the sender to see status of their requests.
- get_chat_request_status(p_target_id): returns the request status between
  the current user and a target user (for member cards).
- get_admin_chat_requests(): returns ALL pending requests for the admin dashboard.

## Security
- RLS enabled on chat_requests.
- Users can INSERT only their own requests (requester_id = auth.uid()).
- Users can SELECT requests where they are requester OR target.
- Admin functions check is_admin via SECURITY DEFINER.
- Notifications sent via connection_notifications table.

## Profile changes
- Set all non-admin profiles with chat_access_status = 'active' to restore
  chat access for existing users (removing the payment gate).
*/

-- ============================================================
-- 1. Create chat_requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  CONSTRAINT no_self_request CHECK (requester_id != target_id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_chat_requests_target_status ON public.chat_requests(target_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_requester_status ON public.chat_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_pair ON public.chat_requests(requester_id, target_id);

-- ============================================================
-- 2. Enable RLS
-- ============================================================
ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_requests" ON public.chat_requests;
CREATE POLICY "select_own_chat_requests"
ON public.chat_requests FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "insert_own_chat_requests" ON public.chat_requests;
CREATE POLICY "insert_own_chat_requests"
ON public.chat_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "update_own_chat_requests" ON public.chat_requests;
CREATE POLICY "update_own_chat_requests"
ON public.chat_requests FOR UPDATE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = target_id)
WITH CHECK (auth.uid() = requester_id OR auth.uid() = target_id);

-- ============================================================
-- 3. Restore chat access for all existing users
-- ============================================================
UPDATE public.profiles SET chat_access_status = 'active'
WHERE is_admin = false AND chat_access_status != 'active';

-- ============================================================
-- 4. submit_chat_request — user sends a request to another member
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_chat_request(
  p_target_id uuid,
  p_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_user_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot request chat with yourself';
  END IF;

  -- Check for existing request between these two users
  SELECT id, status INTO v_existing
  FROM public.chat_requests
  WHERE (requester_id = v_user_id AND target_id = p_target_id)
     OR (requester_id = p_target_id AND target_id = v_user_id)
  ORDER BY created_at DESC LIMIT 1;

  -- If approved already, no need for new request
  IF v_existing.status = 'approved' THEN
    RAISE EXCEPTION 'Fariimaha waa hore u furan yahay';
  END IF;

  -- If pending already, don't allow duplicate
  IF v_existing.status = 'pending' THEN
    RAISE EXCEPTION 'Codsi sugita ah ayaa jira';
  END IF;

  -- Insert new request
  INSERT INTO public.chat_requests (requester_id, target_id, status, message)
  VALUES (v_user_id, p_target_id, 'pending', p_message);

  -- Notify the target user
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (p_target_id, v_user_id, 'chat_request', NULL);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_chat_request(uuid, text) TO authenticated;

-- ============================================================
-- 5. approve_chat_request — approve and create conversation
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_chat_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_request public.chat_requests;
  v_conv_id uuid;
  v_existing_conv uuid;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE AND v_request.target_id != auth.uid() THEN
    -- Will be checked after fetching request
  END IF;

  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  -- Only admin or the target user can approve
  IF v_is_admin IS NOT TRUE AND v_request.target_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Check if conversation already exists between these two users
  SELECT id INTO v_existing_conv FROM public.chat_conversations
  WHERE (user1_id = v_request.requester_id AND user2_id = v_request.target_id)
     OR (user1_id = v_request.target_id AND user2_id = v_request.requester_id)
  LIMIT 1;

  IF v_existing_conv IS NOT NULL THEN
    v_conv_id := v_existing_conv;
  ELSE
    INSERT INTO public.chat_conversations (user1_id, user2_id)
    VALUES (v_request.requester_id, v_request.target_id)
    RETURNING id INTO v_conv_id;
  END IF;

  -- Update request
  UPDATE public.chat_requests
  SET status = 'approved', responded_at = now(), responder_id = auth.uid(), conversation_id = v_conv_id
  WHERE id = p_request_id;

  -- Set both users' chat_access_status to active
  UPDATE public.profiles SET chat_access_status = 'active'
  WHERE id IN (v_request.requester_id, v_request.target_id);

  -- Notify the requester
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (v_request.requester_id, auth.uid(), 'chat_request_approved', NULL);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_chat_request(uuid) TO authenticated;

-- ============================================================
-- 6. reject_chat_request — reject the request
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_chat_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_request public.chat_requests;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();

  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  -- Only admin or the target user can reject
  IF v_is_admin IS NOT TRUE AND v_request.target_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.chat_requests
  SET status = 'rejected', responded_at = now(), responder_id = auth.uid()
  WHERE id = p_request_id;

  -- Notify the requester
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (v_request.requester_id, auth.uid(), 'chat_request_rejected', NULL);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_chat_request(uuid) TO authenticated;

-- ============================================================
-- 7. get_my_chat_requests — incoming pending requests for current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_chat_requests()
RETURNS TABLE(
  request_id uuid,
  requester_id uuid,
  requester_name text,
  requester_avatar text,
  message text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS request_id,
    cr.requester_id,
    pr.full_name AS requester_name,
    pr.avatar_url AS requester_avatar,
    cr.message,
    cr.created_at
  FROM public.chat_requests cr
  JOIN public.profiles pr ON pr.id = cr.requester_id
  WHERE cr.target_id = auth.uid() AND cr.status = 'pending'
  ORDER BY cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_chat_requests() TO authenticated;

-- ============================================================
-- 8. get_my_sent_chat_requests — requests sent by current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_sent_chat_requests()
RETURNS TABLE(
  request_id uuid,
  target_id uuid,
  target_name text,
  target_avatar text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS request_id,
    cr.target_id,
    pr.full_name AS target_name,
    pr.avatar_url AS target_avatar,
    cr.status,
    cr.created_at
  FROM public.chat_requests cr
  JOIN public.profiles pr ON pr.id = cr.target_id
  WHERE cr.requester_id = auth.uid()
  ORDER BY cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_sent_chat_requests() TO authenticated;

-- ============================================================
-- 9. get_chat_request_status — check request status with a target user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_chat_request_status(p_target_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT cr.status INTO v_status
  FROM public.chat_requests cr
  WHERE (cr.requester_id = auth.uid() AND cr.target_id = p_target_id)
     OR (cr.requester_id = p_target_id AND cr.target_id = auth.uid())
  ORDER BY cr.created_at DESC LIMIT 1;

  RETURN COALESCE(v_status, 'none');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_request_status(uuid) TO authenticated;

-- ============================================================
-- 10. get_admin_chat_requests — all pending requests for admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_chat_requests()
RETURNS TABLE(
  request_id uuid,
  requester_id uuid,
  requester_name text,
  requester_avatar text,
  target_id uuid,
  target_name text,
  target_avatar text,
  message text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT pr.is_admin INTO v_is_admin FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    cr.id AS request_id,
    cr.requester_id,
    rq.full_name AS requester_name,
    rq.avatar_url AS requester_avatar,
    cr.target_id,
    tg.full_name AS target_name,
    tg.avatar_url AS target_avatar,
    cr.message,
    cr.status,
    cr.created_at
  FROM public.chat_requests cr
  JOIN public.profiles rq ON rq.id = cr.requester_id
  JOIN public.profiles tg ON tg.id = cr.target_id
  ORDER BY
    CASE cr.status WHEN 'pending' THEN 0 ELSE 1 END,
    cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_chat_requests() TO authenticated;

-- ============================================================
-- 11. Add chat request notification types to constraint
-- ============================================================
ALTER TABLE public.connection_notifications
  DROP CONSTRAINT IF EXISTS connection_notifications_type_check;

ALTER TABLE public.connection_notifications
  ADD CONSTRAINT connection_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'connection_request',
    'connection_accepted',
    'connection_rejected',
    'connection_removed',
    'chat_access_approved',
    'chat_access_disabled',
    'chat_request',
    'chat_request_approved',
    'chat_request_rejected'
  ]));
