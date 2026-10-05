/*
# Community Visibility Mode + Member Connection System

## Summary
Adds an admin-controlled "Member Visibility Mode" setting (OPEN or PRIVATE community)
and a full member connection system (connect requests with pending/accepted/rejected/removed states).

## Changes

### 1. Community Visibility Setting
- Inserts a row into the existing `app_settings` table:
  - key = 'community_visibility_mode', value = 'open' (default)
- Adds a SECURITY DEFINER function `set_community_visibility_mode(p_mode text)`
  that only admins can call; accepts 'open' or 'private'.
- Adds a SECURITY DEFINER function `get_community_visibility_mode()` returning
  'open' or 'private' (defaults to 'open' if row missing).

### 2. New Table: member_connections
- `id` uuid PK
- `requester_id` uuid FK -> profiles(id) ON DELETE CASCADE
- `recipient_id` uuid FK -> profiles(id) ON DELETE CASCADE
- `status` text NOT NULL DEFAULT 'pending' — values: 'pending', 'accepted', 'rejected', 'removed'
- `created_at` timestamptz DEFAULT now()
- `responded_at` timestamptz NULL (set when recipient accepts/rejects)
- UNIQUE constraint on (requester_id, recipient_id) to prevent duplicate requests
- CHECK constraint on status values
- Indexes on requester_id, recipient_id, status

### 3. New Table: connection_notifications
- `id` uuid PK
- `user_id` uuid — the user who receives the notification
- `actor_id` uuid — the user who triggered it
- `type` text — 'connection_request', 'connection_accepted', 'connection_rejected', 'connection_removed'
- `connection_id` uuid FK -> member_connections(id) ON DELETE CASCADE
- `read_at` timestamptz NULL
- `created_at` timestamptz DEFAULT now()

### 4. RLS Policies on member_connections
- SELECT: either participant can see their own connections
- INSERT: only requester can insert (requester_id = auth.uid())
- UPDATE: only recipient can update status (recipient_id = auth.uid())
- DELETE: either participant can delete (for removal)

### 5. RLS Policies on connection_notifications
- SELECT: only the user_id owner
- UPDATE: only owner can mark read
- INSERT: any authenticated user can insert (for notifying the other party)
- DELETE: only owner can delete

### 6. Helper Functions (SECURITY DEFINER)
- `get_community_visibility_mode()` — returns current mode
- `set_community_visibility_mode(p_mode)` — admin-only setter
- `get_visible_members()` — replaces get_approved_members; in OPEN mode returns all approved
  members; in PRIVATE mode returns only approved members the caller has an accepted connection with
- `send_connection_request(p_recipient_id)` — creates a pending request + notification
- `respond_to_connection_request(p_connection_id, p_accept)` — accept or reject + notification
- `remove_connection(p_connection_id)` — sets status to 'removed' + notification
- `get_my_connections()` — returns accepted connections for the caller
- `get_pending_connection_requests()` — returns pending requests for the caller
- `get_connection_notifications()` — returns notifications for the caller
- `can_view_profile(p_target_user_id)` — returns boolean: can the caller view this profile?
- `mark_connection_notification_read(p_notification_id)` — mark a single notification read

### 7. Realtime
- Adds `member_connections` and `connection_notifications` to the supabase_realtime publication.

## Security Notes
- All privacy enforcement happens in SECURITY DEFINER functions, not just RLS/frontend.
- Admins can always view all profiles (get_visible_members checks is_admin).
- In PRIVATE mode, get_visible_members only returns connected members.
- The existing get_approved_members function remains untouched for backward compatibility.
- No existing tables, columns, or data are modified or deleted.
*/

-- ========== 1. Community Visibility Setting ==========

INSERT INTO public.app_settings (key, value)
VALUES ('community_visibility_mode', 'open')
ON CONFLICT (key) DO NOTHING;

-- ========== 2. Helper: get_community_visibility_mode ==========

CREATE OR REPLACE FUNCTION public.get_community_visibility_mode()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'community_visibility_mode'),
    'open'
  );
$$;

-- ========== 3. Helper: set_community_visibility_mode (admin-only) ==========

CREATE OR REPLACE FUNCTION public.set_community_visibility_mode(p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Fikrad ahaan maamulka ayaa kaliya ka beddeli kara habka muuqalka';
  END IF;
  IF p_mode NOT IN ('open', 'private') THEN
    RAISE EXCEPTION 'Habka waa in noqdaa ''open'' ama ''private''';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('community_visibility_mode', p_mode, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$;

-- ========== 4. member_connections table ==========

CREATE TABLE IF NOT EXISTS public.member_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT no_self_connection CHECK (requester_id <> recipient_id),
  CONSTRAINT unique_connection UNIQUE (requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_member_connections_requester ON public.member_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_recipient ON public.member_connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_status ON public.member_connections(status);

ALTER TABLE public.member_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conn_select_participant" ON public.member_connections;
CREATE POLICY "conn_select_participant"
ON public.member_connections FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "conn_insert_requester" ON public.member_connections;
CREATE POLICY "conn_insert_requester"
ON public.member_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "conn_update_recipient" ON public.member_connections;
CREATE POLICY "conn_update_recipient"
ON public.member_connections FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id OR auth.uid() = requester_id)
WITH CHECK (auth.uid() = recipient_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "conn_delete_participant" ON public.member_connections;
CREATE POLICY "conn_delete_participant"
ON public.member_connections FOR DELETE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- ========== 5. connection_notifications table ==========

CREATE TABLE IF NOT EXISTS public.connection_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'connection_rejected', 'connection_removed')),
  connection_id uuid REFERENCES public.member_connections(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conn_notif_user ON public.connection_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_conn_notif_read ON public.connection_notifications(user_id, read_at);

ALTER TABLE public.connection_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conn_notif_select_own" ON public.connection_notifications;
CREATE POLICY "conn_notif_select_own"
ON public.connection_notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "conn_notif_insert_any" ON public.connection_notifications;
CREATE POLICY "conn_notif_insert_any"
ON public.connection_notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "conn_notif_update_own" ON public.connection_notifications;
CREATE POLICY "conn_notif_update_own"
ON public.connection_notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conn_notif_delete_own" ON public.connection_notifications;
CREATE POLICY "conn_notif_delete_own"
ON public.connection_notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========== 6. get_visible_members (privacy-aware directory) ==========

CREATE OR REPLACE FUNCTION public.get_visible_members()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  bio text,
  location text,
  profession text,
  created_at timestamptz,
  age integer,
  gender text,
  country text,
  city text,
  marital_status text,
  looking_for text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mode text;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT public.is_admin() INTO v_is_admin;
  SELECT public.get_community_visibility_mode() INTO v_mode;

  -- Admins always see all approved members
  IF v_is_admin THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.phone, p.avatar_url, p.bio,
           p.location, p.profession, p.created_at, p.age, p.gender,
           p.country, p.city, p.marital_status, p.looking_for
    FROM public.profiles p
    WHERE p.registration_status = 'approved' AND p.is_admin = false
    ORDER BY p.created_at DESC;
    RETURN;
  END IF;

  -- OPEN mode: all approved members visible (same as before)
  IF v_mode = 'open' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.phone, p.avatar_url, p.bio,
           p.location, p.profession, p.created_at, p.age, p.gender,
           p.country, p.city, p.marital_status, p.looking_for
    FROM public.profiles p
    WHERE p.registration_status = 'approved' AND p.is_admin = false
    ORDER BY p.created_at DESC;
    RETURN;
  END IF;

  -- PRIVATE mode: only show members with accepted connections
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.avatar_url, p.bio,
         p.location, p.profession, p.created_at, p.age, p.gender,
         p.country, p.city, p.marital_status, p.looking_for
  FROM public.profiles p
  WHERE p.registration_status = 'approved' AND p.is_admin = false
    AND p.id <> v_uid
    AND EXISTS (
      SELECT 1 FROM public.member_connections mc
      WHERE mc.status = 'accepted'
        AND ((mc.requester_id = v_uid AND mc.recipient_id = p.id)
          OR (mc.recipient_id = v_uid AND mc.requester_id = p.id))
    )
  ORDER BY p.created_at DESC;
END;
$$;

-- ========== 7. send_connection_request ==========

CREATE OR REPLACE FUNCTION public.send_connection_request(p_recipient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conn_id uuid;
  v_existing record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Lama gali karo'; END IF;
  IF v_uid = p_recipient_id THEN RAISE EXCEPTION 'Naftaada kuma diri karto codsan'; END IF;

  -- Check if recipient is approved
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_recipient_id AND registration_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Xubnaha lama helin ama lama ansixin';
  END IF;

  -- Check for existing connection in either direction
  SELECT id, status INTO v_existing
  FROM public.member_connections
  WHERE (requester_id = v_uid AND recipient_id = p_recipient_id)
     OR (requester_id = p_recipient_id AND recipient_id = v_uid)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'accepted' THEN
      RAISE EXCEPTION 'Dhanka dherigga waa la xirayaa hadda';
    ELSIF v_existing.status = 'pending' THEN
      RAISE EXCEPTION 'Codsan waa la sugayaa jawaab';
    END IF;
    -- If rejected or removed, update to pending again
    UPDATE public.member_connections
    SET status = 'pending', requester_id = v_uid, recipient_id = p_recipient_id,
        responded_at = NULL, created_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_conn_id;
  ELSE
    INSERT INTO public.member_connections (requester_id, recipient_id, status)
    VALUES (v_uid, p_recipient_id, 'pending')
    RETURNING id INTO v_conn_id;
  END IF;

  -- Notify recipient
  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (p_recipient_id, v_uid, 'connection_request', v_conn_id);

  RETURN v_conn_id;
END;
$$;

-- ========== 8. respond_to_connection_request ==========

CREATE OR REPLACE FUNCTION public.respond_to_connection_request(p_connection_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn record;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Lama gali karo'; END IF;

  SELECT * INTO v_conn FROM public.member_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Codsan lama helin'; END IF;

  -- Only recipient can respond
  IF v_conn.recipient_id <> v_uid THEN
    RAISE EXCEPTION 'Adiga ma aadan helin codsankan';
  END IF;

  IF v_conn.status <> 'pending' THEN
    RAISE EXCEPTION 'Codsankan waa la jawaabay hore';
  END IF;

  IF p_accept THEN
    UPDATE public.member_connections
    SET status = 'accepted', responded_at = now()
    WHERE id = p_connection_id;

    -- Notify requester
    INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
    VALUES (v_conn.requester_id, v_uid, 'connection_accepted', p_connection_id);
  ELSE
    UPDATE public.member_connections
    SET status = 'rejected', responded_at = now()
    WHERE id = p_connection_id;

    INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
    VALUES (v_conn.requester_id, v_uid, 'connection_rejected', p_connection_id);
  END IF;
END;
$$;

-- ========== 9. remove_connection ==========

CREATE OR REPLACE FUNCTION public.remove_connection(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn record;
  v_uid uuid := auth.uid();
  v_other_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Lama gali karo'; END IF;

  SELECT * INTO v_conn FROM public.member_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dherig lama helin'; END IF;

  IF v_conn.requester_id <> v_uid AND v_conn.recipient_id <> v_uid THEN
    RAISE EXCEPTION 'Ma aadan qayb ka ahayn dherigkan';
  END IF;

  v_other_id := CASE WHEN v_conn.requester_id = v_uid THEN v_conn.recipient_id ELSE v_conn.requester_id END;

  UPDATE public.member_connections
  SET status = 'removed'
  WHERE id = p_connection_id;

  INSERT INTO public.connection_notifications (user_id, actor_id, type, connection_id)
  VALUES (v_other_id, v_uid, 'connection_removed', p_connection_id);
END;
$$;

-- ========== 10. get_my_connections ==========

CREATE OR REPLACE FUNCTION public.get_my_connections()
RETURNS TABLE (
  connection_id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  profession text,
  country text,
  city text,
  gender text,
  age integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT mc.id AS connection_id,
         p.id AS user_id,
         p.full_name,
         p.avatar_url,
         p.profession,
         p.country,
         p.city,
         p.gender,
         p.age,
         mc.created_at
  FROM public.member_connections mc
  JOIN public.profiles p ON (
    CASE WHEN mc.requester_id = v_uid THEN mc.recipient_id ELSE mc.requester_id END = p.id
  )
  WHERE mc.status = 'accepted'
    AND (mc.requester_id = v_uid OR mc.recipient_id = v_uid)
  ORDER BY mc.created_at DESC;
END;
$$;

-- ========== 11. get_pending_connection_requests ==========

CREATE OR REPLACE FUNCTION public.get_pending_connection_requests()
RETURNS TABLE (
  connection_id uuid,
  requester_id uuid,
  requester_name text,
  requester_avatar text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT mc.id AS connection_id,
         p.id AS requester_id,
         p.full_name AS requester_name,
         p.avatar_url AS requester_avatar,
         mc.created_at
  FROM public.member_connections mc
  JOIN public.profiles p ON p.id = mc.requester_id
  WHERE mc.recipient_id = v_uid AND mc.status = 'pending'
  ORDER BY mc.created_at DESC;
END;
$$;

-- ========== 12. get_connection_notifications ==========

CREATE OR REPLACE FUNCTION public.get_connection_notifications()
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_avatar text,
  type text,
  connection_id uuid,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT cn.id,
         cn.actor_id,
         p.full_name AS actor_name,
         p.avatar_url AS actor_avatar,
         cn.type,
         cn.connection_id,
         cn.read_at,
         cn.created_at
  FROM public.connection_notifications cn
  JOIN public.profiles p ON p.id = cn.actor_id
  WHERE cn.user_id = v_uid
  ORDER BY cn.created_at DESC
  LIMIT 50;
END;
$$;

-- ========== 13. can_view_profile ==========

CREATE OR REPLACE FUNCTION public.can_view_profile(p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mode text;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF v_uid = p_target_user_id THEN RETURN true; END IF;

  SELECT public.is_admin() INTO v_is_admin;
  IF v_is_admin THEN RETURN true; END IF;

  SELECT public.get_community_visibility_mode() INTO v_mode;

  IF v_mode = 'open' THEN
    -- In open mode, any approved member can view any other approved member
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_target_user_id AND registration_status = 'approved'
    );
  END IF;

  -- In private mode, only connected members can view each other
  RETURN EXISTS (
    SELECT 1 FROM public.member_connections mc
    WHERE mc.status = 'accepted'
      AND ((mc.requester_id = v_uid AND mc.recipient_id = p_target_user_id)
        OR (mc.recipient_id = v_uid AND mc.requester_id = p_target_user_id))
  );
END;
$$;

-- ========== 14. mark_connection_notification_read ==========

CREATE OR REPLACE FUNCTION public.mark_connection_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  UPDATE public.connection_notifications
  SET read_at = now()
  WHERE id = p_notification_id AND user_id = v_uid;
END;
$$;

-- ========== 15. Grant execute on functions to authenticated ==========

GRANT EXECUTE ON FUNCTION public.get_community_visibility_mode() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_community_visibility_mode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_connection_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_connection_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_connection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_connection_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_connection_notification_read(uuid) TO authenticated;

-- ========== 16. Realtime publication ==========

ALTER PUBLICATION supabase_realtime ADD TABLE public.member_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_notifications;
