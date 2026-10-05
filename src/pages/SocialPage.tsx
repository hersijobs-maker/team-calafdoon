import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { StoriesBar } from '@/components/StoriesBar';
import { StoryViewer } from '@/components/StoryViewer';
import { PostCard } from '@/components/PostCard';
import { CreatePostModal } from '@/components/CreatePostModal';
import { fetchPosts, fetchStoryGroups } from '@/lib/social';
import type { Post, StoryGroup } from '@/lib/types';
import { Plus, Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';

export function SocialPage() {
  const { profile, accessLevel } = useAuth();
  const canInteract = accessLevel === 'approved' || accessLevel === 'admin';
  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingStory, setViewingStory] = useState<{ group: StoryGroup; index: number } | null>(null);

  const loadPosts = useCallback(async () => {
    const data = await fetchPosts(0, 15);
    setPosts(data);
  }, []);

  const loadStories = useCallback(async () => {
    const data = await fetchStoryGroups();
    setStoryGroups(data);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadPosts(), loadStories()]);
    setLoading(false);
  }, [loadPosts, loadStories]);

  useEffect(() => {
    loadAll();

    // Realtime subscriptions (only work for authenticated users)
    if (!canInteract && !profile) return;

    const postChannel = supabase
      .channel('social_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => loadPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => loadPosts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => loadPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_likes' }, () => loadPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_likes' }, () => loadPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, () => loadPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_comments' }, () => loadPosts())
      .subscribe();

    const storyChannel = supabase
      .channel('social_stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => loadStories())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stories' }, () => loadStories())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'story_views' }, () => loadStories())
      .subscribe();

    return () => {
      supabase.removeChannel(postChannel);
      supabase.removeChannel(storyChannel);
    };
  }, [loadAll, loadPosts, loadStories, canInteract, profile]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Stories */}
        <StoriesBar
          groups={storyGroups}
          currentUserId={profile?.id || ''}
          onOpenStory={(group, index) => setViewingStory({ group, index })}
          onRefresh={loadStories}
        />

        {/* Create post bar - only for approved users */}
        {canInteract && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 text-left bg-slate-50 hover:bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-500 transition-colors"
            >
              Maxaad qabaysaa, {profile?.full_name?.split(' ')[0]}?
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
              title="Sawir ku dar"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Wali post ma jiraan</p>
            {canInteract ? (
              <>
                <p className="text-slate-400 text-sm mt-1">Ugu horaad ku dar post cusub!</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Abuur Post
                </button>
              </>
            ) : (
              <p className="text-slate-400 text-sm mt-1">Fadlan la sug inta xubnaha ay qori doonaan.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={loadPosts}
                onUpdated={loadPosts}
              />
            ))}
          </div>
        )}

        {/* Refresh button */}
        {!loading && posts.length > 0 && (
          <div className="text-center py-6">
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Cusbooneysii
            </button>
          </div>
        )}
      </div>

      {/* Floating create button on mobile - only for approved */}
      {canInteract && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all sm:hidden"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      {showCreate && canInteract && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={loadPosts}
        />
      )}

      {viewingStory && (
        <StoryViewer
          group={viewingStory.group}
          startIndex={viewingStory.index}
          onClose={() => setViewingStory(null)}
          onRefresh={loadStories}
        />
      )}
    </div>
  );
}
