/*
# Public Stories Access Control

## Goal
- Guests (anon) and pending users can SELECT/read public posts, stories, comments, likes
- Only approved users can INSERT/UPDATE/DELETE (interact, post, comment, like)
- story_views view tracking needs to work for non-owners

## Changes
1. Add helper function is_approved_user() that checks registration_status
2. Recreate SELECT policies to include anon role (public read)
3. Recreate INSERT/UPDATE/DELETE policies to require is_approved_user()
*/

-- 1. Helper function: is the current user approved?
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND registration_status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_approved_user() FROM anon, PUBLIC;

-- 2. POSTS
-- SELECT: public (anon + authenticated)
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: approved only
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_approved"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

-- UPDATE: approved owner only
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_approved"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_approved_user())
  WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

-- DELETE: approved owner only
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_approved"
  ON public.posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_approved_user());

-- 3. POST_MEDIA
DROP POLICY IF EXISTS "post_media_select_all" ON public.post_media;
CREATE POLICY "post_media_select_all"
  ON public.post_media FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "post_media_insert_own" ON public.post_media;
CREATE POLICY "post_media_insert_approved"
  ON public.post_media FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

DROP POLICY IF EXISTS "post_media_delete_own" ON public.post_media;
CREATE POLICY "post_media_delete_approved"
  ON public.post_media FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_approved_user());

-- 4. POST_LIKES
DROP POLICY IF EXISTS "post_likes_select_all" ON public.post_likes;
CREATE POLICY "post_likes_select_all"
  ON public.post_likes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
CREATE POLICY "post_likes_insert_approved"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;
CREATE POLICY "post_likes_delete_approved"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_approved_user());

-- 5. POST_COMMENTS
DROP POLICY IF EXISTS "post_comments_select_all" ON public.post_comments;
CREATE POLICY "post_comments_select_all"
  ON public.post_comments FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
CREATE POLICY "post_comments_insert_approved"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;
CREATE POLICY "post_comments_delete_approved"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_approved_user());

-- 6. STORIES
DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_all"
  ON public.stories FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
CREATE POLICY "stories_insert_approved"
  ON public.stories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_user());

DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
CREATE POLICY "stories_delete_approved"
  ON public.stories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_approved_user());

-- 7. STORY_VIEWS
-- Fix: allow anyone to read story_views so view counts and viewed_by_me work
-- for non-owner stories. The data is just story_id + viewer_id + timestamp (not sensitive).
DROP POLICY IF EXISTS "story_views_select_owner" ON public.story_views;
CREATE POLICY "story_views_select_all"
  ON public.story_views FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "story_views_insert_own" ON public.story_views;
CREATE POLICY "story_views_insert_approved"
  ON public.story_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id AND public.is_approved_user());

DROP POLICY IF EXISTS "story_views_delete_owner" ON public.story_views;
CREATE POLICY "story_views_delete_approved"
  ON public.story_views FOR DELETE
  TO authenticated
  USING (auth.uid() = viewer_id AND public.is_approved_user());

-- 8. GRANT SELECT to anon so the policies actually take effect
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.post_media TO anon;
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT ON public.stories TO anon;
GRANT SELECT ON public.story_views TO anon;
