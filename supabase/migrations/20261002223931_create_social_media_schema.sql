/*
# Social Media System — Posts, Stories, Comments, Likes, Story Views

## Summary
Adds a complete social media system to Team Calafdoon: posts with multi-photo/video support,
likes, comments, stories with 24-hour expiry, and a story viewer tracking system.

## New Tables

### 1. posts
- `id` uuid PK
- `user_id` uuid NOT NULL DEFAULT auth.uid() FK -> profiles(id) ON DELETE CASCADE
- `caption` text (nullable) — text description/caption
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

### 2. post_media
- `id` uuid PK
- `post_id` uuid NOT NULL FK -> posts(id) ON DELETE CASCADE
- `user_id` uuid NOT NULL DEFAULT auth.uid() FK -> profiles(id) ON DELETE CASCADE
- `media_url` text NOT NULL — storage URL
- `media_type` text NOT NULL — 'image' or 'video'
- `position` integer NOT NULL DEFAULT 0 — ordering within post
- `thumbnail_url` text (nullable) — for video thumbnails
- `created_at` timestamptz DEFAULT now()

### 3. post_likes
- `id` uuid PK
- `post_id` uuid NOT NULL FK -> posts(id) ON DELETE CASCADE
- `user_id` uuid NOT NULL DEFAULT auth.uid() FK -> profiles(id) ON DELETE CASCADE
- `created_at` timestamptz DEFAULT now()
- UNIQUE(post_id, user_id) — one like per user per post

### 4. post_comments
- `id` uuid PK
- `post_id` uuid NOT NULL FK -> posts(id) ON DELETE CASCADE
- `user_id` uuid NOT NULL DEFAULT auth.uid() FK -> profiles(id) ON DELETE CASCADE
- `content` text NOT NULL
- `created_at` timestamptz DEFAULT now()

### 5. stories
- `id` uuid PK
- `user_id` uuid NOT NULL DEFAULT auth.uid() FK -> profiles(id) ON DELETE CASCADE
- `media_url` text NOT NULL
- `media_type` text NOT NULL — 'image' or 'video'
- `thumbnail_url` text (nullable)
- `expires_at` timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
- `created_at` timestamptz DEFAULT now()

### 6. story_views
- `id` uuid PK
- `story_id` uuid NOT NULL FK -> stories(id) ON DELETE CASCADE
- `viewer_id` uuid NOT NULL DEFAULT auth.uid() FK -> profiles(id) ON DELETE CASCADE
- `viewed_at` timestamptz DEFAULT now()
- UNIQUE(story_id, viewer_id) — one view record per user per story

## RLS Policies

### posts
- SELECT: all authenticated users can see all posts (community feed)
- INSERT: authenticated users can create their own posts
- UPDATE: only post owner can edit
- DELETE: only post owner can delete

### post_media
- SELECT: all authenticated (public feed)
- INSERT: only post owner (user_id = auth.uid())
- DELETE: only post owner

### post_likes
- SELECT: all authenticated (likes are public)
- INSERT: authenticated users can like (user_id = auth.uid())
- DELETE: only the liker can unlike

### post_comments
- SELECT: all authenticated
- INSERT: authenticated users can comment
- DELETE: only comment author can delete

### stories
- SELECT: all authenticated can see active (non-expired) stories
- INSERT: authenticated users can create stories
- DELETE: only story owner can delete

### story_views
- SELECT: only the story owner can see who viewed their story
  (uses EXISTS check: story owner = auth.uid())
- INSERT: any authenticated user can insert a view record (viewing a story)
- DELETE: only story owner can delete views (when deleting story)

## Helper Functions (SECURITY DEFINER)
- `get_story_viewers(p_story_id uuid)` — returns viewer list with profile info;
  only the story owner can call this
- `has_viewed_story(p_story_id uuid)` — returns boolean for current user

## Indexes
- posts(user_id), posts(created_at DESC)
- post_media(post_id), post_media(user_id)
- post_likes(post_id), post_likes(user_id)
- post_comments(post_id), post_comments(user_id)
- stories(user_id), stories(expires_at), stories(created_at DESC)
- story_views(story_id), story_views(viewer_id)

## Realtime
- All 6 tables added to supabase_realtime publication for live updates

## Important Notes
1. Stories auto-expire: the `expires_at` column defaults to now() + 24h.
   The feed query filters `expires_at > now()` so expired stories are hidden.
2. Story views are private: only the story owner can see the viewer list.
   The RLS SELECT policy enforces this at the database level.
3. Posts are community-wide: all approved authenticated users can see all posts.
4. No existing tables are modified or deleted.
*/
