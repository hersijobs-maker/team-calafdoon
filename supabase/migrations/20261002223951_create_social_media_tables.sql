/*
# Social Media System — Tables, RLS, Functions, Indexes, Realtime

Creates posts, post_media, post_likes, post_comments, stories, story_views tables
with full RLS policies, indexes, helper functions, and realtime publication.
*/

-- ========== 1. posts ==========
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== 2. post_media ==========
CREATE TABLE IF NOT EXISTS public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  position integer NOT NULL DEFAULT 0,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON public.post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_user_id ON public.post_media(user_id);

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_media_select_all" ON public.post_media;
CREATE POLICY "post_media_select_all" ON public.post_media FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "post_media_insert_own" ON public.post_media;
CREATE POLICY "post_media_insert_own" ON public.post_media FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_media_delete_own" ON public.post_media;
CREATE POLICY "post_media_delete_own" ON public.post_media FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== 3. post_likes ==========
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select_all" ON public.post_likes;
CREATE POLICY "post_likes_select_all" ON public.post_likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
CREATE POLICY "post_likes_insert_own" ON public.post_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;
CREATE POLICY "post_likes_delete_own" ON public.post_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== 4. post_comments ==========
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select_all" ON public.post_comments;
CREATE POLICY "post_comments_select_all" ON public.post_comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
CREATE POLICY "post_comments_insert_own" ON public.post_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;
CREATE POLICY "post_comments_delete_own" ON public.post_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== 5. stories ==========
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  thumbnail_url text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories(created_at DESC);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_active" ON public.stories FOR SELECT
  TO authenticated USING (expires_at > now());

DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== 6. story_views ==========
CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON public.story_views(viewer_id);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Only the story owner can see who viewed their story
DROP POLICY IF EXISTS "story_views_select_owner" ON public.story_views;
CREATE POLICY "story_views_select_owner" ON public.story_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_views.story_id AND s.user_id = auth.uid()
    )
  );

-- Any authenticated user can record a view (when they open a story)
DROP POLICY IF EXISTS "story_views_insert_own" ON public.story_views;
CREATE POLICY "story_views_insert_own" ON public.story_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- Only story owner can delete views (cascade from story delete)
DROP POLICY IF EXISTS "story_views_delete_owner" ON public.story_views;
CREATE POLICY "story_views_delete_owner" ON public.story_views FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_views.story_id AND s.user_id = auth.uid()
    )
  );

-- ========== 7. Helper Functions ==========

-- get_story_viewers: only story owner can see viewer list
CREATE OR REPLACE FUNCTION public.get_story_viewers(p_story_id uuid)
RETURNS TABLE (
  viewer_id uuid,
  full_name text,
  avatar_url text,
  viewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story record;
BEGIN
  SELECT * INTO v_story FROM public.stories WHERE id = p_story_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_story.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Kaliya milicsadeha story ayaa arki kara daawadayaasha';
  END IF;
  RETURN QUERY
  SELECT sv.viewer_id, p.full_name, p.avatar_url, sv.viewed_at
  FROM public.story_views sv
  JOIN public.profiles p ON p.id = sv.viewer_id
  WHERE sv.story_id = p_story_id
  ORDER BY sv.viewed_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_story_viewers(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_story_viewers(uuid) FROM anon, public;

-- ========== 8. Realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_media;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
