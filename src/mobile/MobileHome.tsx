import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { fetchPosts, fetchStoryGroups } from '@/lib/social';
import type { Post, StoryGroup } from '@/lib/types';
import { Heart, Users, MessageCircle, UserCheck, Sparkles, Loader2, Image as ImageIcon, ChevronRight } from 'lucide-react';
import type { Tab, ChatTarget } from '@/mobile/MobileApp';

interface NewMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  marital_status: string | null;
}

interface SiteStats {
  approved_count: number;
  connection_count: number;
  new_this_month: number;
}

const MARITAL_LABELS: Record<string, string> = {
  single: 'Aan guursan', divorced: 'Guur laga xigay', widowed: 'Luumay', married: 'Guursan',
};

interface Props {
  onNavigate: (tab: Tab) => void;
  onOpenMember: (memberId: string) => void;
  onOpenChat: (target: ChatTarget) => void;
}

export function MobileHome({ onNavigate, onOpenMember, onOpenChat }: Props) {
  const { profile } = useAuth();
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState<StoryGroup | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_new_members', { p_limit: 6 }).then(({ data }) => data as NewMember[] || []),
      supabase.rpc('get_site_stats').then(({ data }) => data as SiteStats | null),
      fetchPosts(0, 5).then((p) => p as Post[]),
      fetchStoryGroups().then((s) => s as StoryGroup[]),
    ]).then(([members, s, p, sg]) => {
      setNewMembers(members);
      setStats(s);
      setPosts(p);
      setStoryGroups(sg);
      setLoading(false);
      setPostsLoading(false);
    });
  }, []);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-4 pt-3 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Team Calafdoon</h1>
            <p className="text-emerald-100/80 text-xs">Soo dhawoow, {profile?.full_name?.split(' ')[0]}</p>
          </div>
        </div>
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Users className="w-4 h-4" />} value={stats.approved_count} label="Xubnaha" />
            <StatCard icon={<UserCheck className="w-4 h-4" />} value={stats.connection_count} label="Kulanno" />
            <StatCard icon={<Sparkles className="w-4 h-4" />} value={stats.new_this_month} label="Cusub" />
          </div>
        )}
      </div>

      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={<Users />} label="Xubnaha" onClick={() => onNavigate('search')} />
          <QuickAction icon={<MessageCircle />} label="Fariimaha" onClick={() => onNavigate('messages')} />
          <QuickAction icon={<ImageIcon />} label="Bulshada" onClick={() => onNavigate('search')} />
        </div>
      </div>

      {/* Stories */}
      {storyGroups.length > 0 && (
        <div className="mt-6">
          <div className="px-4 flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Sheekooyinka</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {storyGroups.map((sg) => (
              <button
                key={sg.user_id}
                onClick={() => setViewingStory(sg)}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <div className={`w-16 h-16 rounded-full p-0.5 ${sg.has_unviewed ? 'bg-gradient-to-tr from-emerald-500 to-teal-500' : 'bg-slate-200'}`}>
                  <div className="w-full h-full rounded-full bg-white p-0.5">
                    {sg.avatar_url ? (
                      <img src={sg.avatar_url} alt={sg.full_name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-sm font-bold text-emerald-700">
                        {sg.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-600 font-medium max-w-[64px] truncate">{sg.full_name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New members */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Xubnaha Cusub</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : newMembers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Wax xubno ah ma jiro</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {newMembers.map((m) => (
              <button key={m.id} onClick={() => onOpenMember(m.id)} className="text-left active:scale-95 transition-transform">
                <MemberCard member={m} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Posts feed */}
      <div className="px-4 mt-6 pb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Qoraalada Bulshada</h2>
        {postsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Wax qoraal ah ma jiro</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCardMini key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* Story viewer */}
      {viewingStory && (
        <StoryViewerMobile
          group={viewingStory}
          allGroups={storyGroups}
          onClose={() => setViewingStory(null)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 text-center">
      <div className="flex justify-center mb-1 text-white/80">{icon}</div>
      <p className="text-white font-bold text-lg leading-none">{value}</p>
      <p className="text-emerald-100/70 text-[10px] mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
        {icon}
      </div>
      <span className="font-semibold text-slate-900 text-xs">{label}</span>
    </button>
  );
}

function MemberCard({ member }: { member: NewMember }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="aspect-square bg-slate-100">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-200">
            <span className="text-2xl font-bold text-emerald-700">{member.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-slate-900 text-sm truncate">{member.full_name}</p>
        <p className="text-xs text-slate-500 truncate">
          {member.city ? member.city : ''}
          {member.city && member.marital_status ? ' · ' : ''}
          {member.marital_status ? MARITAL_LABELS[member.marital_status] || '' : ''}
        </p>
      </div>
    </div>
  );
}

function PostCardMini({ post }: { post: Post }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 p-3">
        {post.author?.avatar_url ? (
          <img src={post.author.avatar_url} alt={post.author.full_name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-xs font-bold text-emerald-700">
            {post.author?.full_name?.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-slate-900 text-sm flex-1 truncate">{post.author?.full_name}</span>
        <span className="text-[10px] text-slate-400">{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
      {post.caption && <p className="px-3 pb-2 text-sm text-slate-700 line-clamp-2">{post.caption}</p>}
      {post.media && post.media.length > 0 && (
        <div className="aspect-square bg-slate-100">
          {post.media[0].media_type === 'video' ? (
            <video src={post.media[0].media_url} className="w-full h-full object-cover" controls={false} muted />
          ) : (
            <img src={post.media[0].media_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      )}
      <div className="flex items-center gap-4 px-3 py-2.5">
        <div className="flex items-center gap-1 text-slate-500">
          <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span className="text-xs font-medium">{post.like_count || 0}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs font-medium">{post.comment_count || 0}</span>
        </div>
      </div>
    </div>
  );
}

function StoryViewerMobile({ group, allGroups, onClose }: {
  group: StoryGroup;
  allGroups: StoryGroup[];
  onClose: () => void;
}) {
  const [currentGroupIdx, setCurrentGroupIdx] = useState(() => allGroups.findIndex(g => g.user_id === group.user_id));
  const [storyIdx, setStoryIdx] = useState(0);
  const currentGroup = allGroups[currentGroupIdx];
  const stories = currentGroup?.stories || [];
  const currentStory = stories[storyIdx];

  useEffect(() => {
    if (!currentStory) return;
    supabase.rpc('record_story_view', { p_story_id: currentStory.id }).then(({ error }) => { if (error) { /* ignore */ } });
  }, [currentStory]);

  useEffect(() => {
    if (!currentStory) {
      if (currentGroupIdx < allGroups.length - 1) {
        setCurrentGroupIdx(currentGroupIdx + 1);
        setStoryIdx(0);
      } else {
        onClose();
      }
    }
  }, [currentStory, currentGroupIdx, allGroups.length, onClose]);

  const handleNext = () => {
    if (storyIdx < stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (currentGroupIdx < allGroups.length - 1) {
      setCurrentGroupIdx(currentGroupIdx + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    } else if (currentGroupIdx > 0) {
      const prevGroup = allGroups[currentGroupIdx - 1];
      setCurrentGroupIdx(currentGroupIdx - 1);
      setStoryIdx(prevGroup.stories.length - 1);
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
        {currentStory.media_type === 'video' ? (
          <video src={currentStory.media_url} className="w-full h-full object-contain" autoPlay controls />
        ) : (
          <img src={currentStory.media_url} alt="" className="w-full h-full object-contain" />
        )}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2.5">
            {currentGroup.avatar_url ? (
              <img src={currentGroup.avatar_url} alt={currentGroup.full_name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-white">
                {currentGroup.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-white font-semibold text-sm">{currentGroup.full_name}</span>
            <button onClick={onClose} className="ml-auto text-white p-1">
              <span className="text-xl">x</span>
            </button>
          </div>
          <div className="flex gap-1 mt-2">
            {stories.map((_, i) => (
              <div key={i} className={`h-0.5 flex-1 rounded-full ${i <= storyIdx ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>
        <button onClick={handlePrev} className="absolute left-0 top-0 bottom-0 w-1/3" />
        <button onClick={handleNext} className="absolute right-0 top-0 bottom-0 w-1/3" />
      </div>
    </div>
  );
}
