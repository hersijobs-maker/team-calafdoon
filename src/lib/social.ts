import { supabase } from '@/lib/supabase';
import type {
  Post, PostMedia, PostComment, Story, StoryGroup, StoryViewerEntry, MediaType,
} from '@/lib/types';

const BUCKET = 'social-media';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export interface UploadResult {
  url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, error: 'Kaliya sawirro iyo video ayaa la soo kici karaa' };
  }

  if (isImage) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: 'Nooca sawirka lama oggola yahay' };
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: 'Sawirka waa in uu yahay ka yar 10MB' };
    }
  }

  if (isVideo) {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return { valid: false, error: 'Nooca videoga lama oggola yahay' };
    }
    if (file.size > MAX_VIDEO_SIZE) {
      return { valid: false, error: 'Videoga waa in uu yahay ka yar 50MB' };
    }
  }

  return { valid: true };
}

export async function uploadMedia(
  file: File,
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult | null> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const isVideo = file.type.startsWith('video/');
  const mediaType: MediaType = isVideo ? 'video' : 'image';
  const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload khalad: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const url = urlData.publicUrl;

  let thumbnailUrl: string | null = null;
  if (isVideo) {
    thumbnailUrl = await generateVideoThumbnail(file);
  }

  return { url, media_type: mediaType, thumbnail_url: thumbnailUrl };
}

async function generateVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        'image/jpeg',
        0.7,
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

// ========== POSTS ==========

export async function createPost(
  userId: string,
  caption: string,
  mediaFiles: UploadResult[],
): Promise<string | null> {
  const { data: post, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, caption: caption || null })
    .select('id')
    .single();

  if (error || !post) {
    throw new Error(`Khalad abuurista post: ${error?.message}`);
  }

  const postId = (post as { id: string }).id;

  if (mediaFiles.length > 0) {
    const mediaRows = mediaFiles.map((m, i) => ({
      post_id: postId,
      user_id: userId,
      media_url: m.url,
      media_type: m.media_type,
      position: i,
      thumbnail_url: m.thumbnail_url,
    }));

    const { error: mediaError } = await supabase.from('post_media').insert(mediaRows);
    if (mediaError) {
      throw new Error(`Khalab media upload: ${mediaError.message}`);
    }
  }

  return postId;
}

export async function fetchPosts(page: number = 0, limit: number = 10): Promise<Post[]> {
  const offset = page * limit;
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, caption, created_at, updated_at,
      author:profiles!posts_user_id_fkey(id, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !posts) return [];

  const postList = posts as unknown as Post[];
  if (postList.length === 0) return [];

  const postIds = postList.map((p) => p.id);

  const [mediaRes, likesRes, commentsRes] = await Promise.all([
    supabase.from('post_media').select('*').in('post_id', postIds).order('position'),
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase
      .from('post_comments')
      .select(`
        id, post_id, user_id, content, created_at,
        author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
      `)
      .in('post_id', postIds)
      .order('created_at', { ascending: false }),
  ]);

  const mediaList = (mediaRes.data as PostMedia[]) || [];
  const likesList = (likesRes.data as { post_id: string; user_id: string }[]) || [];
  const commentsList = (commentsRes.data as unknown as PostComment[]) || [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  return postList.map((post) => {
    const media = mediaList.filter((m) => m.post_id === post.id);
    const postLikes = likesList.filter((l) => l.post_id === post.id);
    const postComments = commentsList.filter((c) => c.post_id === post.id);
    return {
      ...post,
      media,
      like_count: postLikes.length,
      comment_count: postComments.length,
      liked_by_me: currentUserId ? postLikes.some((l) => l.user_id === currentUserId) : false,
      comments: postComments.slice(0, 3),
    };
  });
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw new Error(`Khalad tirtirka post: ${error.message}`);
}

export async function updatePost(postId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ caption, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw new Error(`Khalad wax ka beddelka post: ${error.message}`);
}

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '');
    if (error) throw new Error('Khalad like-ka');
  } else {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId });
    if (error) throw new Error('Khalad like-ka');
  }
}

export async function addComment(postId: string, content: string): Promise<PostComment | null> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, content })
    .select(`
      id, post_id, user_id, content, created_at,
      author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
    `)
    .single();
  if (error) return null;
  return data as unknown as PostComment;
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`
      id, post_id, user_id, content, created_at,
      author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data as unknown as PostComment[]) || [];
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  if (error) throw new Error(`Khalad tirtirka comment: ${error.message}`);
}

// ========== STORIES ==========

export async function uploadStory(
  file: File,
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<string | null> {
  const result = await uploadMedia(file, userId, onProgress);
  if (!result) return null;

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      media_url: result.url,
      media_type: result.media_type,
      thumbnail_url: result.thumbnail_url,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Khalad story upload: ${error.message}`);
  return (data as { id: string }).id;
}

export async function fetchStoryGroups(): Promise<StoryGroup[]> {
  const { data: stories, error } = await supabase
    .from('stories')
    .select(`
      id, user_id, media_url, media_type, thumbnail_url, expires_at, created_at,
      author:profiles!stories_user_id_fkey(id, full_name, avatar_url)
    `)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error || !stories) return [];

  const storyList = stories as unknown as Story[];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  const allStoryIds = storyList.map((s) => s.id);

  let viewedIds: Set<string> = new Set();
  let viewCounts: Map<string, number> = new Map();

  if (allStoryIds.length > 0) {
    const { data: views } = await supabase
      .from('story_views')
      .select('story_id, viewer_id')
      .in('story_id', allStoryIds);

    if (views) {
      for (const v of views as { story_id: string; viewer_id: string }[]) {
        if (v.viewer_id === currentUserId) {
          viewedIds.add(v.story_id);
        }
      }
      const countMap = new Map<string, number>();
      for (const v of views as { story_id: string; viewer_id: string }[]) {
        countMap.set(v.story_id, (countMap.get(v.story_id) || 0) + 1);
      }
      viewCounts = countMap;
    }
  }

  const groupMap = new Map<string, StoryGroup>();
  for (const story of storyList) {
    if (!story.author) continue;
    const existing = groupMap.get(story.user_id);
    const storyWithMeta: Story = {
      ...story,
      view_count: viewCounts.get(story.id) || 0,
      viewed_by_me: viewedIds.has(story.id),
    };
    if (existing) {
      existing.stories.push(storyWithMeta);
      if (!storyWithMeta.viewed_by_me) existing.has_unviewed = true;
    } else {
      groupMap.set(story.user_id, {
        user_id: story.user_id,
        full_name: story.author.full_name,
        avatar_url: story.author.avatar_url,
        stories: [storyWithMeta],
        has_unviewed: !storyWithMeta.viewed_by_me,
      });
    }
  }

  return Array.from(groupMap.values());
}

export async function recordStoryView(storyId: string): Promise<void> {
  const { error } = await supabase.from('story_views').insert({ story_id: storyId });
  if (error && error.code !== '23505') {
    console.error('Error recording story view:', error);
  }
}

export async function fetchStoryViewers(storyId: string): Promise<StoryViewerEntry[]> {
  const { data, error } = await supabase.rpc('get_story_viewers', { p_story_id: storyId });
  if (error) {
    console.error('Error fetching story viewers:', error);
    return [];
  }
  return (data as StoryViewerEntry[]) || [];
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) throw new Error(`Khalad tirtirka story: ${error.message}`);
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, caption, created_at, updated_at,
      author:profiles!posts_user_id_fkey(id, full_name, avatar_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !posts) return [];

  const postList = posts as unknown as Post[];
  if (postList.length === 0) return [];

  const postIds = postList.map((p) => p.id);

  const [mediaRes, likesRes] = await Promise.all([
    supabase.from('post_media').select('*').in('post_id', postIds).order('position'),
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
  ]);

  const mediaList = (mediaRes.data as PostMedia[]) || [];
  const likesList = (likesRes.data as { post_id: string; user_id: string }[]) || [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  return postList.map((post) => {
    const media = mediaList.filter((m) => m.post_id === post.id);
    const postLikes = likesList.filter((l) => l.post_id === post.id);
    return {
      ...post,
      media,
      like_count: postLikes.length,
      liked_by_me: currentUserId ? postLikes.some((l) => l.user_id === currentUserId) : false,
    };
  });
}
