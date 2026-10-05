/*
# Create missing RPCs and refresh schema cache

## Purpose
The mobile app and some code paths call RPCs that don't exist in the database:
1. `get_my_conversations` — returns the current user's conversations with other user's profile info, latest message, and unread count
2. `record_story_view` — records a story view (or no-ops if a stories view table doesn't exist)

These were referenced in code but never created, causing "Could not find the function" or schema cache errors.

## New Functions

### get_my_conversations
Returns conversations for the authenticated user with:
- Other user's id, full_name, avatar_url
- Latest message content, created_at, sender_id
- Unread message count

### record_story_view
Records a view on a story by the current user. Uses the existing `story_views` table.

## Security
- `get_my_conversations`: SECURITY INVOKER, scoped to auth.uid() — only returns conversations the user participates in
- `record_story_view`: SECURITY INVOKER, only inserts a view for auth.uid()

## Important Notes
1. Both functions use `auth.uid()` for ownership checks
2. `get_my_conversations` replaces the need for multiple client-side queries
3. `record_story_view` uses INSERT ... ON CONFLICT to avoid duplicate views
4. Refreshed PostgREST schema cache via `NOTIFY pgrst` so the functions are immediately available
*/

-- ============================================================
-- get_my_conversations
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS TABLE (
  id uuid,
  user1_id uuid,
  user2_id uuid,
  created_at timestamptz,
  other_user jsonb,
  latest_message jsonb,
  unread_count bigint
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.user1_id,
    c.user2_id,
    c.created_at,
    CASE
      WHEN c.user1_id = auth.uid() THEN
        to_jsonb(p2)
      ELSE
        to_jsonb(p1)
    END AS other_user,
    (
      SELECT to_jsonb(m)
      FROM chat_messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS latest_message,
    (
      SELECT count(*)
      FROM chat_messages m
      WHERE m.conversation_id = c.id
        AND m.sender_id != auth.uid()
        AND m.read_at IS NULL
    ) AS unread_count
  FROM chat_conversations c
  LEFT JOIN profiles p1 ON p1.id = c.user1_id
  LEFT JOIN profiles p2 ON p2.id = c.user2_id
  WHERE c.user1_id = auth.uid() OR c.user2_id = auth.uid()
  ORDER BY COALESCE(
    (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
    c.created_at
  ) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_conversations() TO authenticated;

-- ============================================================
-- record_story_view
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_story_view(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO story_views (story_id, viewer_id)
  VALUES (p_story_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_story_view(p_story_id uuid) TO authenticated;

-- ============================================================
-- Refresh PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
